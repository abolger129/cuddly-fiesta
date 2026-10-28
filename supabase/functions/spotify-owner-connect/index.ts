// Supabase Edge Function: connect the Spotify account that owns every playlist.
//
// Run once by the app owner. Open this function's address in a browser, sign
// in to Spotify, and the page shows a refresh token to save as the
// SPOTIFY_REFRESH_TOKEN secret, which the spotify-playlist function uses.
//
// It saves nothing itself, so someone else opening it only ever sees a token
// for their own account. Deploy it with --no-verify-jwt so a browser can open
// it, and add its address as a Redirect URI in the Spotify app's settings.
//
// Needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.

const scopes = 'playlist-modify-public playlist-modify-private';

function text(body: string, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

Deno.serve(async (req) => {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return text('Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first.', 500);
  }
  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/spotify-owner-connect`;
  const params = new URL(req.url).searchParams;

  if (params.get('error')) return text(`Spotify said: ${params.get('error')}`, 400);

  const code = params.get('code');
  if (!code) {
    const authorize = new URL('https://accounts.spotify.com/authorize');
    authorize.search = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes,
      // Always ask, so it's clear which Spotify account is being connected.
      show_dialog: 'true',
    }).toString();
    return Response.redirect(authorize.toString(), 302);
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  });
  if (!response.ok) {
    const details = await response.text();
    return text(`Spotify sign-in failed (${response.status}): ${details}`, 502);
  }
  const token = await response.json();

  const me = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  }).then((r) => (r.ok ? r.json() : null));

  return text(
    [
      `Connected Spotify account: ${me?.display_name ?? me?.id ?? 'unknown'}`,
      '',
      'Save this as a Supabase secret (keep it private, it lets anyone make playlists on this account):',
      '',
      `npx supabase secrets set SPOTIFY_REFRESH_TOKEN=${token.refresh_token}`,
      '',
      'Then close this page.',
    ].join('\n')
  );
});

// Supabase Edge Function: search Spotify for tracks.
//
// Runs on Supabase rather than in the app so the Spotify client secret never
// ships inside the app. Uses Spotify's client credentials flow, so the person
// searching does not need to connect a Spotify account.
//
// Needs two secrets: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.
// Only signed-in users of the app can call it (Supabase checks their token).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SpotifyImage = { url: string; width: number | null };
type SpotifyTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: SpotifyImage[] };
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('Spotify is not set up yet: add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) {
    throw new Error(`Spotify sign-in failed (${response.status})`);
  }
  const body = await response.json();
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

/** The smallest album image that is still at least 64px wide. */
function pickAlbumArt(images: SpotifyImage[]): string | null {
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sorted.find((i) => (i.width ?? 0) >= 64) ?? sorted.at(-1))?.url ?? null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (typeof query !== 'string' || !query.trim()) {
      return json({ tracks: [] });
    }

    const params = new URLSearchParams({ q: query.trim(), type: 'track', limit: '10' });
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${await getAppToken()}` },
    });
    if (!response.ok) {
      return json({ error: `Spotify search failed (${response.status})` }, 502);
    }

    const body = await response.json();
    const tracks = (body.tracks?.items ?? []).map((t: SpotifyTrack) => ({
      spotify_track_id: t.id,
      track_name: t.name,
      artist_name: t.artists.map((a) => a.name).join(', '),
      album_art_url: pickAlbumArt(t.album.images),
    }));
    return json({ tracks });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

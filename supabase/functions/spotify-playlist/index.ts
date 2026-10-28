// Supabase Edge Function: make the Spotify playlists for rounds and leagues.
//
// Every playlist goes on one Spotify account, the app owner's, so only that
// account ever signs in to the Spotify app. Players just open the links, which
// keeps the app well under the 5 user limit of Spotify's development mode.
//
// Body: { round_id } makes a round's playlist once ranking opens, or
// { group_id } makes the league playlist (every song from finished rounds) and
// brings it up to date as more rounds finish. Any member of the league can
// call it, and calling it again does nothing new, so the app calls it whenever
// a playlist is due.
//
// Needs SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN (see
// the spotify-owner-connect function for getting the last one).

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

class SpotifyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// Spotify ----------------------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;

/** An access token for the owner's account, from the saved refresh token. */
async function getOwnerToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  const refreshToken = Deno.env.get('SPOTIFY_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Spotify playlists are not set up yet: add SPOTIFY_REFRESH_TOKEN');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  if (!response.ok) {
    // Usually the owner removed the app from their Spotify account; connect again.
    throw new Error(`Spotify sign-in failed (${response.status}). The playlist account needs reconnecting.`);
  }
  const body = await response.json();
  if (body.refresh_token && body.refresh_token !== refreshToken) {
    console.warn('Spotify sent a new refresh token; run spotify-owner-connect again and save it');
  }
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

async function spotify(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await getOwnerToken()}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    throw new SpotifyError(
      details?.error?.message ?? `Spotify request failed (${response.status})`,
      response.status
    );
  }
  return response.status === 204 ? null : response.json().catch(() => null);
}

const trackUri = (id: string) => `spotify:track:${id}`;

async function addTracks(playlistId: string, trackIds: string[]) {
  // Spotify accepts up to 100 tracks per request.
  for (let i = 0; i < trackIds.length; i += 100) {
    await spotify(`/playlists/${playlistId}/items`, 'POST', {
      uris: trackIds.slice(i, i + 100).map(trackUri),
    });
  }
}

/**
 * Private playlists stay off the owner's public profile, but anyone with the
 * link can still open them.
 */
async function createPlaylist(name: string, description: string, trackIds: string[]) {
  const playlist = await spotify('/me/playlists', 'POST', { name, description, public: false });
  await addTracks(playlist.id, trackIds);
  return { id: playlist.id as string, url: playlist.external_urls.spotify as string };
}

/** Unfollowing is how Spotify deletes a playlist. */
async function deletePlaylist(playlistId: string) {
  await spotify(`/playlists/${playlistId}/followers`, 'DELETE').catch(() => {});
}

const playlistIdOf = (url: string) => url.match(/playlist\/([A-Za-z0-9]+)/)?.[1] ?? null;

// Playlists --------------------------------------------------------------------

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

async function isMember(groupId: string, userId: string) {
  const { data } = await admin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

/**
 * Save a new playlist's link unless someone else's call saved one first, in
 * which case the new playlist is thrown away and theirs is used.
 */
async function claimLink(table: 'rounds' | 'groups', id: string, playlist: { id: string; url: string }) {
  const { data } = await admin
    .from(table)
    .update({ playlist_url: playlist.url })
    .eq('id', id)
    .is('playlist_url', null)
    .select('playlist_url');
  if (data?.length) return playlist.url;
  await deletePlaylist(playlist.id);
  const { data: row } = await admin.from(table).select('playlist_url').eq('id', id).single();
  return row?.playlist_url ?? null;
}

async function roundPlaylist(roundId: string, userId: string) {
  const { data: round } = await admin
    .from('rounds')
    .select('id, group_id, round_number, category, status, playlist_url, groups(name)')
    .eq('id', roundId)
    .maybeSingle();
  if (!round || !(await isMember(round.group_id, userId))) {
    return json({ error: 'Round not found' }, 404);
  }
  if (round.playlist_url) return json({ url: round.playlist_url });
  // Before ranking opens the songs aren't all in yet.
  if (round.status !== 'voting' && round.status !== 'finished') return json({ url: null });

  const { data: songs } = await admin
    .from('submissions')
    .select('spotify_track_id')
    .eq('round_id', roundId)
    .not('spotify_track_id', 'is', null)
    .order('created_at');
  const trackIds = (songs ?? []).map((s) => s.spotify_track_id as string);
  if (trackIds.length === 0) return json({ url: null });

  const groupName = (round.groups as unknown as { name: string } | null)?.name ?? 'The Gauntlet';
  const playlist = await createPlaylist(
    `${groupName}: Round ${round.round_number}`,
    `The Gauntlet round ${round.round_number}: ${round.category}`,
    trackIds
  );
  return json({ url: await claimLink('rounds', roundId, playlist) });
}

async function leaguePlaylist(groupId: string, userId: string) {
  const { data: group } = await admin
    .from('groups')
    .select('id, name, playlist_url')
    .eq('id', groupId)
    .maybeSingle();
  if (!group || !(await isMember(groupId, userId))) {
    return json({ error: 'League not found' }, 404);
  }

  const { data: songs } = await admin
    .from('submissions')
    .select('spotify_track_id, created_at, rounds!inner(group_id, round_number, status)')
    .eq('rounds.group_id', groupId)
    .eq('rounds.status', 'finished')
    .not('spotify_track_id', 'is', null);
  const roundOf = (s: { rounds: unknown }) => (s.rounds as { round_number: number }).round_number;
  const inOrder = [...(songs ?? [])].sort(
    (a, b) => roundOf(a) - roundOf(b) || a.created_at.localeCompare(b.created_at)
  );
  const trackIds = [...new Set(inOrder.map((s) => s.spotify_track_id as string))];
  if (trackIds.length === 0) return json({ url: group.playlist_url });

  const existingId = group.playlist_url ? playlistIdOf(group.playlist_url) : null;
  if (existingId) {
    try {
      // Songs are only ever added as rounds finish, so a different count means
      // it's out of date.
      const page = await spotify(`/playlists/${existingId}/items?limit=1&fields=total`);
      if (page?.total !== trackIds.length) {
        await spotify(`/playlists/${existingId}/items`, 'PUT', {
          uris: trackIds.slice(0, 100).map(trackUri),
        });
        await addTracks(existingId, trackIds.slice(100));
      }
      return json({ url: group.playlist_url });
    } catch (e) {
      // Older leagues have playlists on the host's own account, which this
      // account can't change, so they get a fresh one below.
      if (!(e instanceof SpotifyError) || (e.status !== 403 && e.status !== 404)) throw e;
    }
  }

  const playlist = await createPlaylist(
    `${group.name}: The whole league`,
    `Every song from ${group.name} on The Gauntlet`,
    trackIds
  );
  if (group.playlist_url) {
    // Replacing an old playlist rather than racing to make the first one.
    await admin.from('groups').update({ playlist_url: playlist.url }).eq('id', groupId);
    return json({ url: playlist.url });
  }
  return json({ url: await claimLink('groups', groupId, playlist) });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data: auth } = await admin.auth.getUser(jwt);
    if (!auth.user) return json({ error: 'You need to be signed in' }, 401);

    const { round_id, group_id } = await req.json();
    if (typeof round_id === 'string') return await roundPlaylist(round_id, auth.user.id);
    if (typeof group_id === 'string') return await leaguePlaylist(group_id, auth.user.id);
    return json({ error: 'Send a round_id or group_id' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

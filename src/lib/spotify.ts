import { supabase } from '@/lib/supabase';

export type SpotifyTrack = {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  album_art_url: string | null;
};

// Song search ------------------------------------------------------------------

/** Search runs on Supabase so the Spotify secret stays off the phone. */
export async function searchTracks(query: string): Promise<SpotifyTrack[]> {
  const { data, error } = await supabase.functions.invoke('spotify-search', {
    body: { query },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.tracks;
}

// Playlists --------------------------------------------------------------------

/**
 * Every playlist is made on Supabase, on the app owner's Spotify account, so
 * nobody in the app has to connect Spotify. Calling these again is harmless:
 * they return the playlist that's already there.
 */
async function invokePlaylist(body: { round_id: string } | { group_id: string }) {
  const { data, error } = await supabase.functions.invoke('spotify-playlist', { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return (data?.url ?? null) as string | null;
}

/** The round's playlist link, made once ranking opens. Null before then. */
export function makeRoundPlaylist(roundId: string) {
  return invokePlaylist({ round_id: roundId });
}

/** The league playlist link, made or brought up to date with the finished rounds. */
export function syncLeaguePlaylist(groupId: string) {
  return invokePlaylist({ group_id: groupId });
}

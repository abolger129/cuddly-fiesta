import { supabase } from '@/lib/supabase';

export type SpotifyTrack = {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  album_art_url: string | null;
  /** Missing until the spotify-search function is redeployed. */
  spotify_album_id?: string;
  album_name?: string;
};

// Song search ------------------------------------------------------------------

/** Search runs on Supabase so the Spotify secret stays off the phone. */
export async function searchTracks(query: string): Promise<SpotifyTrack[]> {
  const { data, error } = await supabase.functions.invoke('spotify-search', {
    body: { query },
  });
  if (error) throw new Error(await functionErrorMessage(error));
  if (data?.error) throw new Error(data.error);
  return Array.isArray(data?.tracks) ? data.tracks : [];
}

// Playlists --------------------------------------------------------------------

/**
 * Every playlist is made on Supabase, on the app owner's Spotify account, so
 * nobody in the app has to connect Spotify. Calling these again is harmless:
 * they return the playlist that's already there.
 */
async function invokePlaylist(body: { round_id: string } | { group_id: string }) {
  const { data, error } = await supabase.functions.invoke('spotify-playlist', { body });
  if (error) throw new Error(await functionErrorMessage(error));
  if (data?.error) throw new Error(data.error);
  return (data?.url ?? null) as string | null;
}

/**
 * When a function answers with an error status, supabase-js only says "Edge Function
 * returned a non-2xx status code". The function's own reason (such as "The playlist
 * account needs reconnecting") is in the response body, so show that instead.
 */
export async function functionErrorMessage(error: { message: string; context?: unknown }): Promise<string> {
  const response = error.context;
  if (response && typeof (response as Response).json === 'function') {
    try {
      const body = await (response as Response).clone().json();
      if (body && typeof body.error === 'string' && body.error) return body.error;
    } catch {
      // Not JSON: fall back to the generic message.
    }
  }
  return error.message;
}

/** The round's playlist link, made once ranking opens. Null before then. */
export function makeRoundPlaylist(roundId: string) {
  return invokePlaylist({ round_id: roundId });
}

/** The league playlist link, made or brought up to date with the finished rounds. */
export function syncLeaguePlaylist(groupId: string) {
  return invokePlaylist({ group_id: groupId });
}

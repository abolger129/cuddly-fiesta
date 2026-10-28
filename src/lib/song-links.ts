import { spotifyTrackUrl } from '@/lib/spotify';
import type { Submission } from '@/lib/types';

type Linkable = Pick<Submission, 'spotify_track_id' | 'youtube_url'>;

/** Where tapping a song takes you: Spotify, or YouTube for songs that aren't on it. */
export function songUrl(song: Linkable): string | null {
  if (song.spotify_track_id) return spotifyTrackUrl(song.spotify_track_id);
  return song.youtube_url;
}

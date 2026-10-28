import type { Submission } from './types';

type Linkable = Pick<Submission, 'spotify_track_id' | 'youtube_url'>;
type ListedSong = Linkable & Pick<Submission, 'track_name' | 'artist_name'>;

export function spotifyTrackUrl(trackId: string) {
  return `https://open.spotify.com/track/${trackId}`;
}

/** Where tapping a song takes you: Spotify, or YouTube for songs that aren't on it. */
export function songUrl(song: Linkable): string | null {
  if (song.spotify_track_id) return spotifyTrackUrl(song.spotify_track_id);
  return song.youtube_url;
}

/**
 * A plain-text tracklist with a link for each song, for sharing a round
 * anywhere (Messages, Notes, another music app) without connecting Spotify.
 */
export function songListText(title: string, songs: ListedSong[]): string {
  const lines = songs.map((song, i) => {
    const url = songUrl(song);
    return `${i + 1}. ${song.track_name} - ${song.artist_name}${url ? `\n   ${url}` : ''}`;
  });
  return [title, '', ...lines].join('\n');
}

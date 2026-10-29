import type { SimilarPicks, Submission } from '@/lib/types';

export type PickedSong = Pick<Submission, 'track_name' | 'artist_name' | 'spotify_track_id' | 'spotify_album_id' | 'album_name'>;

/** The heads-up shown before submitting, or null if nothing matched. */
export function describeSimilarPicks(similar: SimilarPicks | null, song: Pick<PickedSong, 'album_name'>): string | null {
  if (!similar) return null;
  if (similar.same_song) return 'Someone already picked this song this round.';
  const lines: string[] = [];
  if (similar.same_album) {
    lines.push(`Someone already picked a song from ${song.album_name ? song.album_name : 'this album'}.`);
  }
  if (similar.same_artists.length) {
    lines.push(`Someone already picked a song by ${joinNames(similar.same_artists)}.`);
  }
  return lines.length ? lines.join(' ') : null;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

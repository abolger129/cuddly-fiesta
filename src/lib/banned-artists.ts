/**
 * Banned artists: the host can ban artists for the whole league or one round.
 * The same matching runs in the database (public.banned_artist_in), which
 * has the final say when a song is submitted. Keep the two in step.
 */

/** Lowercase letters and digits only, without a leading "the", so "The Beatles" matches "beatles". */
export function normalizeArtist(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^the\s+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Each artist credited on a song: "A, B & C feat. D" is four artists. */
export function splitArtists(artistName: string): string[] {
  return artistName
    .split(/\s*(?:,|&|\+|;|\/|\bfeat\b\.?|\bft\b\.?|\bfeaturing\b|\bwith\b)\s*/i)
    .map(normalizeArtist)
    .filter(Boolean);
}

/** The ban that rules out a song by these artists, as the host typed it. null if none does. */
export function bannedArtistIn(artistName: string, bans: readonly string[]): string | null {
  const credited = new Set(splitArtists(artistName));
  // The whole credit too, for bans like "Simon & Garfunkel".
  credited.add(normalizeArtist(artistName));
  return bans.find((ban) => credited.has(normalizeArtist(ban))) ?? null;
}

/** Adds a ban to a list, skipping blanks and ones already there. */
export function addBan(bans: readonly string[], artist: string): string[] {
  const name = artist.trim().replace(/\s+/g, ' ');
  if (!normalizeArtist(name) || bans.some((b) => normalizeArtist(b) === normalizeArtist(name))) return [...bans];
  return [...bans, name];
}

/**
 * A player's comment on their own song can grow in two steps: a note written
 * when they pick it, and more added while they rank the other songs. Both are
 * stored as one comment, with a marker line between them so the results can
 * show the second part separately. Older app versions just show the marker as
 * text, which still reads fine.
 */
export const RANKING_NOTE_MARKER = '\n— added while ranking —\n';

/** Longest a stored comment can be. Matches the check in the database. */
export const MAX_STORED_COMMENT = 280;

/** The comment to store: the original note with the new part added after the marker. */
export function addRankingNote(original: string, addition: string): string {
  const before = original.trim();
  const after = addition.trim();
  if (!after) return before;
  if (!before) return after;
  return `${before}${RANKING_NOTE_MARKER}${after}`;
}

/** How long the part added while ranking can be, so the whole comment still fits. */
export function rankingNoteRoom(original: string): number {
  const before = original.trim();
  return before
    ? Math.max(
        0,
        MAX_STORED_COMMENT - before.length - RANKING_NOTE_MARKER.length,
      )
    : MAX_STORED_COMMENT;
}

/** Splits a stored comment back into the original note and the part added while ranking. */
export function splitRankingNote(body: string): {
  note: string;
  addedWhileRanking: string | null;
} {
  const at = body.indexOf(RANKING_NOTE_MARKER);
  if (at < 0) return { note: body, addedWhileRanking: null };
  return {
    note: body.slice(0, at),
    addedWhileRanking: body.slice(at + RANKING_NOTE_MARKER.length),
  };
}

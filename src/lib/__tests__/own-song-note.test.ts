import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addRankingNote,
  MAX_STORED_COMMENT,
  RANKING_NOTE_MARKER,
  rankingNoteRoom,
  splitRankingNote,
} from '../own-song-note.ts';

test('adding to a note keeps the original and splits back apart', () => {
  const body = addRankingNote(' Love this one ', ' Still do ');
  assert.equal(body, `Love this one${RANKING_NOTE_MARKER}Still do`);
  assert.deepEqual(splitRankingNote(body), {
    note: 'Love this one',
    addedWhileRanking: 'Still do',
  });
});

test('with nothing on one side there is no marker', () => {
  assert.equal(addRankingNote('', 'Just this'), 'Just this');
  assert.equal(addRankingNote('Just this', '  '), 'Just this');
  assert.deepEqual(splitRankingNote('Just this'), {
    note: 'Just this',
    addedWhileRanking: null,
  });
});

test('the added part only gets the room left in the comment', () => {
  const original = 'x'.repeat(100);
  const room = rankingNoteRoom(original);
  assert.equal(
    addRankingNote(original, 'y'.repeat(room)).length,
    MAX_STORED_COMMENT,
  );
  assert.equal(rankingNoteRoom(''), MAX_STORED_COMMENT);
  assert.equal(rankingNoteRoom('x'.repeat(MAX_STORED_COMMENT)), 0);
});

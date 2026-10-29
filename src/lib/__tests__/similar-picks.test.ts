import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeSimilarPicks } from '../similar-picks.ts';

const none = { same_song: false, same_album: false, same_artists: [] };

test('says nothing when nothing matched or the check could not run', () => {
  assert.equal(describeSimilarPicks(none, {}), null);
  assert.equal(describeSimilarPicks(null, {}), null);
});

test('the same song is all it needs to say', () => {
  assert.equal(
    describeSimilarPicks({ same_song: true, same_album: true, same_artists: ['Fleetwood Mac'] }, { album_name: 'Rumours' }),
    'Someone already picked this song this round.'
  );
});

test('names the album and artists, never who picked them', () => {
  assert.equal(
    describeSimilarPicks({ ...none, same_album: true, same_artists: ['Fleetwood Mac'] }, { album_name: 'Rumours' }),
    'Someone already picked a song from Rumours. Someone already picked a song by Fleetwood Mac.'
  );
  assert.equal(
    describeSimilarPicks({ ...none, same_album: true }, { album_name: null }),
    'Someone already picked a song from this album.'
  );
  assert.equal(
    describeSimilarPicks({ ...none, same_artists: ['A', 'B', 'C'] }, {}),
    'Someone already picked a song by A, B and C.'
  );
});

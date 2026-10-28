import assert from 'node:assert/strict';
import { test } from 'node:test';

import { songListText, songUrl } from '../song-links.ts';

test('links Spotify songs to Spotify and the rest to YouTube', () => {
  assert.equal(
    songUrl({ spotify_track_id: 'abc', youtube_url: null }),
    'https://open.spotify.com/track/abc'
  );
  assert.equal(
    songUrl({ spotify_track_id: null, youtube_url: 'https://www.youtube.com/watch?v=x' }),
    'https://www.youtube.com/watch?v=x'
  );
  assert.equal(songUrl({ spotify_track_id: null, youtube_url: null }), null);
});

test('lists each song with its link', () => {
  const text = songListText('Round 1: Road trip', [
    { track_name: 'Song A', artist_name: 'Band', spotify_track_id: 'abc', youtube_url: null },
    { track_name: 'Song B', artist_name: 'Singer', spotify_track_id: null, youtube_url: null },
  ]);
  assert.equal(
    text,
    'Round 1: Road trip\n\n1. Song A - Band\n   https://open.spotify.com/track/abc\n2. Song B - Singer'
  );
});

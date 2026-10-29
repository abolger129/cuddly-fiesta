import assert from 'node:assert/strict';
import { test } from 'node:test';

import { inPlayOrder, songListText, songUrl } from '../song-links.ts';

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

test('orders a league round by round, in each round\'s shuffled order', () => {
  const rounds = new Map([
    ['r1', 1],
    ['r2', 2],
  ]);
  const ordered = inPlayOrder(
    [
      { id: 'a', round_id: 'r2', play_order: 1 },
      { id: 'b', round_id: 'r1', play_order: 2 },
      { id: 'c', round_id: 'r1', play_order: 1 },
      { id: 'd', round_id: 'r1', play_order: null },
    ],
    rounds
  );
  assert.deepEqual(
    ordered.map((s) => s.id),
    ['c', 'b', 'd', 'a']
  );
});

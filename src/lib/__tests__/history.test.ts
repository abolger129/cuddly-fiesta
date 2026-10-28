import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isLeagueOver, leagueAwards, placesFrom, playerStats, type LeagueRecord } from '../history.ts';
import { DEFAULT_RULES } from '../scoring.ts';
import type { Ranking, Submission } from '../types.ts';

const rank = (round_id: string, voter_id: string, order: string[]): Ranking[] =>
  order.map((submission_id, i) => ({ round_id, voter_id, submission_id, position: i + 1 }));

const song = (id: string, round_id: string, user_id: string, artist_name = 'Someone'): Submission => ({
  id,
  round_id,
  user_id,
  artist_name,
  track_name: id,
  spotify_track_id: null,
  youtube_url: null,
  album_art_url: null,
});

const members = ['anna', 'bob', 'cat', 'dan'].map((id) => ({ id, display_name: id }));

// One round, four players with guessing on. Anna and Bob rank the songs they share the same way.
const league: LeagueRecord = {
  group: { id: 'g1', name: 'Test', ...DEFAULT_RULES },
  members,
  rounds: [{ id: 'r1', status: 'finished' }],
  submissions: [
    song('a', 'r1', 'anna', 'Robyn'),
    song('b', 'r1', 'bob', 'Robyn, Kleerup'),
    song('c', 'r1', 'cat', 'ABBA'),
    song('d', 'r1', 'dan', 'Robyn'),
  ],
  rankings: [
    ...rank('r1', 'anna', ['c', 'd', 'b']),
    ...rank('r1', 'bob', ['c', 'd', 'a']),
    ...rank('r1', 'cat', ['a', 'b', 'd']),
    ...rank('r1', 'dan', ['b', 'c', 'a']),
  ],
  guesses: [
    { round_id: 'r1', guesser_id: 'bob', submission_id: 'a', guessed_user_id: 'anna' },
    { round_id: 'r1', guesser_id: 'bob', submission_id: 'c', guessed_user_id: 'cat' },
    { round_id: 'r1', guesser_id: 'cat', submission_id: 'a', guessed_user_id: 'anna' },
  ],
};

test('a league is over once every round is finished', () => {
  assert.equal(isLeagueOver([{ status: 'finished' }, { status: 'finished' }]), true);
  assert.equal(isLeagueOver([{ status: 'finished' }, { status: 'upcoming' }]), false);
  assert.equal(isLeagueOver([]), false);
});

test('players on the same score share a place', () => {
  const places = placesFrom([
    { userId: 'a', points: 5 },
    { userId: 'b', points: 5 },
    { userId: 'c', points: 2 },
  ]);
  assert.deepEqual([...places], [['a', 1], ['b', 1], ['c', 3]]);
});

test('awards pick the best song, the most divisive song, the best guesser and the closest pair', () => {
  const awards = leagueAwards(league);
  // c: 3 + 3 + 0 (cat) + 2 = 8 points.
  assert.equal(awards.bestSong?.submission.id, 'c');
  assert.equal(awards.bestSong?.points, 8);
  // a is last for Bob and Dan but first for Cat.
  assert.equal(awards.mostControversial?.id, 'a');
  assert.deepEqual(awards.bestGuesser, { userId: 'bob', correct: 2 });
  // Anna and Bob ranked c and d identically.
  assert.deepEqual(awards.tasteTwins, { userIds: ['anna', 'bob'], agreement: 1 });
});

test('player stats count wins, places and favourite artists', () => {
  const stats = playerStats([league]);
  const bob = stats.find((s) => s.userId === 'bob');
  // Bob (6 + 4 guess bonus) and Cat (8 + 2) tie on 10 and share the win.
  assert.deepEqual(stats.slice(0, 2).map((s) => [s.userId, s.wins, s.averagePlace]), [
    ['bob', 1, 1],
    ['cat', 1, 1],
  ]);
  assert.equal(stats.find((s) => s.userId === 'anna')?.averagePlace, 3);
  assert.equal(bob?.leaguesFinished, 1);
  assert.equal(bob?.songsPicked, 1);
  assert.deepEqual(bob?.topArtists, [
    { name: 'Kleerup', count: 1 },
    { name: 'Robyn', count: 1 },
  ]);
});

test('unfinished leagues count songs but not places', () => {
  const stats = playerStats([{ ...league, rounds: [...league.rounds, { id: 'r2', status: 'upcoming' }] }]);
  const anna = stats.find((s) => s.userId === 'anna');
  assert.equal(anna?.leaguesFinished, 0);
  assert.equal(anna?.averagePlace, null);
  assert.equal(anna?.songsPicked, 1);
});

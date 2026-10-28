import assert from 'node:assert/strict';
import { test } from 'node:test';

import { leaderboard, pointsForPosition, scoreRound } from '../scoring.ts';
import type { Ranking } from '../types.ts';

const rank = (round_id: string, voter_id: string, order: string[]): Ranking[] =>
  order.map((submission_id, i) => ({ round_id, voter_id, submission_id, position: i + 1 }));

test('a voter gives their favourite the most points', () => {
  const points = scoreRound(rank('r1', 'bob', ['songA', 'songC']));
  assert.equal(points.get('songA'), 2);
  assert.equal(points.get('songC'), 1);
});

test('leaderboard adds up points across rounds and includes members with no points', () => {
  const submissions = [
    { id: 'a1', user_id: 'anna' },
    { id: 'b1', user_id: 'bob' },
    { id: 'c1', user_id: 'cat' },
    { id: 'a2', user_id: 'anna' },
    { id: 'b2', user_id: 'bob' },
  ];
  const rankings = [
    ...rank('r1', 'anna', ['b1', 'c1']),
    ...rank('r1', 'bob', ['a1', 'c1']),
    ...rank('r1', 'cat', ['a1', 'b1']),
    ...rank('r2', 'anna', ['b2']),
    ...rank('r2', 'bob', ['a2']),
  ];

  assert.deepEqual(leaderboard(submissions, rankings, ['anna', 'bob', 'cat', 'dan']), [
    { userId: 'anna', points: 5 },
    { userId: 'bob', points: 4 },
    { userId: 'cat', points: 2 },
    { userId: 'dan', points: 0 },
  ]);
});

const pointsForEach = (n: number, rules: { points_cap: number | null; downvotes: boolean }) =>
  Array.from({ length: n }, (_, i) => pointsForPosition(i + 1, n, rules));

test('a points cap only scores the top songs', () => {
  assert.deepEqual(pointsForEach(5, { points_cap: 3, downvotes: false }), [3, 2, 1, 0, 0]);
  // A cap bigger than the number of songs changes nothing.
  assert.deepEqual(pointsForEach(2, { points_cap: 3, downvotes: false }), [2, 1]);
});

test('downvotes take a point from the last-place song', () => {
  assert.deepEqual(pointsForEach(4, { points_cap: null, downvotes: true }), [3, 2, 1, -1]);
  assert.deepEqual(pointsForEach(6, { points_cap: 3, downvotes: true }), [3, 2, 1, 0, 0, -1]);
  // With only one song to rank there is nothing to downvote.
  assert.deepEqual(pointsForEach(1, { points_cap: null, downvotes: true }), [1]);
});

test('scoreRound applies the league rules', () => {
  const points = scoreRound(rank('r1', 'bob', ['songA', 'songB', 'songC']), { points_cap: 1, downvotes: true });
  assert.equal(points.get('songA'), 1);
  assert.equal(points.get('songB'), 0);
  assert.equal(points.get('songC'), -1);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { leaderboard, scoreRound } from '../scoring.ts';
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

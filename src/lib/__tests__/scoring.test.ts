import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_RULES,
  GUESS_BONUS_POINTS,
  leaderboard,
  pointsForPosition,
  scoreGuesses,
  scoreRound,
  type ScoringRules,
} from '../scoring.ts';
import type { Guess, Ranking } from '../types.ts';

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

const pointsForEach = (n: number, rules: Partial<ScoringRules>) =>
  Array.from({ length: n }, (_, i) => pointsForPosition(i + 1, n, { ...DEFAULT_RULES, ...rules }));

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

test('songs below the max points can go negative', () => {
  assert.deepEqual(pointsForEach(6, { points_cap: 3, negative_points: true }), [3, 2, 1, 0, -1, -2]);
  // A max bigger than the number of songs leaves nothing to go negative.
  assert.deepEqual(pointsForEach(3, { points_cap: 5, negative_points: true }), [3, 2, 1]);
  // Downvotes are ignored: the bottom songs already lose points.
  assert.deepEqual(pointsForEach(5, { points_cap: 2, negative_points: true, downvotes: true }), [2, 1, 0, -1, -2]);
});

test('scoreRound applies the league rules', () => {
  const points = scoreRound(rank('r1', 'bob', ['songA', 'songB', 'songC']), {
    ...DEFAULT_RULES,
    points_cap: 1,
    downvotes: true,
  });
  assert.equal(points.get('songA'), 1);
  assert.equal(points.get('songB'), 0);
  assert.equal(points.get('songC'), -1);
});

const guess = (guesser_id: string, submission_id: string, guessed_user_id: string): Guess => ({
  round_id: 'r1',
  guesser_id,
  submission_id,
  guessed_user_id,
});

test('only correct guesses earn bonus points', () => {
  const submissions = [
    { id: 'a1', user_id: 'anna' },
    { id: 'b1', user_id: 'bob' },
    { id: 'c1', user_id: 'cat' },
  ];
  const points = scoreGuesses(
    [guess('anna', 'b1', 'bob'), guess('anna', 'c1', 'bob'), guess('bob', 'a1', 'cat')],
    submissions
  );
  assert.equal(points.get('anna'), GUESS_BONUS_POINTS);
  assert.equal(points.get('bob'), undefined);
});

test('leaderboard adds guess bonuses to ranking points', () => {
  const submissions = [
    { id: 'a1', user_id: 'anna' },
    { id: 'b1', user_id: 'bob' },
  ];
  const rankings = [...rank('r1', 'anna', ['b1']), ...rank('r1', 'bob', ['a1'])];

  assert.deepEqual(leaderboard(submissions, rankings, ['anna', 'bob'], DEFAULT_RULES, [guess('bob', 'a1', 'anna')]), [
    { userId: 'bob', points: 1 + GUESS_BONUS_POINTS },
    { userId: 'anna', points: 1 },
  ]);
});

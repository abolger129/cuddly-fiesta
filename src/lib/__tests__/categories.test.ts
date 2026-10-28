import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATEGORY_IDEAS, pickCategory } from '../categories.ts';

test('the roulette skips categories the league already has', () => {
  const taken = CATEGORY_IDEAS.slice(1);
  assert.equal(pickCategory([...taken], 0.99), CATEGORY_IDEAS[0]);
});

test('taken categories match regardless of case and spaces', () => {
  const taken = CATEGORY_IDEAS.slice(1).map((c) => `  ${c.toUpperCase()} `);
  assert.equal(pickCategory(taken, 0.5), CATEGORY_IDEAS[0]);
});

test('when every idea is taken, any idea will do', () => {
  assert.equal(pickCategory([...CATEGORY_IDEAS], 0), CATEGORY_IDEAS[0]);
});

test('a random number of 1 still lands on an idea', () => {
  assert.ok(CATEGORY_IDEAS.includes(pickCategory([], 1) as (typeof CATEGORY_IDEAS)[number]));
});

test('there are no duplicate ideas', () => {
  assert.equal(new Set(CATEGORY_IDEAS).size, CATEGORY_IDEAS.length);
});

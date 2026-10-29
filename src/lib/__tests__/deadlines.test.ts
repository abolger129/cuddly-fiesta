import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  activeDeadline,
  describeHours,
  describeNudgeLimit,
  formatTimeLeft,
  isPastDeadline,
  nextNudgeAt,
} from '../deadlines.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

test('timer lengths read naturally', () => {
  assert.equal(describeHours(null), 'No timer');
  assert.equal(describeHours(12), '12 hours');
  assert.equal(describeHours(24), '1 day');
  assert.equal(describeHours(72), '3 days');
  assert.equal(describeHours(168), '1 week');
});

test('time left is rounded down to the most useful unit', () => {
  assert.equal(formatTimeLeft(3 * 24 * HOUR + 5 * HOUR), '3 days');
  assert.equal(formatTimeLeft(24 * HOUR + 4 * HOUR + 10 * MINUTE), '1 day 4 hours');
  assert.equal(formatTimeLeft(24 * HOUR), '1 day');
  assert.equal(formatTimeLeft(5 * HOUR + 59 * MINUTE), '5 hours');
  assert.equal(formatTimeLeft(HOUR + 20 * MINUTE), '1 hour 20 minutes');
  assert.equal(formatTimeLeft(HOUR + 1 * MINUTE), '1 hour 1 minute');
  assert.equal(formatTimeLeft(12 * MINUTE), '12 minutes');
  assert.equal(formatTimeLeft(30_000), 'less than a minute');
});

test('the deadline that counts depends on the stage', () => {
  const round = { submit_deadline: '2026-10-28T12:00:00Z', vote_deadline: '2026-10-30T12:00:00Z' };
  assert.equal(activeDeadline({ ...round, status: 'submitting' })?.toISOString(), '2026-10-28T12:00:00.000Z');
  assert.equal(activeDeadline({ ...round, status: 'voting' })?.toISOString(), '2026-10-30T12:00:00.000Z');
  assert.equal(activeDeadline({ ...round, status: 'finished' }), null);
  assert.equal(activeDeadline({ status: 'submitting', submit_deadline: null, vote_deadline: null }), null);
});

test('a round is past its deadline only while that stage is running', () => {
  const now = new Date('2026-10-29T00:00:00Z');
  const round = { submit_deadline: '2026-10-28T12:00:00Z', vote_deadline: '2026-10-30T12:00:00Z' };
  assert.equal(isPastDeadline({ ...round, status: 'submitting' }, now), true);
  assert.equal(isPastDeadline({ ...round, status: 'voting' }, now), false);
  assert.equal(isPastDeadline({ ...round, status: 'upcoming' }, now), false);
});

test('nudge limits read naturally', () => {
  assert.equal(describeNudgeLimit(null), 'Off');
  assert.equal(describeNudgeLimit(15), 'Every 15 minutes');
  assert.equal(describeNudgeLimit(60), 'Once an hour');
  assert.equal(describeNudgeLimit(360), 'Every 6 hours');
  assert.equal(describeNudgeLimit(1440), 'Once a day');
  assert.equal(describeNudgeLimit(2880), 'Every 2 days');
});

test('the next nudge waits out the host\'s cooldown', () => {
  assert.equal(nextNudgeAt(null, null), null);
  assert.equal(nextNudgeAt('2026-10-29T10:00:00Z', null), null);
  assert.equal(nextNudgeAt(null, 60)?.getTime(), 0);
  assert.equal(nextNudgeAt('2026-10-29T10:00:00Z', 360)?.toISOString(), '2026-10-29T16:00:00.000Z');
});

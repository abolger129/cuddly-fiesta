import assert from 'node:assert/strict';
import { test } from 'node:test';

import { trackLabel } from '../track-labels.ts';

const labels = (total: number) => Array.from({ length: total }, (_, i) => trackLabel(i, total));

test('splits songs across side A and side B', () => {
  assert.deepEqual(labels(1), ['A1']);
  assert.deepEqual(labels(3), ['A1', 'A2', 'B1']);
  assert.deepEqual(labels(6), ['A1', 'A2', 'A3', 'B1', 'B2', 'B3']);
});

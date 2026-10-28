import assert from 'node:assert/strict';
import { test } from 'node:test';

import { strokesToPath } from '../doodle.ts';

test('strokes scale onto the 100 unit canvas', () => {
  const path = strokesToPath([[{ x: 0, y: 0 }, { x: 100, y: 200 }]], 200);
  assert.equal(path, 'M0 0L50 100');
});

test('each stroke starts a new line', () => {
  const path = strokesToPath(
    [
      [{ x: 10, y: 10 }, { x: 20, y: 10 }],
      [{ x: 30, y: 30 }, { x: 30, y: 40 }],
    ],
    100
  );
  assert.equal(path, 'M10 10L20 10M30 30L30 40');
});

test('points that barely moved are dropped', () => {
  const path = strokesToPath([[{ x: 10, y: 10 }, { x: 10.5, y: 10.5 }, { x: 20, y: 10 }]], 100);
  assert.equal(path, 'M10 10L20 10');
});

test('a tap becomes a dot', () => {
  assert.equal(strokesToPath([[{ x: 10, y: 10 }]], 100), 'M10 10L10.5 10');
});

test('points off the pad are kept on the canvas', () => {
  assert.equal(strokesToPath([[{ x: -5, y: 50 }, { x: 120, y: 50 }]], 100), 'M0 50L100 50');
});

test('no strokes, no path', () => {
  assert.equal(strokesToPath([], 100), '');
  assert.equal(strokesToPath([[]], 100), '');
});

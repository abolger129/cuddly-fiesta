import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BLOCKED_NAME, maskBlocked, withoutBlocked } from '../blocking.ts';

test('blocked players lose their name and avatar, others are untouched', () => {
  const members = [
    { id: 'a', display_name: 'Anna', avatar_doodle: 'M0 0' },
    { id: 'b', display_name: 'Bob', avatar_doodle: 'M1 1' },
  ];
  const masked = maskBlocked(members, new Set(['b']));
  assert.deepEqual(masked[0], members[0]);
  assert.deepEqual(masked[1], { id: 'b', display_name: BLOCKED_NAME, avatar_doodle: null, avatar_sticker: null });
  assert.equal(members[1].display_name, 'Bob');
});

test('things written by blocked players are dropped', () => {
  const items = [
    { user_id: 'a', category: 'Songs about rain' },
    { user_id: 'b', category: 'Rude one' },
  ];
  assert.deepEqual(withoutBlocked(items, new Set(['b'])), [items[0]]);
  assert.deepEqual(withoutBlocked(items, new Set()), items);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AVATAR_BACKGROUNDS,
  cleanDoodlePath,
  doodleStrokeWidth,
  initialsOf,
  isHexColor,
  isLightColor,
  isSticker,
  limitDoodlePath,
  MAX_DOODLE_LENGTH,
  strokesToPath,
} from '../doodle.ts';

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

test('small avatars get thicker lines, big ones keep the normal width', () => {
  assert.equal(doodleStrokeWidth(240), 3);
  assert.equal(doodleStrokeWidth(72), 3);
  assert.ok(doodleStrokeWidth(28) > 6);
  assert.ok(doodleStrokeWidth(28) > doodleStrokeWidth(32));
});

test('initials come from the first and last word of a name', () => {
  assert.equal(initialsOf('Anna Bolger'), 'AB');
  assert.equal(initialsOf('anna marie bolger'), 'AB');
  assert.equal(initialsOf('Anna'), 'A');
  assert.equal(initialsOf('Anna Bolger', 1), 'A');
  assert.equal(initialsOf('  '), '?');
});

test('only #RRGGBB colors and known stickers are accepted', () => {
  assert.ok(isHexColor('#3156F5'));
  assert.ok(!isHexColor('blue'));
  assert.ok(!isHexColor('#fff'));
  assert.ok(!isHexColor(null));
  assert.ok(isSticker('sunglasses'));
  assert.ok(!isSticker('crown'));
  assert.ok(!isSticker(null));
});

test('light backgrounds get dark ink', () => {
  assert.ok(isLightColor('#FFD43B'));
  assert.ok(isLightColor('#FAFAF8'));
  assert.ok(!isLightColor('#2B4FE0'));
  assert.ok(!isLightColor('#15151B'));
  for (const bg of AVATAR_BACKGROUNDS) assert.equal(typeof isLightColor(bg), 'boolean');
});

test('a doodle cut off partway through a command keeps only the whole commands', () => {
  assert.equal(cleanDoodlePath('M10 10L20 20L3'), 'M10 10L20 20');
  assert.equal(cleanDoodlePath('M10 10L20 20L'), 'M10 10L20 20');
  assert.equal(cleanDoodlePath('M10 10L20.'), 'M10 10');
  assert.equal(cleanDoodlePath('M10 10L20 20M5 5L6 6'), 'M10 10L20 20M5 5L6 6');
});

test('a doodle that starts partway through still starts with a move', () => {
  assert.equal(cleanDoodlePath('0 5L10 10L20 20'), 'M10 10L20 20');
  assert.equal(cleanDoodlePath('MNaN NaNL1 2'), 'M1 2');
  assert.equal(cleanDoodlePath(''), '');
  assert.equal(cleanDoodlePath(null), '');
});

test('long doodles are cut at the end of a whole command', () => {
  const long = Array.from({ length: 2000 }, (_, i) => `${i === 0 ? 'M' : 'L'}${i % 100}.5 ${i % 97}.5`).join('');
  const limited = limitDoodlePath(long);
  assert.ok(limited.length <= MAX_DOODLE_LENGTH);
  assert.equal(cleanDoodlePath(limited), limited);
  assert.ok(long.startsWith(limited));
});

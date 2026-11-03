import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AVATAR_BACKGROUNDS,
  cleanDoodlePath,
  DEFAULT_BRUSH,
  doodleLines,
  doodleStrokeWidth,
  initialsOf,
  isHexColor,
  isLightColor,
  isSticker,
  joinDoodles,
  lastBrush,
  limitDoodlePath,
  MAX_DOODLE_LENGTH,
  strokesToPath,
  type Point,
} from '../doodle.ts';

/** Strokes drawn with the default brush. */
const medium = (...strokes: Point[][]) => strokes.map((points) => ({ points, brush: DEFAULT_BRUSH }));

test('strokes scale onto the 100 unit canvas', () => {
  const path = strokesToPath(medium([{ x: 0, y: 0 }, { x: 100, y: 200 }]), 200);
  assert.equal(path, 'M0 0L50 100');
});

test('each stroke starts a new line', () => {
  const path = strokesToPath(
    medium(
      [{ x: 10, y: 10 }, { x: 20, y: 10 }],
      [{ x: 30, y: 30 }, { x: 30, y: 40 }]
    ),
    100
  );
  assert.equal(path, 'M10 10L20 10M30 30L30 40');
});

test('points that barely moved are dropped', () => {
  const path = strokesToPath(medium([{ x: 10, y: 10 }, { x: 10.5, y: 10.5 }, { x: 20, y: 10 }]), 100);
  assert.equal(path, 'M10 10L20 10');
});

test('a tap becomes a dot', () => {
  assert.equal(strokesToPath(medium([{ x: 10, y: 10 }]), 100), 'M10 10L10.5 10');
});

test('points off the pad are kept on the canvas', () => {
  assert.equal(strokesToPath(medium([{ x: -5, y: 50 }, { x: 120, y: 50 }]), 100), 'M0 50L100 50');
});

test('no strokes, no path', () => {
  assert.equal(strokesToPath([], 100), '');
  assert.equal(strokesToPath(medium([]), 100), '');
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

test('a change of brush is marked before the stroke, and only when it changes', () => {
  const path = strokesToPath(
    [
      { points: [{ x: 10, y: 10 }, { x: 20, y: 10 }], brush: 6 },
      { points: [{ x: 30, y: 30 }, { x: 30, y: 40 }], brush: 6 },
      { points: [{ x: 50, y: 50 }, { x: 60, y: 50 }], brush: DEFAULT_BRUSH },
    ],
    100
  );
  assert.equal(path, 'W6M10 10L20 10M30 30L30 40W3M50 50L60 50');
  assert.equal(lastBrush(path), DEFAULT_BRUSH);
  assert.equal(lastBrush('W10M1 1L2 2'), 10);
});

test('doodles split into plain path data per brush, with no marks left in it', () => {
  assert.deepEqual(doodleLines('M1 1L2 2W6M3 3L4 4W3M5 5L6 6'), [
    { width: 3, d: 'M1 1L2 2' },
    { width: 6, d: 'M3 3L4 4' },
    { width: 3, d: 'M5 5L6 6' },
  ]);
  for (const line of doodleLines('W10M1 1L2 2W1.5M3 3')) assert.match(line.d, /^M[\d. ML]+$/);
});

test('doodles saved before brushes draw as one medium line, exactly as before', () => {
  assert.deepEqual(doodleLines('M10 10L20 20M5 5L6 6'), [{ width: DEFAULT_BRUSH, d: 'M10 10L20 20M5 5L6 6' }]);
  assert.equal(cleanDoodlePath('M10 10L20 20'), 'M10 10L20 20');
});

test('bad brush marks are kept in range or skipped, and a line never starts without a move', () => {
  assert.deepEqual(doodleLines('W999M1 1L2 2'), [{ width: 12, d: 'M1 1L2 2' }]);
  assert.deepEqual(doodleLines('W0M1 1'), [{ width: 1, d: 'M1 1' }]);
  assert.deepEqual(doodleLines('WM1 1W'), [{ width: DEFAULT_BRUSH, d: 'M1 1' }]);
  // A brush change partway through a line carries on from the last point.
  assert.deepEqual(doodleLines('M1 1L2 2W6L3 3'), [
    { width: 3, d: 'M1 1L2 2' },
    { width: 6, d: 'M2 2L3 3' },
  ]);
  assert.equal(cleanDoodlePath('W6M1 1L2 2W3M3 3L4'), 'W6M1 1L2 2W3M3 3');
  assert.equal(cleanDoodlePath('W6'), '');
});

test('new strokes after a saved doodle switch back to their own brush', () => {
  assert.equal(joinDoodles('W6M1 1L2 2', 'M3 3L4 4'), 'W6M1 1L2 2W3M3 3L4 4');
  assert.equal(joinDoodles('W6M1 1L2 2', 'W10M3 3'), 'W6M1 1L2 2W10M3 3');
  assert.equal(joinDoodles('M1 1L2 2', 'M3 3'), 'M1 1L2 2M3 3');
  assert.equal(joinDoodles(null, 'W6M3 3'), 'W6M3 3');
});

test('long doodles with brush marks are cut at a whole command', () => {
  const long = Array.from({ length: 1500 }, (_, i) => `${i % 50 === 0 ? `W${i % 100 ? 6 : 3}M` : 'L'}${i % 100}.5 ${i % 97}.5`).join('');
  const limited = limitDoodlePath(long);
  assert.ok(limited.length <= MAX_DOODLE_LENGTH);
  assert.equal(cleanDoodlePath(limited), limited);
});

test('thick brushes stay thick when small, fine ones are thickened enough to see', () => {
  assert.equal(doodleStrokeWidth(300, 1.5), 1.5);
  assert.equal(doodleStrokeWidth(300, 10), 10);
  assert.equal(doodleStrokeWidth(32, 10), 10);
  assert.ok(doodleStrokeWidth(32, 1.5) > 6);
});

/**
 * Doodle avatars: what a player draws with their finger, stored as SVG path data
 * on a 100 by 100 canvas so it draws the same at any size.
 */

export type Point = { x: number; y: number };

/** The doodle canvas is 100 units square, whatever size it's drawn at. */
export const DOODLE_SIZE = 100;
/** The database keeps doodles up to this many characters. */
export const MAX_DOODLE_LENGTH = 12000;

/** Points closer than this (in canvas units) to the last kept point are dropped. */
const MIN_STEP = 1.5;

/**
 * Turn strokes drawn on a pad of padSize points into path data on the 100 unit canvas.
 * Points are rounded and thinned out so the result stays small.
 */
export function strokesToPath(strokes: Point[][], padSize: number): string {
  const scale = DOODLE_SIZE / padSize;
  return strokes
    .map((stroke) => {
      const kept: Point[] = [];
      for (const p of stroke) {
        const q = { x: clamp(round(p.x * scale)), y: clamp(round(p.y * scale)) };
        const last = kept[kept.length - 1];
        if (!last || Math.hypot(q.x - last.x, q.y - last.y) >= MIN_STEP) kept.push(q);
      }
      if (kept.length === 0) return '';
      // A tap leaves a single point: draw it as a dot.
      if (kept.length === 1) kept.push({ x: kept[0].x + 0.5, y: kept[0].y });
      return kept.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('');
    })
    .filter(Boolean)
    .join('');
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number): number {
  return Math.min(DOODLE_SIZE, Math.max(0, n));
}

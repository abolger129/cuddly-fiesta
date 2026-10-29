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

/** Colors a player can pick for the circle behind their doodle. */
export const AVATAR_BACKGROUNDS = [
  '#2B4FE0',
  '#C2361C',
  '#0A7A61',
  '#6A2FD0',
  '#B8245A',
  '#146A85',
  '#9A5200',
  '#15151B',
  '#FFD43B',
  '#FFB3C7',
  '#A8E6CF',
  '#FAFAF8',
] as const;

/** Colors a player can draw with. */
export const AVATAR_INKS = ['#FFFFFF', '#15151B', '#3156F5', '#E8482A', '#0E9F7E', '#FFD43B', '#D6336C', '#7B3FE4'] as const;

/** The ink a doodle is drawn in until the player picks one: white, on their name color. */
export const DEFAULT_INK = '#FFFFFF';

/** Stickers a player can put on their doodle. The crown isn't one: it goes to whoever leads the league. */
export const STICKERS = [
  { id: 'sunglasses', label: 'Sunglasses' },
  { id: 'headphones', label: 'Headphones' },
  { id: 'party-hat', label: 'Party hat' },
  { id: 'top-hat', label: 'Top hat' },
  { id: 'bow', label: 'Bow' },
  { id: 'star', label: 'Star' },
] as const;

export type StickerId = (typeof STICKERS)[number]['id'];

/** Where a sticker goes on the canvas until the player moves it: up top, where a head usually is. */
export const DEFAULT_STICKER_SPOT: Point = { x: 50, y: 30 };

export function isSticker(id: string | null | undefined): id is StickerId {
  return STICKERS.some((s) => s.id === id);
}

/** True for a #RRGGBB color, the only kind the database keeps. */
export function isHexColor(color: string | null | undefined): color is string {
  return typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * How thick to draw doodle lines, in canvas units, for an avatar this many points wide.
 * Small avatars get thicker lines so a drawing still reads as a drawing, not a smudge.
 */
export function doodleStrokeWidth(size: number): number {
  const minPoints = 2;
  return Math.max(3, Math.round(((minPoints * DOODLE_SIZE) / Math.max(size, 1)) * 10) / 10);
}

/** One or two letters from a name, for the badge on a doodle avatar. */
export function initialsOf(name: string, max: 1 | 2 = 2): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? [...words[0]].slice(0, 1) : [words[0], words[words.length - 1]].map((w) => [...w][0]);
  return letters.slice(0, max).join('').toUpperCase();
}

/** Whether ink shows up on a background: picks white or black text for a badge or label. */
export function isLightColor(hex: string): boolean {
  if (!isHexColor(hex)) return true;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  // Relative luminance, close enough for choosing between black and white.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
}

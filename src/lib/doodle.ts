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
 * Brush sizes, as line widths on the 100 unit canvas. A doodle switches brush with a
 * "W<width>" mark before a stroke, e.g. "W6M10 10L20 20". Doodles saved before brushes
 * existed have no marks and draw with the medium brush, as they always did. The marks
 * are never handed to the SVG renderer: doodleLines splits a doodle into plain path data
 * per width first.
 */
export const BRUSHES = [
  { id: 'fine', label: 'Fine', width: 1.5 },
  { id: 'medium', label: 'Medium', width: 3 },
  { id: 'thick', label: 'Thick', width: 6 },
  { id: 'marker', label: 'Marker', width: 10 },
] as const;

/** The brush every doodle starts with, and the width of doodles drawn before brushes. */
export const DEFAULT_BRUSH = 3;
const MIN_BRUSH = 1;
const MAX_BRUSH = 12;

export type Stroke = { points: Point[]; brush: number };

/**
 * Turn strokes drawn on a pad of padSize points into path data on the 100 unit canvas.
 * Points are rounded and thinned out so the result stays small. The result starts out
 * with the default brush, and marks each change of brush.
 */
export function strokesToPath(strokes: Stroke[], padSize: number): string {
  const scale = DOODLE_SIZE / padSize;
  let brush: number = DEFAULT_BRUSH;
  let out = '';
  for (const stroke of strokes) {
    const kept: Point[] = [];
    for (const p of stroke.points) {
      const q = { x: clamp(round(p.x * scale)), y: clamp(round(p.y * scale)) };
      const last = kept[kept.length - 1];
      if (!last || Math.hypot(q.x - last.x, q.y - last.y) >= MIN_STEP) kept.push(q);
    }
    if (kept.length === 0) continue;
    // A tap leaves a single point: draw it as a dot.
    if (kept.length === 1) kept.push({ x: kept[0].x + 0.5, y: kept[0].y });
    const width = brushWidth(stroke.brush);
    if (width !== brush) out += `W${width}`;
    brush = width;
    out += kept.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('');
  }
  return out;
}

/**
 * Put new strokes after a saved doodle. The new strokes start out with the default brush,
 * so if the saved doodle ended on another one, switch back first.
 */
export function joinDoodles(base: string | null | undefined, added: string): string {
  const start = base ?? '';
  if (!start || !added) return start + added;
  const reset = lastBrush(start) !== DEFAULT_BRUSH && !added.startsWith('W') ? `W${DEFAULT_BRUSH}` : '';
  return start + reset + added;
}

/** The brush width a doodle ends on, so you know what the next stroke would be drawn with. */
export function lastBrush(path: string): number {
  let brush: number = DEFAULT_BRUSH;
  for (const token of tokens(path)) if (token.kind === 'W') brush = token.width;
  return brush;
}

const NUMBER = String.raw`(-?\d*\.?\d+)`;
const COMMAND = new RegExp(String.raw`([ML])\s*${NUMBER}[\s,]+${NUMBER}|W\s*${NUMBER}`, 'g');

type Token = { kind: 'M' | 'L'; x: number; y: number } | { kind: 'W'; width: number };

/** The whole, numeric commands in a doodle, in order. Anything else is skipped. */
function* tokens(path: string): Generator<Token> {
  for (const [, cmd, x, y, w] of path.matchAll(COMMAND)) {
    if (cmd) {
      const nx = Number(x);
      const ny = Number(y);
      if (Number.isFinite(nx) && Number.isFinite(ny)) yield { kind: cmd as 'M' | 'L', x: nx, y: ny };
    } else {
      const width = Number(w);
      if (Number.isFinite(width)) yield { kind: 'W', width: brushWidth(width) };
    }
  }
}

/** A brush width kept to what the painter offers, give or take, so a bad mark can't flood the circle. */
function brushWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_BRUSH;
  return Math.min(MAX_BRUSH, Math.max(MIN_BRUSH, round(width)));
}

/**
 * Keep only whole "M x y" / "L x y" commands with real numbers, starting with a move,
 * and the brush marks between them. iPhones close the app outright on path data that
 * ends partway through a command (react-native-svg reads past the end of the text), so
 * every saved doodle goes through this before it is drawn. Browsers just stop drawing
 * at the bad part.
 */
export function cleanDoodlePath(path: string | null | undefined): string {
  if (!path) return '';
  return doodleLines(path)
    .map((line, i) => (i === 0 && line.width === DEFAULT_BRUSH ? '' : `W${line.width}`) + line.d)
    .join('');
}

/**
 * A doodle split into runs of plain SVG path data, one per brush width, ready to draw.
 * Each run starts with a move, and brush marks never end up in the path data.
 */
export function doodleLines(path: string | null | undefined): { width: number; d: string }[] {
  if (!path) return [];
  const lines: { width: number; d: string }[] = [];
  let width: number = DEFAULT_BRUSH;
  let current: { width: number; d: string } | null = null;
  let last: Point | null = null;
  for (const token of tokens(path)) {
    if (token.kind === 'W') {
      width = token.width;
      continue;
    }
    if (!current || current.width !== width) {
      current = { width, d: '' };
      lines.push(current);
      // A line carried over a change of brush starts from where the last one ended.
      if (token.kind === 'L' && last) current.d = `M${last.x} ${last.y}`;
    }
    current.d += `${current.d === '' ? 'M' : token.kind}${token.x} ${token.y}`;
    last = { x: token.x, y: token.y };
  }
  return lines;
}

/** Cut a doodle down to what the database keeps, at the end of a whole command. */
export function limitDoodlePath(path: string): string {
  const clean = cleanDoodlePath(path);
  if (clean.length <= MAX_DOODLE_LENGTH) return clean;
  const cut = clean.slice(0, MAX_DOODLE_LENGTH + 1);
  const lastCommand = Math.max(cut.lastIndexOf('M'), cut.lastIndexOf('L'), cut.lastIndexOf('W'));
  return cleanDoodlePath(cut.slice(0, lastCommand));
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
 * Small avatars get thicker lines so a drawing still reads as a drawing, not a smudge:
 * a fine line is drawn at least about 2 points wide, and thick brushes stay as thick as they are.
 */
export function doodleStrokeWidth(size: number, brush: number = DEFAULT_BRUSH): number {
  const minPoints = 2;
  return Math.max(brush, Math.round(((minPoints * DOODLE_SIZE) / Math.max(size, 1)) * 10) / 10);
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

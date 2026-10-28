/**
 * The Liner Notes look: clean paper and ink, with each round and league getting its own
 * record-sleeve color. Album art does most of the visual work.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#15151B',
    background: '#FAFAF8',
    backgroundElement: '#F0F0EC',
    backgroundSelected: '#E4E4DF',
    textSecondary: '#6D6E78',
    /** Hairline rules between tracks and under section labels. */
    rule: '#E3E3E0',
    accent: '#15151B',
    onAccent: '#FAFAF8',
    danger: '#D93025',
  },
  dark: {
    text: '#F2F1EC',
    background: '#121216',
    backgroundElement: '#1C1C22',
    backgroundSelected: '#2A2A31',
    textSecondary: '#A3A4AE',
    rule: '#2C2C33',
    accent: '#F2F1EC',
    onAccent: '#121216',
    danger: '#FF6B5E',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Sleeve colors for rounds and leagues. All of them carry white text, in light and dark mode.
 */
export const SleeveColors = ['#2445FF', '#E8482A', '#0E9F7E', '#7B3FE4', '#D6336C', '#1B7F9E'] as const;
export const OnSleeve = '#FFFFFF';

/** A round's sleeve color, by its number. */
export function roundColor(roundNumber: number): string {
  return SleeveColors[(roundNumber - 1 + SleeveColors.length) % SleeveColors.length];
}

/** A steady sleeve color for anything with an id, such as a league. */
export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return SleeveColors[Math.abs(hash) % SleeveColors.length];
}

/**
 * Font families loaded in the root layout. Custom fonts pick their weight by family name,
 * so each weight is its own entry.
 */
export const Fonts = {
  body: 'BricolageGrotesque_400Regular',
  medium: 'BricolageGrotesque_500Medium',
  bold: 'BricolageGrotesque_700Bold',
  display: 'BricolageGrotesque_800ExtraBold',
  mono: 'IBMPlexMono_400Regular',
  monoBold: 'IBMPlexMono_600SemiBold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

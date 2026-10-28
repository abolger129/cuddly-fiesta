import { Image } from 'expo-image';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Anna's hand-drawn linework from the app icon, used as accents around the app.
 * The images are white lines on transparent, so they can be tinted any color.
 */

const FIGURE_RATIO = 164 / 117;

/** The stick figure from the app icon, cowering. Ink by default, so it works in light and dark mode. */
export function Figure({ height = 72, color, label }: { height?: number; color?: string; label?: string }) {
  const theme = useTheme();
  return (
    <Image
      source={require('@/assets/images/doodles/figure.png')}
      style={{ height, width: height / FIGURE_RATIO }}
      tintColor={color ?? theme.text}
      accessible={!!label}
      accessibilityLabel={label}
    />
  );
}

/** The whole icon drawing: the stick figure surrounded by microphones. White, for cobalt backgrounds. */
export function Linework({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Image
      source={require('@/assets/images/doodles/linework.png')}
      style={[{ width: size, height: size }, style as object]}
      accessible={false}
    />
  );
}

/** A loose pen circle drawn around something, like marking the winner on a scoresheet. */
export function ScribbleCircle({
  width,
  height,
  color = Brand,
  style,
}: {
  width: number;
  height: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 70 34"
      preserveAspectRatio="none"
      style={style}
      pointerEvents="none"
      accessible={false}>
      <Path
        d="M40 3 C 14 1, 3 10, 6 20 C 9 32, 54 33, 64 21 C 70 12, 58 3, 30 5"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </Svg>
  );
}

/** A wobbly underline, drawn by hand. */
export function ScribbleUnderline({ width, color = Brand }: { width: number; color?: string }) {
  return (
    <Svg width={width} height={14} viewBox="0 0 210 14" preserveAspectRatio="none" accessible={false}>
      <Path
        d="M2 9 C 40 3, 80 12, 120 6 S 190 4, 207 8"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </Svg>
  );
}

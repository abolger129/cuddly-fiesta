import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Fonts, OnBrand, colorForId } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DOODLE_SIZE } from '@/lib/doodle';
import type { Profile } from '@/lib/types';

type AvatarProps = {
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_doodle'>;
  size?: number;
};

/** A player's own drawing in a circle, or the first letter of their name until they draw one. */
export function Avatar({ profile, size = 32 }: AvatarProps) {
  const theme = useTheme();
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (profile.avatar_doodle) {
    return (
      <View style={[box, styles.circle, { backgroundColor: theme.backgroundElement, borderColor: theme.rule }]}>
        <Doodle path={profile.avatar_doodle} size={size} color={theme.text} />
      </View>
    );
  }
  const initial = (profile.display_name.trim()[0] ?? '?').toUpperCase();
  return (
    <View style={[box, styles.circle, styles.initial, { backgroundColor: colorForId(profile.id) }]}>
      <ThemedText style={{ color: OnBrand, fontFamily: Fonts.bold, fontSize: size * 0.45, lineHeight: size * 0.6 }}>
        {initial}
      </ThemedText>
    </View>
  );
}

/** Draws doodle path data at any size. */
export function Doodle({ path, size, color }: { path: string; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${DOODLE_SIZE} ${DOODLE_SIZE}`} accessible={false}>
      <Path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  circle: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  initial: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
});

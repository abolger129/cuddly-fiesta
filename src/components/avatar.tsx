import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Crown, StickerArt } from '@/components/avatar-stickers';
import { ThemedText } from '@/components/themed-text';
import { Fonts, playerColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  DEFAULT_INK,
  DEFAULT_STICKER_SPOT,
  DOODLE_SIZE,
  doodleStrokeWidth,
  initialsOf,
  isHexColor,
  isLightColor,
  isSticker,
  type Point,
  type StickerId,
} from '@/lib/doodle';
import type { Profile } from '@/lib/types';

type AvatarProfile = Pick<Profile, 'id' | 'display_name'> &
  Partial<Pick<Profile, 'avatar_doodle' | 'avatar_bg' | 'avatar_ink' | 'avatar_sticker' | 'avatar_sticker_x' | 'avatar_sticker_y'>>;

type AvatarProps = {
  profile: AvatarProfile;
  size?: number;
  /** The player's name color in this league. Used behind the doodle unless they picked their own. */
  color?: string;
  /** Put the crown on: this player is leading the league. */
  crown?: boolean;
};

/** How an avatar is colored and decorated, from what the player picked. */
export type AvatarLook = { background: string; ink: string; sticker: StickerId | null; spot: Point };

export function avatarLook(profile: AvatarProfile, color?: string): AvatarLook {
  const background = isHexColor(profile.avatar_bg)
    ? profile.avatar_bg
    : (color ?? playerColor(profile.id, [], 'light'));
  const ink = isHexColor(profile.avatar_ink)
    ? profile.avatar_ink
    : isLightColor(background)
      ? '#15151B'
      : DEFAULT_INK;
  return {
    background,
    ink,
    sticker: isSticker(profile.avatar_sticker) ? profile.avatar_sticker : null,
    spot: {
      x: profile.avatar_sticker_x ?? DEFAULT_STICKER_SPOT.x,
      y: profile.avatar_sticker_y ?? DEFAULT_STICKER_SPOT.y,
    },
  };
}

/**
 * A player's own drawing on a circle in their color, with their sticker, a badge with their
 * initials, and a crown if they're leading. Until they draw one it's the first letter of their name.
 */
export function Avatar({ profile, size = 32, color, crown = false }: AvatarProps) {
  const theme = useTheme();
  const look = avatarLook(profile, color);
  const box = { width: size, height: size, borderRadius: size / 2 };
  const showBadge = !!profile.avatar_doodle && size >= 24;
  const badge = Math.max(12, Math.round(size * (size >= 48 ? 0.34 : 0.42)));
  const crownWidth = Math.round(size * 0.62);

  return (
    <View style={{ width: size, height: size }}>
      <View style={[box, styles.circle, { backgroundColor: look.background, borderColor: theme.rule }]}>
        {profile.avatar_doodle ? (
          <DoodleArt path={profile.avatar_doodle} size={size} look={look} />
        ) : (
          <>
            <ThemedText
              style={{ color: look.ink, fontFamily: Fonts.bold, fontSize: size * 0.45, lineHeight: size * 0.6 }}>
              {initialsOf(profile.display_name, 1)}
            </ThemedText>
            {look.sticker && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <DoodleArt path="" size={size} look={look} />
              </View>
            )}
          </>
        )}
      </View>
      {showBadge && (
        <View
          style={[
            styles.badge,
            {
              width: badge,
              height: badge,
              borderRadius: badge / 2,
              right: -badge * 0.18,
              bottom: -badge * 0.18,
              backgroundColor: theme.text,
              borderColor: theme.background,
            },
          ]}>
          <ThemedText
            style={{ color: theme.background, fontFamily: Fonts.bold, fontSize: badge * 0.5, lineHeight: badge * 0.62 }}>
            {initialsOf(profile.display_name, size >= 48 ? 2 : 1)}
          </ThemedText>
        </View>
      )}
      {crown && (
        <View
          style={[styles.crown, { top: -crownWidth * 0.48, left: -crownWidth * 0.22 }]}
          pointerEvents="none"
          accessible
          accessibilityLabel="Leading the league">
          <Crown width={crownWidth} />
        </View>
      )}
    </View>
  );
}

/** A doodle in its ink, with its sticker on top, at any size. */
export function DoodleArt({ path, size, look }: { path: string; size: number; look: AvatarLook }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${DOODLE_SIZE} ${DOODLE_SIZE}`} accessible={false}>
      {path ? <DoodlePath path={path} size={size} color={look.ink} /> : null}
      {look.sticker && <StickerArt id={look.sticker} x={look.spot.x} y={look.spot.y} />}
    </Svg>
  );
}

/** Doodle path data inside an Svg on the 100 unit canvas. Lines get thicker as the avatar gets smaller. */
export function DoodlePath({ path, size, color }: { path: string; size: number; color: string }) {
  return (
    <Path
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={doodleStrokeWidth(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

const styles = StyleSheet.create({
  circle: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  crown: {
    position: 'absolute',
    transform: [{ rotate: '-20deg' }],
  },
});

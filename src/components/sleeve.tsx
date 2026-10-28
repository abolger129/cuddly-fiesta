import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, OnSleeve, Spacing } from '@/constants/theme';

type SleeveProps = PropsWithChildren<{
  /** The sleeve's background color, from SleeveColors. */
  color: string;
  title: string;
  /** Small caption above the title, e.g. "Vol. 2 · Ranking". */
  kicker?: string;
  /** Shown top right, e.g. a status stamp. */
  stamp?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}>;

/** A colored record sleeve with a record peeking out, used to head a league or a round. */
export function Sleeve({ color, title, kicker, stamp, onPress, style, children }: SleeveProps) {
  const sleeve = (
    <View style={[styles.sleeve, { backgroundColor: color }, style]}>
      <View style={styles.record} pointerEvents="none">
        <View style={styles.groove} />
        <View style={[styles.recordLabel, { backgroundColor: color }]} />
      </View>
      {(kicker || stamp) && (
        <View style={styles.top}>
          {kicker ? (
            <ThemedText type="label" style={styles.kicker} numberOfLines={1}>
              {kicker}
            </ThemedText>
          ) : (
            <View />
          )}
          {stamp}
        </View>
      )}
      <ThemedText type="display" style={styles.title}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
  if (!onPress) return sleeve;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      {sleeve}
    </Pressable>
  );
}

/** A small outlined stamp, like the sticker on a record sleeve. */
export function Stamp({ text, color = OnSleeve }: { text: string; color?: string }) {
  return (
    <View style={[styles.stamp, { borderColor: color }]}>
      <ThemedText type="label" style={[styles.stampText, { color }]}>
        {text}
      </ThemedText>
    </View>
  );
}

/** A solid, slightly crooked sticker that shouts for attention, like "Your turn". */
export function Sticker({ text }: { text: string }) {
  return (
    <View style={styles.sticker}>
      <ThemedText type="label" style={styles.stickerText}>
        {text}
      </ThemedText>
    </View>
  );
}

const RECORD_SIZE = 150;

const styles = StyleSheet.create({
  sleeve: {
    borderRadius: Spacing.one,
    padding: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
    overflow: 'hidden',
    minHeight: 132,
    justifyContent: 'flex-end',
  },
  record: {
    position: 'absolute',
    width: RECORD_SIZE,
    height: RECORD_SIZE,
    borderRadius: RECORD_SIZE / 2,
    right: -RECORD_SIZE / 2,
    top: -RECORD_SIZE / 4,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groove: {
    position: 'absolute',
    width: RECORD_SIZE - 28,
    height: RECORD_SIZE - 28,
    borderRadius: (RECORD_SIZE - 28) / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  recordLabel: {
    width: 44,
    height: 44,
    borderRadius: 22,
    opacity: 0.9,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: 'auto',
    paddingBottom: Spacing.three,
  },
  kicker: {
    color: OnSleeve,
    opacity: 0.85,
    flexShrink: 1,
  },
  title: {
    color: OnSleeve,
  },
  stamp: {
    borderWidth: 1.5,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  stampText: {
    fontSize: 10,
    lineHeight: 14,
  },
  sticker: {
    backgroundColor: OnSleeve,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    transform: [{ rotate: '3deg' }],
  },
  stickerText: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: Fonts.monoBold,
    color: Colors.light.text,
  },
  pressed: {
    opacity: 0.8,
  },
});

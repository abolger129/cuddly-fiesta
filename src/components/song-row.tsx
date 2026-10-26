import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SongRowProps = {
  trackName: string;
  artistName: string;
  albumArtUrl?: string | null;
  /** Shown before the album art, e.g. a rank number. */
  leading?: ReactNode;
  /** Shown at the end of the row, e.g. points or a drag handle. */
  trailing?: ReactNode;
};

export function SongRow({ trackName, artistName, albumArtUrl, leading, trailing }: SongRowProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {leading}
      {albumArtUrl ? (
        <Image source={albumArtUrl} style={styles.art} />
      ) : (
        <View style={[styles.art, { backgroundColor: theme.backgroundSelected }]} />
      )}
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {trackName}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {artistName}
        </ThemedText>
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  art: {
    width: 44,
    height: 44,
    borderRadius: Spacing.one,
  },
  text: {
    flex: 1,
  },
});

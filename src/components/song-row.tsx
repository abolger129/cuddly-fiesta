import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AlbumArt } from '@/components/album-art';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type SongRowProps = {
  trackName: string;
  artistName: string;
  albumArtUrl?: string | null;
  /** Cover size in points. */
  artSize?: number;
  /** Shown before the album art, e.g. a track number. */
  leading?: ReactNode;
  /** Shown at the end of the row, e.g. points or a drag handle. */
  trailing?: ReactNode;
  /** Extra line under the artist, e.g. who picked it. */
  credit?: ReactNode;
};

export function SongRow({
  trackName,
  artistName,
  albumArtUrl,
  artSize = 48,
  leading,
  trailing,
  credit,
}: SongRowProps) {
  return (
    <View style={styles.row}>
      {leading}
      <AlbumArt url={albumArtUrl} size={artSize} seed={`${trackName}·${artistName}`} />
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {trackName}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {artistName}
        </ThemedText>
        {credit}
      </View>
      {trailing}
    </View>
  );
}

/** A record-style track number such as A1, sized to line up down a list. */
export function TrackNumber({ label }: { label: string }) {
  return (
    <ThemedText type="mono" themeColor="textSecondary" style={styles.track}>
      {label}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  text: {
    flex: 1,
  },
  track: {
    width: 24,
  },
});

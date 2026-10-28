import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colorForId } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AlbumArtProps = {
  url?: string | null;
  size?: number;
  /** Used to pick a steady sleeve color when there is no cover. */
  seed: string;
  /** Draw a hard offset shadow, for featured covers. */
  raised?: boolean;
};

/**
 * A song's cover. Songs without one (typed in by hand) get a plain colored sleeve
 * with a record label in the middle instead of an empty grey box.
 */
export function AlbumArt({ url, size = 48, seed, raised }: AlbumArtProps) {
  const theme = useTheme();
  const offset = raised ? Math.max(3, Math.round(size / 24)) : 2;
  const box = { width: size, height: size, borderRadius: Math.max(2, Math.round(size / 24)) };

  return (
    <View style={{ width: size + offset, height: size + offset }}>
      <View
        style={[
          styles.shadow,
          box,
          { left: offset, top: offset, backgroundColor: raised ? theme.text : theme.backgroundSelected },
        ]}
      />
      {url ? (
        <Image source={url} style={box} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[box, styles.blank, { backgroundColor: colorForId(seed) }]}>
          <View
            style={[
              styles.hole,
              { width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18 },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
  },
  blank: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hole: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
});

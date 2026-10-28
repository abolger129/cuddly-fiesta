import * as Sharing from 'expo-sharing';
import { useRef, useState, type ComponentRef } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Button } from '@/components/button';
import { Linework } from '@/components/doodles';
import { ThemedText } from '@/components/themed-text';
import { Brand, Fonts, OnBrand, Spacing } from '@/constants/theme';

export type ShareLine = { number: string; title: string; detail: string; points?: string };

type ShareCardProps = {
  kicker: string;
  title: string;
  lines: ShareLine[];
  /** What gets shared as text where a picture can't be, such as on the web. */
  fallbackMessage: string;
};

/**
 * A results poster in the app's cobalt, with Anna's drawing, that players can send
 * to the group chat or post as a story. It's shared as a picture.
 */
export function ShareCard({ kicker, title, lines, fallbackMessage }: ShareCardProps) {
  const card = useRef<ComponentRef<typeof View>>(null);
  const [sharing, setSharing] = useState(false);

  async function share() {
    setSharing(true);
    try {
      if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
        const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
      } else {
        await Share.share({ message: fallbackMessage });
      }
    } catch {
      // If the picture couldn't be made, share the results as text instead.
      await Share.share({ message: fallbackMessage }).catch(() => {});
    } finally {
      setSharing(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View ref={card} collapsable={false} style={styles.card}>
        <Linework size={220} style={styles.linework} />
        <ThemedText type="label" style={styles.kicker} numberOfLines={2}>
          {kicker}
        </ThemedText>
        <ThemedText type="display" style={styles.title}>
          {title}
        </ThemedText>
        <View style={styles.lines}>
          {lines.map((line) => (
            <View key={line.number} style={styles.line}>
              <ThemedText type="mono" style={styles.number}>
                {line.number}
              </ThemedText>
              <View style={styles.grow}>
                <ThemedText type="smallBold" style={styles.onBrand} numberOfLines={1}>
                  {line.title}
                </ThemedText>
                <ThemedText type="mono" style={styles.detail} numberOfLines={1}>
                  {line.detail}
                </ThemedText>
              </View>
              {line.points && (
                <ThemedText type="smallBold" style={styles.points}>
                  {line.points}
                </ThemedText>
              )}
            </View>
          ))}
        </View>
        <ThemedText type="label" style={styles.footer}>
          The Gauntlet
        </ThemedText>
      </View>
      <Button title="Share to the group chat" onPress={share} loading={sharing} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
  },
  card: {
    backgroundColor: Brand,
    borderRadius: Spacing.two,
    padding: Spacing.four,
    paddingTop: 140,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  linework: {
    position: 'absolute',
    top: -30,
    right: -30,
  },
  kicker: {
    color: OnBrand,
    opacity: 0.9,
  },
  title: {
    color: OnBrand,
  },
  lines: {
    marginTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.5)',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.5)',
  },
  number: {
    color: OnBrand,
    width: 24,
  },
  grow: {
    flex: 1,
  },
  onBrand: {
    color: OnBrand,
  },
  detail: {
    color: OnBrand,
    opacity: 0.85,
    fontSize: 11,
  },
  points: {
    color: OnBrand,
    fontFamily: Fonts.display,
    fontSize: 18,
  },
  footer: {
    color: OnBrand,
    marginTop: Spacing.two,
    textAlign: 'right',
  },
});

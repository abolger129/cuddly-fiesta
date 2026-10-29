import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { avatarLook } from '@/components/avatar';
import { StickerArt } from '@/components/avatar-stickers';
import { Button } from '@/components/button';
import { DoodlePad } from '@/components/doodle-pad';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import {
  AVATAR_BACKGROUNDS,
  AVATAR_INKS,
  DEFAULT_STICKER_SPOT,
  STICKERS,
  isLightColor,
  type Point,
  type StickerId,
} from '@/lib/doodle';
import { alertOnError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const MAX_PAD_SIZE = 420;
const SWATCH = 34;

type Style = {
  bg: string | null;
  ink: string | null;
  sticker: StickerId | null;
  spot: Point;
};

/**
 * Drawing your avatar. It has a screen of its own that doesn't scroll and can't be
 * swiped away, so every finger movement goes into the drawing. Below the pad you pick
 * colors and a sticker.
 */
export default function AvatarScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { width, height } = useWindowDimensions();
  const padSize = Math.min(width - Spacing.four * 2, height * 0.4, MAX_PAD_SIZE);
  // undefined until the profile has loaded, so the pad starts from the saved doodle.
  const [doodle, setDoodle] = useState<string | null | undefined>(undefined);
  const [style, setStyle] = useState<Style>({ bg: null, ink: null, sticker: null, spot: DEFAULT_STICKER_SPOT });
  const [movingSticker, setMovingSticker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('avatar_doodle, avatar_bg, avatar_ink, avatar_sticker, avatar_sticker_x, avatar_sticker_y')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        setDoodle(data?.avatar_doodle ?? null);
        if (!data) return;
        const look = avatarLook({ id: userId, display_name: '', ...data });
        setStyle({ bg: data.avatar_bg ?? null, ink: data.avatar_ink ?? null, sticker: look.sticker, spot: look.spot });
      });
  }, [userId]);

  async function save() {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        avatar_doodle: doodle ?? null,
        avatar_bg: style.bg,
        avatar_ink: style.ink,
        avatar_sticker: style.sticker,
        avatar_sticker_x: style.sticker ? style.spot.x : null,
        avatar_sticker_y: style.sticker ? style.spot.y : null,
      })
      .eq('id', userId);
    setSaving(false);
    if (!alertOnError('Could not save your avatar', error)) router.back();
  }

  const look = avatarLook({
    id: userId ?? '',
    display_name: '',
    avatar_bg: style.bg,
    avatar_ink: style.ink,
    avatar_sticker: style.sticker,
    avatar_sticker_x: style.spot.x,
    avatar_sticker_y: style.spot.y,
  });
  const autoColor = avatarLook({ id: userId ?? '', display_name: '' }).background;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {movingSticker ? 'Tap or drag to put your sticker where you want it.' : 'Draw yourself. Stick figures encouraged.'}
        </ThemedText>
        <View style={styles.pad}>
          {doodle !== undefined && (
            <DoodlePad
              initial={doodle}
              onChange={setDoodle}
              look={look}
              onMoveSticker={movingSticker ? (spot) => setStyle((s) => ({ ...s, spot })) : undefined}
              size={padSize}
            />
          )}
        </View>

        <Picker label="Background">
          <Swatch
            color={autoColor}
            selected={style.bg === null}
            label="Your name color"
            text="Auto"
            onPress={() => setStyle((s) => ({ ...s, bg: null }))}
          />
          {AVATAR_BACKGROUNDS.map((c) => (
            <Swatch key={c} color={c} selected={style.bg === c} onPress={() => setStyle((s) => ({ ...s, bg: c }))} />
          ))}
        </Picker>
        <Picker label="Ink">
          {AVATAR_INKS.map((c) => (
            <Swatch
              key={c}
              color={c}
              selected={look.ink === c}
              onPress={() => setStyle((s) => ({ ...s, ink: c }))}
            />
          ))}
        </Picker>
        <Picker label="Sticker">
          <StickerChoice
            id={null}
            selected={style.sticker === null}
            onPress={() => {
              setMovingSticker(false);
              setStyle((s) => ({ ...s, sticker: null }));
            }}
          />
          {STICKERS.map((s) => (
            <StickerChoice
              key={s.id}
              id={s.id}
              label={s.label}
              selected={style.sticker === s.id}
              onPress={() => setStyle((prev) => ({ ...prev, sticker: s.id }))}
            />
          ))}
        </Picker>

        <View style={styles.actions}>
          {style.sticker && (
            <Button
              title={movingSticker ? 'Done moving, back to drawing' : 'Move sticker'}
              variant="secondary"
              onPress={() => setMovingSticker((m) => !m)}
            />
          )}
          <Button title="Save" onPress={save} loading={saving} disabled={doodle === undefined} />
          <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function Picker({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.picker}>
      <ThemedText type="smallBold" style={styles.pickerLabel}>
        {label}
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatches}>
        {children}
      </ScrollView>
    </View>
  );
}

function Swatch({
  color,
  selected,
  onPress,
  label,
  text,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
  label?: string;
  text?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? color}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.ring, { borderColor: selected ? theme.text : 'transparent' }]}>
      <View style={[styles.swatch, { backgroundColor: color, borderColor: theme.rule }]}>
        {text && (
          <ThemedText type="mono" style={{ color: isLightColor(color) ? '#15151B' : '#FFFFFF', fontSize: 10 }}>
            {text}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

function StickerChoice({
  id,
  label,
  selected,
  onPress,
}: {
  id: StickerId | null;
  label?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? 'No sticker'}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.ring, { borderColor: selected ? theme.text : 'transparent' }]}>
      <View style={[styles.swatch, { backgroundColor: theme.backgroundElement, borderColor: theme.rule }]}>
        {id ? (
          <Svg width={SWATCH} height={SWATCH} viewBox="20 20 60 60">
            <StickerArt id={id} x={50} y={50} />
          </Svg>
        ) : (
          <ThemedText type="mono" themeColor="textSecondary" style={{ fontSize: 10 }}>
            None
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
  pad: {
    flex: 1,
    justifyContent: 'center',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pickerLabel: {
    width: 76,
  },
  swatches: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  ring: {
    borderWidth: 2,
    borderRadius: (SWATCH + 8) / 2,
    padding: 2,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actions: {
    gap: Spacing.two,
  },
});

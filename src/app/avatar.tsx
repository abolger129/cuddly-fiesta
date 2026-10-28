import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { DoodlePad } from '@/components/doodle-pad';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { alertOnError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const MAX_PAD_SIZE = 420;

/**
 * Drawing your avatar. It has a screen of its own that doesn't scroll and can't be
 * swiped away, so every finger movement goes into the drawing.
 */
export default function AvatarScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { width } = useWindowDimensions();
  const padSize = Math.min(width - Spacing.four * 2, MAX_PAD_SIZE);
  // undefined until the profile has loaded, so the pad starts from the saved doodle.
  const [doodle, setDoodle] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('avatar_doodle')
      .eq('id', userId)
      .single()
      .then(({ data }) => setDoodle(data?.avatar_doodle ?? null));
  }, [userId]);

  async function save() {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ avatar_doodle: doodle ?? null }).eq('id', userId);
    setSaving(false);
    if (!alertOnError('Could not save your avatar', error)) router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          Draw yourself. Stick figures encouraged.
        </ThemedText>
        <View style={styles.pad}>
          {doodle !== undefined && <DoodlePad initial={doodle} onChange={setDoodle} size={padSize} />}
        </View>
        <View style={styles.actions}>
          <Button title="Save" onPress={save} loading={saving} disabled={doodle === undefined} />
          <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </ThemedView>
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
    gap: Spacing.three,
  },
  centered: {
    textAlign: 'center',
  },
  pad: {
    flex: 1,
    justifyContent: 'center',
  },
  actions: {
    gap: Spacing.two,
  },
});

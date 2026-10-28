import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Avatar } from '@/components/avatar';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { alertOnError } from '@/lib/errors';
import { unregisterPushNotifications } from '@/lib/notifications';
import { disconnectSpotify, isSpotifyConnected } from '@/lib/spotify';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [name, setName] = useState('');
  const [doodle, setDoodle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);

  useEffect(() => {
    isSpotifyConnected().then(setSpotifyConnected);
  }, []);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setName(data.display_name);
      });
  }, [userId]);

  // The avatar is drawn and saved on its own screen, so show the latest one on coming back.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      supabase
        .from('profiles')
        .select('avatar_doodle')
        .eq('id', userId)
        .single()
        .then(({ data }) => setDoodle(data?.avatar_doodle ?? null));
    }, [userId])
  );

  async function save() {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim() })
      .eq('id', userId);
    setSaving(false);
    if (!alertOnError('Could not save your profile', error)) router.back();
  }

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        This is how you appear to your friends on leaderboards and round results.
      </ThemedText>
      <TextField value={name} onChangeText={setName} placeholder="Your name" maxLength={40} />

      <SectionLabel>Your avatar</SectionLabel>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/avatar')}
        style={({ pressed }) => [styles.avatarRow, pressed && styles.pressed]}>
        {userId && <Avatar profile={{ id: userId, display_name: name, avatar_doodle: doodle }} size={72} />}
        <View style={styles.grow}>
          <ThemedText type="smallBold">{doodle ? 'Redraw your avatar' : 'Draw your avatar'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Draw yourself. Stick figures encouraged.
          </ThemedText>
        </View>
      </Pressable>

      <Button title="Save name" onPress={save} loading={saving} disabled={!name.trim()} />
      {spotifyConnected && (
        <Button
          title="Disconnect Spotify"
          variant="secondary"
          onPress={async () => {
            await disconnectSpotify();
            setSpotifyConnected(false);
          }}
        />
      )}
      <Button
        title="Sign out"
        variant="secondary"
        onPress={async () => {
          await unregisterPushNotifications();
          await supabase.auth.signOut();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  grow: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});

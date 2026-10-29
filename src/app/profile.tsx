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
import { confirmDestructive } from '@/lib/confirm';
import { alertOnError } from '@/lib/errors';
import { openPrivacyPolicy, openTerms } from '@/lib/legal';
import { unregisterPushNotifications } from '@/lib/notifications';
import { unblockPlayer } from '@/lib/safety';
import { revokeAppleSignIn } from '@/lib/social-sign-in';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [name, setName] = useState('');
  const [doodle, setDoodle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState<{ id: string; name: string }[]>([]);
  const [deleting, setDeleting] = useState(false);

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

  const loadBlocked = useCallback(() => {
    supabase
      .from('blocks')
      .select('blocked_id, profiles!blocks_blocked_id_fkey (display_name)')
      .then(({ data }) =>
        setBlocked(
          (data ?? []).map((b) => {
            // One profile per block, though the generated types can't tell.
            const profile = b.profiles as unknown as { display_name: string } | null;
            return { id: b.blocked_id, name: profile?.display_name || 'Someone' };
          })
        )
      );
  }, []);

  useEffect(loadBlocked, [loadBlocked]);

  async function deleteAccount() {
    const ok = await confirmDestructive(
      'Delete your account?',
      "This deletes your profile, avatar, songs, rankings, guesses and comments. Leagues you host pass to another player, or are deleted if you're the only one in them. It can't be undone.",
      'Delete account',
    );
    if (!ok) return;
    setDeleting(true);
    await unregisterPushNotifications();
    await revokeAppleSignIn();
    const { error } = await supabase.rpc('delete_my_account');
    if (alertOnError('Could not delete your account', error)) {
      setDeleting(false);
      return;
    }
    // The account is gone, so only clear the session on this device.
    await supabase.auth.signOut({ scope: 'local' });
  }

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
      <Button
        title="Sign out"
        variant="secondary"
        onPress={async () => {
          await unregisterPushNotifications();
          await supabase.auth.signOut();
        }}
      />

      {blocked.length > 0 && (
        <>
          <SectionLabel>Blocked players</SectionLabel>
          {blocked.map((b) => (
            <View key={b.id} style={styles.blockedRow}>
              <ThemedText type="small" style={styles.grow}>
                {b.name}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${b.name}`}
                onPress={async () => {
                  if (await unblockPlayer(b.id)) loadBlocked();
                }}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Unblock
                </ThemedText>
              </Pressable>
            </View>
          ))}
        </>
      )}

      <SectionLabel>About</SectionLabel>
      <View style={styles.links}>
        <Pressable accessibilityRole="link" onPress={openPrivacyPolicy}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
            Privacy policy
          </ThemedText>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={openTerms}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
            Terms of use
          </ThemedText>
        </Pressable>
      </View>
      <Button title="Delete account" variant="secondary" onPress={deleteAccount} loading={deleting} />
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
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  links: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  link: {
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.7,
  },
});

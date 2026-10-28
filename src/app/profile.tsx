import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button } from '@/components/button';
import { DoodlePad } from '@/components/doodle-pad';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth';
import { alertOnError } from '@/lib/errors';
import { unregisterPushNotifications } from '@/lib/notifications';
import { disconnectSpotify, isSpotifyConnected } from '@/lib/spotify';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [name, setName] = useState('');
  // undefined until the profile has loaded, so the pad starts from the saved doodle.
  const [doodle, setDoodle] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);

  useEffect(() => {
    isSpotifyConnected().then(setSpotifyConnected);
  }, []);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('display_name, avatar_doodle')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setName(data.display_name);
        setDoodle(data.avatar_doodle ?? null);
      });
  }, [userId]);

  async function save() {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim(), avatar_doodle: doodle ?? null })
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
      <ThemedText type="small" themeColor="textSecondary">
        Draw yourself. Stick figures encouraged.
      </ThemedText>
      {doodle !== undefined && <DoodlePad initial={doodle} onChange={setDoodle} />}

      <Button title="Save" onPress={save} loading={saving} disabled={!name.trim()} />
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

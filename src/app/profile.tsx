import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth';
import { alertOnError } from '@/lib/errors';
import { disconnectSpotify, isSpotifyConnected } from '@/lib/spotify';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [name, setName] = useState('');
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

  async function save() {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim() })
      .eq('id', userId);
    setSaving(false);
    if (!alertOnError('Could not save your name', error)) router.back();
  }

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        This is how you appear to your friends on leaderboards and round results.
      </ThemedText>
      <TextField value={name} onChangeText={setName} placeholder="Your name" maxLength={40} autoFocus />
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
    </Screen>
  );
}

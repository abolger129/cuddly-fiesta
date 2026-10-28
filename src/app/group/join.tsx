import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { alertOnError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export default function JoinGroupScreen() {
  // Opening an invite link or scanning a QR code fills the code in.
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState((params.code ?? '').toUpperCase().slice(0, 6));
  const [joining, setJoining] = useState(false);

  async function join() {
    setJoining(true);
    const { data, error } = await supabase.rpc('join_group', { code: code.trim() });
    setJoining(false);
    if (alertOnError('Could not join', error)) return;
    router.replace(`/group/${data}`);
  }

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        Ask whoever started the league for its 6-character invite code, or scan the QR code on
        their league screen.
      </ThemedText>
      <TextField
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        placeholder="ABC123"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        autoFocus
      />
      <Button title="Join league" onPress={join} loading={joining} disabled={code.trim().length < 6} />
    </Screen>
  );
}

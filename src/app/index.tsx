import { router } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLoader } from '@/hooks/use-loader';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/lib/types';

export default function GroupsScreen() {
  const loadGroups = useCallback(async () => {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Group[];
  }, []);
  const { data: groups, error, loading, reload } = useLoader(loadGroups);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <View style={styles.actions}>
        <Button title="New group" onPress={() => router.push('/group/new')} style={styles.action} />
        <Button
          title="Join with code"
          variant="secondary"
          onPress={() => router.push('/group/join')}
          style={styles.action}
        />
      </View>

      {groups?.map((group) => (
        <Card key={group.id} onPress={() => router.push(`/group/${group.id}`)}>
          <ThemedText type="smallBold">{group.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {group.total_rounds} {group.total_rounds === 1 ? 'round' : 'rounds'}
          </ThemedText>
        </Card>
      ))}

      {!loading && (error || groups?.length === 0) && (
        <View style={styles.empty}>
          <ThemedText type="smallBold">
            {error ? 'Could not load your groups' : 'No groups yet'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            {error ?? 'Start a group and share the invite code with your friends, or join one with a code.'}
          </ThemedText>
        </View>
      )}

      <View style={styles.footer}>
        <Button title="Settings" variant="secondary" onPress={() => router.push('/profile')} />
        <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.six,
  },
  centered: {
    textAlign: 'center',
  },
  footer: {
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
});

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/lib/types';

export default function GroupsScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    setError(error?.message ?? null);
    setGroups(data ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups])
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={(group) => group.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadGroups} />}
        renderItem={({ item }) => (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">{item.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.total_rounds} rounds · invite code {item.invite_code}
            </ThemedText>
          </ThemedView>
        )}
        ListEmptyComponent={
          loading ? undefined : (
            <ThemedView style={styles.empty}>
              <ThemedText type="smallBold">
                {error ? 'Could not load your groups' : 'No groups yet'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {error ?? 'Creating and joining groups is coming next.'}
              </ThemedText>
            </ThemedView>
          )
        }
        ListFooterComponent={
          <Button
            title="Sign out"
            variant="secondary"
            onPress={() => supabase.auth.signOut()}
            style={styles.signOut}
          />
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.six,
  },
  signOut: {
    marginTop: Spacing.four,
  },
});

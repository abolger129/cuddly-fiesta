import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { StatusLabel } from '@/components/status-label';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLoader } from '@/hooks/use-loader';
import { useAuth } from '@/lib/auth';
import { alertOnError } from '@/lib/errors';
import { loadGroupDetails, nameOf } from '@/lib/group-data';
import { leaderboard } from '@/lib/scoring';
import { supabase } from '@/lib/supabase';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const load = useCallback(() => loadGroupDetails(id), [id]);
  const { data, error, loading, reload } = useLoader(load);
  const [starting, setStarting] = useState(false);

  if (!data) {
    return (
      <Screen refreshing={loading} onRefresh={reload}>
        {error && <ThemedText>{error}</ThemedText>}
      </Screen>
    );
  }

  const { group, members, rounds, submissions, rankings } = data;
  const isCreator = group.created_by === session?.user.id;
  const standings = leaderboard(submissions, rankings, members.map((m) => m.id));
  const finishedCount = rounds.filter((r) => r.status === 'finished').length;
  const nextRound = rounds.find((r) => r.status === 'upcoming');
  const roundInProgress = rounds.some((r) => r.status === 'submitting' || r.status === 'voting');

  async function startRound(roundId: string) {
    setStarting(true);
    const { error } = await supabase.rpc('start_round', { rid: roundId });
    setStarting(false);
    if (alertOnError('Could not start the round', error)) return;
    router.push(`/round/${roundId}`);
  }

  function shareInvite() {
    Share.share({
      message: `Join my group "${group.name}" on The Gauntlet with invite code ${group.invite_code}`,
    });
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Stack.Screen options={{ title: group.name }} />

      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Invite code
        </ThemedText>
        <ThemedText type="subtitle" selectable>
          {group.invite_code}
        </ThemedText>
        <Button title="Share invite" variant="secondary" onPress={shareInvite} />
      </Card>

      <ThemedText type="smallBold">
        {finishedCount === rounds.length ? 'Final standings' : 'Leaderboard'}
      </ThemedText>
      <Card>
        {standings.map((s, i) => (
          <View key={s.userId} style={styles.standing}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.place}>
              {i + 1}
            </ThemedText>
            <ThemedText type="small" style={styles.grow}>
              {nameOf(members, s.userId)}
            </ThemedText>
            <ThemedText type="smallBold">{s.points} pts</ThemedText>
          </View>
        ))}
        {finishedCount === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Points show up here after the first round.
          </ThemedText>
        )}
      </Card>

      {isCreator && nextRound && !roundInProgress && (
        <Button
          title={`Start round ${nextRound.round_number}: ${nextRound.category}`}
          onPress={() => startRound(nextRound.id)}
          loading={starting}
        />
      )}

      <ThemedText type="smallBold">Rounds</ThemedText>
      {rounds.map((round) => (
        <Card key={round.id} onPress={() => router.push(`/round/${round.id}`)}>
          <ThemedText type="small" themeColor="textSecondary">
            Round {round.round_number}
          </ThemedText>
          <ThemedText type="smallBold">{round.category}</ThemedText>
          <StatusLabel status={round.status} />
        </Card>
      ))}

      <ThemedText type="small" themeColor="textSecondary">
        {members.length} {members.length === 1 ? 'player' : 'players'}:{' '}
        {members.map((m) => m.display_name || 'Someone').join(', ')}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  standing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  place: {
    width: 20,
  },
  grow: {
    flex: 1,
  },
});

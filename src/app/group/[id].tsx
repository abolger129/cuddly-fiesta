import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DeadlineLabel } from '@/components/deadline-label';
import { Screen } from '@/components/screen';
import { StatusLabel } from '@/components/status-label';
import { ThemedText } from '@/components/themed-text';
import { TimerPicker } from '@/components/timer-picker';
import { Spacing } from '@/constants/theme';
import { useLoader } from '@/hooks/use-loader';
import { useAuth } from '@/lib/auth';
import { describeHours } from '@/lib/deadlines';
import { alertOnError } from '@/lib/errors';
import { loadGroupDetails, nameOf } from '@/lib/group-data';
import { leaderboard } from '@/lib/scoring';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/lib/types';

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

      <RoundTimers group={group} isCreator={isCreator} onChanged={reload} />

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
          <DeadlineLabel round={round} onExpired={reload} compact />
        </Card>
      ))}

      <ThemedText type="small" themeColor="textSecondary">
        {members.length} {members.length === 1 ? 'player' : 'players'}:{' '}
        {members.map((m) => m.display_name || 'Someone').join(', ')}
      </ThemedText>
    </Screen>
  );
}

function RoundTimers({
  group,
  isCreator,
  onChanged,
}: {
  group: Group;
  isCreator: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [submitHours, setSubmitHours] = useState(group.submit_hours);
  const [voteHours, setVoteHours] = useState(group.vote_hours);
  const [saving, setSaving] = useState(false);

  function edit() {
    setSubmitHours(group.submit_hours);
    setVoteHours(group.vote_hours);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from('groups')
      .update({ submit_hours: submitHours, vote_hours: voteHours })
      .eq('id', group.id);
    setSaving(false);
    if (alertOnError('Could not save the timers', error)) return;
    setEditing(false);
    onChanged();
  }

  const summary =
    group.submit_hours == null && group.vote_hours == null
      ? 'No timers. Each round waits for everyone.'
      : `${group.submit_hours == null ? 'No limit' : describeHours(group.submit_hours)} to pick a song, ${
          group.vote_hours == null ? 'no limit' : describeHours(group.vote_hours)
        } to rank.`;

  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary">
        Round timers
      </ThemedText>
      {editing ? (
        <>
          <TimerPicker label="Time to pick a song" value={submitHours} onChange={setSubmitHours} />
          <TimerPicker label="Time to rank the songs" value={voteHours} onChange={setVoteHours} />
          <ThemedText type="small" themeColor="textSecondary">
            Changes apply from the next time a round opens or ranking starts.
          </ThemedText>
          <Button title="Save timers" onPress={save} loading={saving} />
          <Button title="Cancel" variant="secondary" onPress={() => setEditing(false)} />
        </>
      ) : (
        <>
          <ThemedText type="small">{summary}</ThemedText>
          {isCreator && <Button title="Change timers" variant="secondary" onPress={edit} />}
        </>
      )}
    </Card>
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

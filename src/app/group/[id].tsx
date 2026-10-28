import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { LeaguePlaylistCard } from '@/components/league-playlist-card';
import { Screen } from '@/components/screen';
import { ScoringRulesPicker } from '@/components/scoring-rules-picker';
import { StatusLabel } from '@/components/status-label';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLoader } from '@/hooks/use-loader';
import { useAuth } from '@/lib/auth';
import { alertOnError } from '@/lib/errors';
import { loadGroupDetails, nameOf } from '@/lib/group-data';
import { describeRules, GUESS_BONUS_POINTS, leaderboard, type ScoringRules } from '@/lib/scoring';
import { supabase } from '@/lib/supabase';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const load = useCallback(() => loadGroupDetails(id), [id]);
  const { data, error, loading, reload } = useLoader(load);
  const [starting, setStarting] = useState(false);
  const [savingGuessing, setSavingGuessing] = useState(false);
  const [savingRules, setSavingRules] = useState(false);

  if (!data) {
    return (
      <Screen refreshing={loading} onRefresh={reload}>
        {error && <ThemedText>{error}</ThemedText>}
      </Screen>
    );
  }

  const { group, members, rounds, submissions, rankings, guesses } = data;
  const isCreator = group.created_by === session?.user.id;
  const standings = leaderboard(submissions, rankings, members.map((m) => m.id), group, guesses);
  const finishedCount = rounds.filter((r) => r.status === 'finished').length;
  const nextRound = rounds.find((r) => r.status === 'upcoming');
  const roundInProgress = rounds.some((r) => r.status === 'submitting' || r.status === 'voting');
  const rulesLocked = rounds.some((r) => r.status !== 'upcoming');

  async function saveRules({ points_cap, downvotes }: ScoringRules) {
    setSavingRules(true);
    const { error } = await supabase.from('groups').update({ points_cap, downvotes }).eq('id', group.id);
    setSavingRules(false);
    if (!alertOnError('Could not change the scoring rules', error)) reload();
  }

  async function startRound(roundId: string) {
    setStarting(true);
    const { error } = await supabase.rpc('start_round', { rid: roundId });
    setStarting(false);
    if (alertOnError('Could not start the round', error)) return;
    router.push(`/round/${roundId}`);
  }

  async function setGuessing(enabled: boolean) {
    setSavingGuessing(true);
    const { error } = await supabase.from('groups').update({ guessing_enabled: enabled }).eq('id', group.id);
    setSavingGuessing(false);
    if (!alertOnError('Could not change the setting', error)) reload();
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

      {(isCreator || group.guessing_enabled) && (
        <Card>
          <View style={styles.standing}>
            <ThemedText type="smallBold" style={styles.grow}>
              Guess who picked it
            </ThemedText>
            {isCreator && (
              <Switch
                value={group.guessing_enabled}
                onValueChange={setGuessing}
                disabled={savingGuessing}
                accessibilityLabel="Guess who picked it"
              />
            )}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {group.guessing_enabled
              ? `While ranking, guess who picked each song. Right guesses are worth ${GUESS_BONUS_POINTS} bonus points.`
              : 'Turn on to let players guess who picked each song for bonus points.'}
          </ThemedText>
        </Card>
      )}

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

      <ThemedText type="smallBold">Scoring</ThemedText>
      <Card>
        {isCreator && !rulesLocked ? (
          <>
            <ScoringRulesPicker rules={group} onChange={saveRules} disabled={savingRules} />
            <ThemedText type="small" themeColor="textSecondary">
              You can change this until the first round starts.
            </ThemedText>
          </>
        ) : (
          <ThemedText type="small">{describeRules(group)}</ThemedText>
        )}
      </Card>

      {isCreator && nextRound && !roundInProgress && (
        <Button
          title={`Start round ${nextRound.round_number}: ${nextRound.category}`}
          onPress={() => startRound(nextRound.id)}
          loading={starting}
        />
      )}

      <LeaguePlaylistCard details={data} isCreator={isCreator} onChanged={reload} />

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

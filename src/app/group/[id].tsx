import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Share, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DeadlineLabel } from '@/components/deadline-label';
import { LeaguePlaylistCard } from '@/components/league-playlist-card';
import { Screen } from '@/components/screen';
import { ScoringRulesPicker } from '@/components/scoring-rules-picker';
import { SectionLabel } from '@/components/section-label';
import { Sleeve, Stamp } from '@/components/sleeve';
import { statusText } from '@/components/status-label';
import { ThemedText } from '@/components/themed-text';
import { TimerPicker } from '@/components/timer-picker';
import { colorForId, OnSleeve, roundColor, Spacing } from '@/constants/theme';
import { useLoader } from '@/hooks/use-loader';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { describeHours } from '@/lib/deadlines';
import { alertOnError } from '@/lib/errors';
import { loadGroupDetails, nameOf } from '@/lib/group-data';
import { describeRules, GUESS_BONUS_POINTS, leaderboard, type ScoringRules } from '@/lib/scoring';
import { supabase } from '@/lib/supabase';
import type { Group, Round } from '@/lib/types';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const theme = useTheme();
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
      <Stack.Screen options={{ title: '' }} />

      <Sleeve
        color={colorForId(group.id)}
        kicker={`League · ${members.length} ${members.length === 1 ? 'player' : 'players'}`}
        stamp={<Stamp text={`Code ${group.invite_code}`} />}
        title={group.name}
      />
      <Button title="Share invite" variant="secondary" onPress={shareInvite} />

      {isCreator && nextRound && !roundInProgress && (
        <Button
          title={`Start round ${nextRound.round_number}: ${nextRound.category}`}
          onPress={() => startRound(nextRound.id)}
          loading={starting}
        />
      )}

      <SectionLabel>{finishedCount === rounds.length ? 'Final standings' : 'Standings'}</SectionLabel>
      <View>
        {standings.map((s, i) => (
          <View key={s.userId} style={[styles.standing, { borderBottomColor: theme.rule }]}>
            <ThemedText type="mono" themeColor="textSecondary" style={styles.place}>
              {String(i + 1).padStart(2, '0')}
            </ThemedText>
            <ThemedText type={i === 0 && finishedCount > 0 ? 'smallBold' : 'small'} style={styles.grow}>
              {nameOf(members, s.userId)}
            </ThemedText>
            <ThemedText type="mono">{s.points} pts</ThemedText>
          </View>
        ))}
        {finishedCount === 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Points show up here after the first round.
          </ThemedText>
        )}
      </View>

      <SectionLabel>The shelf</SectionLabel>
      <View style={styles.shelf}>
        {rounds.map((round) => (
          <RoundRecord key={round.id} round={round} onExpired={reload} />
        ))}
      </View>

      <LeaguePlaylistCard details={data} isCreator={isCreator} onChanged={reload} />

      <SectionLabel>House rules</SectionLabel>
      {(isCreator || group.guessing_enabled) && (
        <Card>
          <View style={styles.row}>
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

      <Card>
        <ThemedText type="label" themeColor="textSecondary">
          Scoring
        </ThemedText>
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

      <RoundTimers group={group} isCreator={isCreator} onChanged={reload} />

      <ThemedText type="mono" themeColor="textSecondary">
        Players: {members.map((m) => m.display_name || 'Someone').join(', ')}
      </ThemedText>
    </Screen>
  );
}

/** One round as a square record cover on the league's shelf, in the round's own color. */
function RoundRecord({ round, onExpired }: { round: Round; onExpired: () => void }) {
  const theme = useTheme();
  const notStarted = round.status === 'upcoming';
  const textColor = notStarted ? theme.textSecondary : OnSleeve;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Round ${round.round_number}: ${round.category}, ${statusText(round.status)}`}
      onPress={() => router.push(`/round/${round.id}`)}
      style={({ pressed }) => [
        styles.record,
        { backgroundColor: notStarted ? theme.backgroundSelected : roundColor(round.round_number) },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="label" style={[styles.recordKicker, { color: textColor }]} numberOfLines={2}>
        Vol. {round.round_number}
        {round.status === 'finished' || notStarted ? '' : ` · ${statusText(round.status)}`}
      </ThemedText>
      <View style={styles.recordBottom}>
        <ThemedText type="smallBold" style={[styles.recordTitle, { color: textColor }]} numberOfLines={3}>
          {round.category}
        </ThemedText>
        <DeadlineLabel round={round} onExpired={onExpired} compact style={[styles.recordKicker, { color: textColor }]} />
      </View>
    </Pressable>
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
      <ThemedText type="label" themeColor="textSecondary">
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  standing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  place: {
    width: 24,
  },
  grow: {
    flex: 1,
  },
  note: {
    paddingTop: Spacing.two,
  },
  shelf: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  record: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: Spacing.one,
    padding: Spacing.two,
    justifyContent: 'space-between',
  },
  recordBottom: {
    gap: Spacing.half,
  },
  recordKicker: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.8,
  },
  recordTitle: {
    fontSize: 13,
    lineHeight: 15,
  },
  pressed: {
    opacity: 0.8,
  },
});

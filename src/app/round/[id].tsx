import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { RankingList } from '@/components/ranking-list';
import { Screen } from '@/components/screen';
import { SongRow } from '@/components/song-row';
import { StatusLabel } from '@/components/status-label';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useLoader } from '@/hooks/use-loader';
import { useAuth } from '@/lib/auth';
import { alertOnError } from '@/lib/errors';
import { nameOf } from '@/lib/group-data';
import { loadRoundDetails, type RoundDetails } from '@/lib/round-data';
import { scoreRound } from '@/lib/scoring';
import { supabase } from '@/lib/supabase';
import type { RoundSong } from '@/lib/types';

export default function RoundScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const load = useCallback(() => loadRoundDetails(id, userId), [id, userId]);
  const { data, error, loading, reload } = useLoader(load);

  if (!data) {
    return (
      <Screen refreshing={loading} onRefresh={reload}>
        {error && <ThemedText>{error}</ThemedText>}
      </Screen>
    );
  }

  const title = <Stack.Screen options={{ title: `Round ${data.round.round_number}` }} />;
  const header = <RoundHeader details={data} />;
  const isCreator = data.group.created_by === userId;

  // Ranking uses its own scrolling list so rows can be dragged.
  if (data.round.status === 'voting') {
    return (
      <>
        {title}
        <Voting
          // Start fresh from the saved ranking whenever it changes.
          key={data.rankings.map((r) => r.submission_id).join()}
          details={data}
          isCreator={isCreator}
          header={header}
          onChanged={reload}
        />
      </>
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {title}
      {header}
      {data.round.status === 'upcoming' && (
        <Upcoming details={data} isCreator={isCreator} onChanged={reload} />
      )}
      {data.round.status === 'submitting' && (
        <Submitting details={data} isCreator={isCreator} onChanged={reload} />
      )}
      {data.round.status === 'finished' && <Results details={data} />}
    </Screen>
  );
}

type StageProps = {
  details: RoundDetails;
  isCreator: boolean;
  onChanged: () => void;
};

function RoundHeader({ details }: { details: RoundDetails }) {
  const { round, group } = details;
  return (
    <View style={styles.header}>
      <ThemedText type="small" themeColor="textSecondary">
        {group.name} · Round {round.round_number} of {group.total_rounds}
      </ThemedText>
      <ThemedText type="subtitle">{round.category}</ThemedText>
      <StatusLabel status={round.status} />
    </View>
  );
}

function Upcoming({ details, isCreator, onChanged }: StageProps) {
  const [starting, setStarting] = useState(false);

  async function start() {
    setStarting(true);
    const { error } = await supabase.rpc('start_round', { rid: details.round.id });
    setStarting(false);
    if (!alertOnError('Could not start the round', error)) onChanged();
  }

  if (!isCreator) {
    return (
      <ThemedText themeColor="textSecondary">
        {nameOf(details.members, details.group.created_by)} will open this round when it is time.
      </ThemedText>
    );
  }
  return <Button title="Start this round" onPress={start} loading={starting} />;
}

function Submitting({ details, isCreator, onChanged }: StageProps) {
  const { round, progress, mySubmission } = details;
  const [trackName, setTrackName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const { error } = await supabase.from('submissions').insert({
      round_id: round.id,
      track_name: trackName.trim(),
      artist_name: artistName.trim(),
    });
    setBusy(false);
    if (!alertOnError('Could not submit your song', error)) onChanged();
  }

  async function changePick() {
    if (!mySubmission) return;
    setTrackName(mySubmission.track_name);
    setArtistName(mySubmission.artist_name);
    setBusy(true);
    const { error } = await supabase.from('submissions').delete().eq('id', mySubmission.id);
    setBusy(false);
    if (!alertOnError('Could not change your song', error)) onChanged();
  }

  async function startVoting() {
    setBusy(true);
    const { error } = await supabase.rpc('advance_round', { rid: round.id });
    setBusy(false);
    if (!alertOnError('Could not start ranking', error)) onChanged();
  }

  return (
    <>
      {mySubmission ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Your pick
          </ThemedText>
          <SongRow trackName={mySubmission.track_name} artistName={mySubmission.artist_name} />
          <Button title="Change my pick" variant="secondary" onPress={changePick} loading={busy} />
        </Card>
      ) : (
        <Card>
          <ThemedText type="smallBold">Pick a song that fits</ThemedText>
          <TextField value={trackName} onChangeText={setTrackName} placeholder="Song title" />
          <TextField value={artistName} onChangeText={setArtistName} placeholder="Artist" />
          <Button
            title="Submit song"
            onPress={submit}
            loading={busy}
            disabled={!trackName.trim() || !artistName.trim()}
          />
        </Card>
      )}

      <ThemedText themeColor="textSecondary">
        {progress.submitted_count} of {progress.member_count} players have picked a song. Ranking
        starts once everyone is in.
      </ThemedText>

      {isCreator && progress.submitted_count >= 2 && progress.submitted_count < progress.member_count && (
        <Button
          title="Start ranking without the rest"
          variant="secondary"
          onPress={startVoting}
          loading={busy}
        />
      )}
    </>
  );
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Songs to rank: everyone's but yours, in your saved order or shuffled. */
function initialOrder({ songs, rankings }: RoundDetails): RoundSong[] {
  const others = songs.filter((s) => !s.is_mine);
  if (rankings.length === 0) return shuffle(others);
  const position = new Map(rankings.map((r) => [r.submission_id, r.position]));
  return [...others].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
}

function Voting({
  details,
  isCreator,
  onChanged,
  header,
}: StageProps & { header: ReactElement }) {
  const { round, progress } = details;
  const [order, setOrder] = useState(() => initialOrder(details));
  const [busy, setBusy] = useState(false);
  const mySong = details.songs.find((s) => s.is_mine);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc('submit_ranking', {
      rid: round.id,
      ordered_ids: order.map((s) => s.id),
    });
    setBusy(false);
    if (!alertOnError('Could not save your ranking', error)) onChanged();
  }

  async function endVoting() {
    setBusy(true);
    const { error } = await supabase.rpc('advance_round', { rid: round.id });
    setBusy(false);
    if (!alertOnError('Could not end voting', error)) onChanged();
  }

  return (
    <ThemedView style={styles.fill}>
      <RankingList
        songs={order}
        onChange={setOrder}
        header={
          <View style={styles.votingHeader}>
            {header}
            <ThemedText themeColor="textSecondary">
              {progress.has_ranked
                ? 'Your ranking is saved. You can still change it until everyone has voted.'
                : 'Hold a song and drag it to rank it. Put your favourite at the top.'}
            </ThemedText>
          </View>
        }
        footer={
          <View style={styles.votingFooter}>
            <Button
              title={progress.has_ranked ? 'Update my ranking' : 'Save my ranking'}
              onPress={save}
              loading={busy}
              disabled={order.length === 0}
            />
            {mySong && (
              <ThemedText type="small" themeColor="textSecondary">
                Your song, {mySong.track_name}, is left out because you can&apos;t rank your own pick.
              </ThemedText>
            )}
            <ThemedText type="small" themeColor="textSecondary">
              {progress.ranked_count} of {progress.member_count} players have ranked.
            </ThemedText>
            {isCreator && progress.ranked_count < progress.member_count && (
              <Button
                title="End voting now"
                variant="secondary"
                onPress={endVoting}
                loading={busy}
              />
            )}
          </View>
        }
      />
    </ThemedView>
  );
}

function Results({ details }: { details: RoundDetails }) {
  const { submissions, rankings, members } = details;
  const points = scoreRound(rankings);
  const results = [...submissions].sort((a, b) => (points.get(b.id) ?? 0) - (points.get(a.id) ?? 0));

  return (
    <>
      {results.map((s, i) => (
        <Card key={s.id}>
          <SongRow
            trackName={s.track_name}
            artistName={s.artist_name}
            albumArtUrl={s.album_art_url}
            leading={
              <ThemedText type="smallBold" style={styles.place}>
                {i + 1}
              </ThemedText>
            }
            trailing={<ThemedText type="smallBold">{points.get(s.id) ?? 0} pts</ThemedText>}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Picked by {nameOf(members, s.user_id)}
          </ThemedText>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    gap: Spacing.one,
  },
  votingHeader: {
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  votingFooter: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  place: {
    width: 20,
    textAlign: 'center',
  },
});

import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState, type ReactElement } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DeadlineLabel } from '@/components/deadline-label';
import { GuessPicker } from '@/components/guess-picker';
import { PlaylistCard } from '@/components/playlist-card';
import { RankingList } from '@/components/ranking-list';
import { Screen } from '@/components/screen';
import { SongRow } from '@/components/song-row';
import { SongSearch } from '@/components/song-search';
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
import { describeRules, GUESS_BONUS_POINTS, pointsForPosition, scoreGuesses, scoreRound } from '@/lib/scoring';
import { spotifyTrackUrl, type SpotifyTrack } from '@/lib/spotify';
import { supabase } from '@/lib/supabase';
import type { Guess, Profile, RoundSong, SongComment } from '@/lib/types';

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
  const header = <RoundHeader details={data} onExpired={reload} />;
  const isCreator = data.group.created_by === userId;

  // Ranking uses its own scrolling list so rows can be dragged.
  if (data.round.status === 'voting') {
    return (
      <>
        {title}
        <Voting
          // Start fresh from the saved ranking whenever it changes.
          key={[...data.rankings, ...data.guesses].map((r) => r.submission_id).join()}
          details={data}
          userId={userId}
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
      {data.round.status === 'finished' && (
        <Results details={data} userId={userId} isCreator={isCreator} onChanged={reload} />
      )}
    </Screen>
  );
}

type StageProps = {
  details: RoundDetails;
  isCreator: boolean;
  onChanged: () => void;
};

function RoundHeader({ details, onExpired }: { details: RoundDetails; onExpired: () => void }) {
  const { round, group } = details;
  return (
    <View style={styles.header}>
      <ThemedText type="small" themeColor="textSecondary">
        {group.name} · Round {round.round_number} of {group.total_rounds}
      </ThemedText>
      <ThemedText type="subtitle">{round.category}</ThemedText>
      <StatusLabel status={round.status} />
      <DeadlineLabel round={round} onExpired={onExpired} />
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
  const [typingIn, setTypingIn] = useState(false);
  const [trackName, setTrackName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(song: Omit<SpotifyTrack, 'spotify_track_id'> & { spotify_track_id: string | null }) {
    setBusy(true);
    const { error } = await supabase.from('submissions').insert({ round_id: round.id, ...song });
    setBusy(false);
    if (!alertOnError('Could not submit your song', error)) onChanged();
  }

  async function changePick() {
    if (!mySubmission) return;
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
          <SongRow
            trackName={mySubmission.track_name}
            artistName={mySubmission.artist_name}
            albumArtUrl={mySubmission.album_art_url}
          />
          <Button title="Change my pick" variant="secondary" onPress={changePick} loading={busy} />
        </Card>
      ) : (
        <Card>
          <ThemedText type="smallBold">Pick a song that fits</ThemedText>
          {typingIn ? (
            <>
              <TextField value={trackName} onChangeText={setTrackName} placeholder="Song title" />
              <TextField value={artistName} onChangeText={setArtistName} placeholder="Artist" />
              <ThemedText type="small" themeColor="textSecondary">
                Typed-in songs can&apos;t go on the Spotify playlist.
              </ThemedText>
              <Button
                title="Submit song"
                onPress={() =>
                  submit({
                    spotify_track_id: null,
                    track_name: trackName.trim(),
                    artist_name: artistName.trim(),
                    album_art_url: null,
                  })
                }
                loading={busy}
                disabled={!trackName.trim() || !artistName.trim()}
              />
              <Button title="Search Spotify instead" variant="secondary" onPress={() => setTypingIn(false)} />
            </>
          ) : (
            <>
              <SongSearch onPick={submit} disabled={busy} />
              <Button
                title="Can't find it? Type it in"
                variant="secondary"
                onPress={() => setTypingIn(true)}
              />
            </>
          )}
        </Card>
      )}

      <ThemedText themeColor="textSecondary">
        {progress.submitted_count} of {progress.member_count} players have picked a song. Ranking
        starts once everyone is in{round.submit_deadline ? ' or time runs out' : ''}.
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
  userId,
  isCreator,
  onChanged,
  header,
}: StageProps & { userId: string; header: ReactElement }) {
  const { round, group, progress, members } = details;
  const [order, setOrder] = useState(() => initialOrder(details));
  const [guesses, setGuesses] = useState(
    () => new Map(details.guesses.map((g) => [g.submission_id, g.guessed_user_id]))
  );
  const [comments, setComments] = useState<Record<string, string>>(() =>
    Object.fromEntries(details.comments.map((c) => [c.submission_id, c.body]))
  );
  const [busy, setBusy] = useState(false);
  const mySong = details.songs.find((s) => s.is_mine);
  const otherPlayers = members.filter((m) => m.id !== userId);

  function setGuess(submissionId: string, guessedUserId: string | undefined) {
    setGuesses((current) => {
      const next = new Map(current);
      if (guessedUserId) next.set(submissionId, guessedUserId);
      else next.delete(submissionId);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    // Guesses and comments go first: saving the last ranking finishes the round, which closes both.
    if (group.guessing_enabled) {
      const { error } = await supabase.rpc('save_guesses', {
        rid: round.id,
        submission_ids: [...guesses.keys()],
        guessed_user_ids: [...guesses.values()],
      });
      if (alertOnError('Could not save your guesses', error)) {
        setBusy(false);
        return;
      }
    }
    const commented = order.filter((s) => comments[s.id]?.trim());
    const { error: commentError } = await supabase.rpc('save_song_comments', {
      rid: round.id,
      submission_ids: commented.map((s) => s.id),
      bodies: commented.map((s) => comments[s.id].trim()),
    });
    if (alertOnError('Could not save your comments', commentError)) {
      setBusy(false);
      return;
    }
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
        pointsFor={(position) => pointsForPosition(position, order.length, details.group)}
        comments={comments}
        onCommentChange={(songId, comment) => setComments((current) => ({ ...current, [songId]: comment }))}
        header={
          <View style={styles.votingHeader}>
            {header}
            <PlaylistCard details={details} isCreator={isCreator} onChanged={onChanged} />
            <ThemedText themeColor="textSecondary">
              {progress.has_ranked
                ? `Your ranking is saved. You can still change it until everyone has voted${round.vote_deadline ? ' or time runs out' : ''}.`
                : 'Hold a song and drag it to rank it. Put your favourite at the top. Tap a song to hear it on Spotify.'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {describeRules(details.group)} Comments are anonymous until the round ends, then
              everyone sees who said what.
            </ThemedText>
          </View>
        }
        footer={
          <View style={styles.votingFooter}>
            {group.guessing_enabled && (
              <>
                <View style={styles.header}>
                  <ThemedText type="smallBold">Who picked it?</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Guess who picked each song. Every right guess is worth {GUESS_BONUS_POINTS} bonus
                    points, revealed when the round ends.
                  </ThemedText>
                </View>
                {order.map((song) => (
                  <Card key={song.id}>
                    <ThemedText type="smallBold">{song.track_name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {song.artist_name}
                    </ThemedText>
                    <GuessPicker
                      players={otherPlayers}
                      selected={guesses.get(song.id)}
                      onSelect={(guessed) => setGuess(song.id, guessed)}
                    />
                  </Card>
                ))}
              </>
            )}
            <Button
              title={
                progress.has_ranked
                  ? group.guessing_enabled
                    ? 'Update my ranking and guesses'
                    : 'Update my ranking'
                  : group.guessing_enabled
                    ? 'Save my ranking and guesses'
                    : 'Save my ranking'
              }
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

function Results({ details, userId, isCreator, onChanged }: StageProps & { userId: string }) {
  const { group, submissions, rankings, guesses, members, comments } = details;
  const points = scoreRound(rankings, group);
  const results = [...submissions].sort((a, b) => (points.get(b.id) ?? 0) - (points.get(a.id) ?? 0));
  const guessing = group.guessing_enabled;
  const owner = new Map(submissions.map((s) => [s.id, s.user_id]));
  const isRight = (g: Guess) => owner.get(g.submission_id) === g.guessed_user_id;
  const guessPoints = scoreGuesses(guesses, submissions);
  const guessers = [...new Set(guesses.map((g) => g.guesser_id))]
    .map((id) => ({
      id,
      right: guesses.filter((g) => g.guesser_id === id && isRight(g)).length,
      total: guesses.filter((g) => g.guesser_id === id).length,
    }))
    .sort((a, b) => b.right - a.right);

  return (
    <>
      <PlaylistCard details={details} isCreator={isCreator} onChanged={onChanged} />
      <ThemedText type="smallBold">The reveal</ThemedText>
      {results.map((s, i) => (
        <Card
          key={s.id}
          onPress={s.spotify_track_id ? () => Linking.openURL(spotifyTrackUrl(s.spotify_track_id!)) : undefined}>
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
          {guessing && <GuessReveal submissionId={s.id} guesses={guesses} details={details} userId={userId} />}
          <Comments comments={comments.filter((c) => c.submission_id === s.id)} members={members} />
        </Card>
      ))}
      {guessing && (
        <>
          <ThemedText type="smallBold">Guess bonuses</ThemedText>
          <Card>
            {guessers.map((g) => (
              <View key={g.id} style={styles.bonusRow}>
                <ThemedText type="small" style={styles.grow}>
                  {nameOf(members, g.id)}: {g.right} of {g.total} right
                </ThemedText>
                <ThemedText type="smallBold">+{guessPoints.get(g.id) ?? 0} pts</ThemedText>
              </View>
            ))}
            {guessers.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                Nobody guessed this round.
              </ThemedText>
            )}
          </Card>
        </>
      )}
    </>
  );
}

/** Under a revealed song: your guess, and who guessed it right. */
function GuessReveal({
  submissionId,
  guesses,
  details,
  userId,
}: {
  submissionId: string;
  guesses: Guess[];
  details: RoundDetails;
  userId: string;
}) {
  const { submissions, members } = details;
  const pickedBy = submissions.find((s) => s.id === submissionId)?.user_id;
  const forSong = guesses.filter((g) => g.submission_id === submissionId);
  const mine = forSong.find((g) => g.guesser_id === userId);
  const rightNames = forSong
    .filter((g) => g.guessed_user_id === pickedBy)
    .map((g) => nameOf(members, g.guesser_id));

  return (
    <>
      {mine && (
        <ThemedText type="small">
          {mine.guessed_user_id === pickedBy
            ? `You guessed right! +${GUESS_BONUS_POINTS} pts`
            : `You guessed ${nameOf(members, mine.guessed_user_id)}`}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {rightNames.length ? `Guessed right: ${rightNames.join(', ')}` : 'Nobody guessed it'}
      </ThemedText>
    </>
  );
}

function Comments({ comments, members }: { comments: SongComment[]; members: Profile[] }) {
  if (comments.length === 0) return null;
  return (
    <View style={styles.comments}>
      {comments.map((c) => (
        <ThemedText key={c.voter_id} type="small">
          <ThemedText type="smallBold">{nameOf(members, c.voter_id)}: </ThemedText>
          {c.body}
        </ThemedText>
      ))}
    </View>
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
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  grow: {
    flex: 1,
  },
  comments: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
});

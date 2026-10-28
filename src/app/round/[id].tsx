import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AlbumArt } from '@/components/album-art';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DeadlineLabel } from '@/components/deadline-label';
import { GuessPicker } from '@/components/guess-picker';
import { NudgeButton } from '@/components/nudge-button';
import { PlaylistCard } from '@/components/playlist-card';
import { RankingList } from '@/components/ranking-list';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { ShareCard } from '@/components/share-card';
import { Sleeve } from '@/components/sleeve';
import { SongRow, TrackNumber } from '@/components/song-row';
import { SongSearch } from '@/components/song-search';
import { YoutubeTag } from '@/components/youtube-tag';
import { StatusLabel } from '@/components/status-label';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, roundColor, Spacing } from '@/constants/theme';
import { useLoader } from '@/hooks/use-loader';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { alertOnError } from '@/lib/errors';
import { nameOf } from '@/lib/group-data';
import { loadRoundDetails, type RoundDetails } from '@/lib/round-data';
import { describeRules, GUESS_BONUS_POINTS, pointsForPosition, scoreGuesses, scoreRound } from '@/lib/scoring';
import { songUrl } from '@/lib/song-links';
import { supabase } from '@/lib/supabase';
import { trackLabel } from '@/lib/track-labels';
import type { Guess, Profile, RoundSong, SongComment, Submission } from '@/lib/types';
import { lookUpYoutubeVideo, youtubeThumbnailUrl, youtubeVideoId, youtubeWatchUrl } from '@/lib/youtube';

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
      <Sleeve
        color={roundColor(round.round_number)}
        kicker={`Vol. ${round.round_number} of ${group.total_rounds} · ${group.name}`}
        stamp={<StatusLabel status={round.status} />}
        title={round.category}
      />
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
  const [notOnSpotify, setNotOnSpotify] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(song: NewSong) {
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
          <ThemedText type="label" themeColor="textSecondary">
            Your pick
          </ThemedText>
          <SongRow
            trackName={mySubmission.track_name}
            artistName={mySubmission.artist_name}
            albumArtUrl={mySubmission.album_art_url}
            artSize={72}
            credit={mySubmission.youtube_url ? <YoutubeTag /> : undefined}
          />
          <Button title="Change my pick" variant="secondary" onPress={changePick} loading={busy} />
        </Card>
      ) : (
        <Card>
          <ThemedText type="smallBold">Pick a song that fits</ThemedText>
          {notOnSpotify ? (
            <NotOnSpotifyForm
              onSubmit={submit}
              busy={busy}
              onCancel={() => setNotOnSpotify(false)}
            />
          ) : (
            <>
              <SongSearch onPick={(track) => submit({ ...track, youtube_url: null })} disabled={busy} />
              <Button
                title="Not on Spotify? Add a YouTube link"
                variant="secondary"
                onPress={() => setNotOnSpotify(true)}
              />
            </>
          )}
        </Card>
      )}

      <ThemedText themeColor="textSecondary">
        {progress.submitted_count} of {progress.member_count} players have picked a song. Ranking
        starts once everyone is in{round.submit_deadline ? ' or time runs out' : ''}.
      </ThemedText>

      {progress.member_count - progress.submitted_count - (progress.has_submitted ? 0 : 1) > 0 && (
        <NudgeButton round={round} onChanged={onChanged} />
      )}

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

type NewSong = Omit<Submission, 'id' | 'round_id' | 'user_id'>;

/**
 * For songs that aren't on Spotify: paste a YouTube link (or leave it blank)
 * and say what the song is. The link fills in the title and artist when it can.
 */
function NotOnSpotifyForm({
  onSubmit,
  busy,
  onCancel,
}: {
  onSubmit: (song: NewSong) => void;
  busy: boolean;
  onCancel: () => void;
}) {
  const [link, setLink] = useState('');
  const [trackName, setTrackName] = useState('');
  const [artistName, setArtistName] = useState('');
  const videoId = youtubeVideoId(link);
  const badLink = link.trim() !== '' && !videoId;

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    lookUpYoutubeVideo(videoId).then((video) => {
      if (cancelled || !video) return;
      setTrackName((current) => current || video.title);
      setArtistName((current) => current || video.channel);
    });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  return (
    <>
      <TextField
        value={link}
        onChangeText={setLink}
        placeholder="YouTube link"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      {badLink && (
        <ThemedText type="small" themeColor="danger">
          That doesn&apos;t look like a YouTube video link.
        </ThemedText>
      )}
      <TextField value={trackName} onChangeText={setTrackName} placeholder="Song title" />
      <TextField value={artistName} onChangeText={setArtistName} placeholder="Artist" />
      <ThemedText type="small" themeColor="textSecondary">
        Songs that aren&apos;t on Spotify can&apos;t go on the playlist. Everyone gets a button to play
        it on YouTube instead, and nobody sees who picked it until the round ends.
      </ThemedText>
      <Button
        title="Submit song"
        onPress={() =>
          onSubmit({
            spotify_track_id: null,
            youtube_url: videoId ? youtubeWatchUrl(videoId) : null,
            track_name: trackName.trim(),
            artist_name: artistName.trim(),
            album_art_url: videoId ? youtubeThumbnailUrl(videoId) : null,
          })
        }
        loading={busy}
        disabled={badLink || !trackName.trim() || !artistName.trim()}
      />
      <Button title="Search Spotify instead" variant="secondary" onPress={onCancel} />
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
                : 'Hold a song and drag it to rank it. Put your favourite at the top. Tap a song to hear it.'}
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
                  <SectionLabel>Who picked it?</SectionLabel>
                  <ThemedText type="small" themeColor="textSecondary">
                    Guess who picked each song. Every right guess is worth {GUESS_BONUS_POINTS} bonus
                    points, revealed when the round ends.
                  </ThemedText>
                </View>
                {order.map((song) => (
                  <Card key={song.id}>
                    <SongRow
                      trackName={song.track_name}
                      artistName={song.artist_name}
                      albumArtUrl={song.album_art_url}
                      artSize={40}
                    />
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
            {progress.member_count - progress.ranked_count - (progress.has_ranked ? 0 : 1) > 0 && (
              <NudgeButton round={round} onChanged={onChanged} />
            )}
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
  const { group, round, submissions, rankings, guesses, members, comments } = details;
  const points = scoreRound(rankings, group);
  const results = [...submissions].sort((a, b) => (points.get(b.id) ?? 0) - (points.get(a.id) ?? 0));
  const winner = results[0];
  const theme = useTheme();
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
  const winnerGuesses = winner ? guesses.filter((g) => g.submission_id === winner.id) : [];
  const winnerSpotted = winnerGuesses.filter(isRight).length;
  const shareLines = results.slice(0, 3).map((s, i) => ({
    number: trackLabel(i, results.length),
    title: s.track_name,
    detail: `${s.artist_name} · ${nameOf(members, s.user_id)}`,
    points: String(points.get(s.id) ?? 0),
  }));

  return (
    <>
      {winner && (
        <View style={styles.hero}>
          <AlbumArt url={winner.album_art_url} size={112} seed={`${winner.track_name}·${winner.artist_name}`} raised />
          <View style={styles.heroText}>
            <ThemedText type="label" themeColor="textSecondary">
              Top of the round
            </ThemedText>
            <ThemedText type="subtitle" style={styles.heroTitle} numberOfLines={3}>
              {winner.track_name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {winner.artist_name} · picked by {nameOf(members, winner.user_id)}
            </ThemedText>
          </View>
        </View>
      )}
      {winner && guessing && winnerGuesses.length > 0 && (
        <ThemedText type="hand" themeColor="accent" style={styles.marginNote}>
          {winnerSpotted} of {winnerGuesses.length} guessed {nameOf(members, winner.user_id)}
        </ThemedText>
      )}
      <PlaylistCard details={details} isCreator={isCreator} onChanged={onChanged} />
      <SectionLabel>The credits</SectionLabel>
      <View>
        {results.map((s, i) => {
          const url = songUrl(s);
          return (
            <Pressable
              key={s.id}
              disabled={!url}
              onPress={() => url && Linking.openURL(url)}
              style={({ pressed }) => [styles.credit, { borderBottomColor: theme.rule }, pressed && styles.pressed]}>
              <SongRow
                trackName={s.track_name}
                artistName={s.artist_name}
                albumArtUrl={s.album_art_url}
                leading={<TrackNumber label={trackLabel(i, results.length)} />}
                credit={
                  <>
                    {s.youtube_url && <YoutubeTag />}
                    <ThemedText type="mono" themeColor="textSecondary" numberOfLines={1}>
                      picked by{' '}
                      <ThemedText type="mono" style={styles.creditName}>
                        {nameOf(members, s.user_id)}
                      </ThemedText>
                    </ThemedText>
                  </>
                }
                trailing={
                  <View style={styles.points}>
                    <ThemedText type="subtitle" style={styles.pointsNumber}>
                      {points.get(s.id) ?? 0}
                    </ThemedText>
                    <ThemedText type="mono" themeColor="textSecondary">
                      pts
                    </ThemedText>
                  </View>
                }
              />
              <View style={styles.creditNotes}>
                {guessing && <GuessReveal submissionId={s.id} guesses={guesses} details={details} userId={userId} />}
                <Comments comments={comments.filter((c) => c.submission_id === s.id)} members={members} />
              </View>
            </Pressable>
          );
        })}
      </View>
      {results.length > 0 && (
        <>
          <SectionLabel>Share the results</SectionLabel>
          <ShareCard
            kicker={`Round ${round.round_number} · ${round.category}`}
            title="Top of the round"
            lines={shareLines}
            fallbackMessage={`${group.name}, round ${round.round_number}: ${round.category}\n${shareLines
              .map((l) => `${l.number} ${l.title} (${l.detail}) ${l.points} pts`)
              .join('\n')}`}
          />
        </>
      )}
      {guessing && (
        <>
          <SectionLabel>Guess bonuses</SectionLabel>
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
      {/* Comments read like notes scribbled in the margin. */}
      {comments.map((c) => (
        <ThemedText key={c.voter_id} type="hand" themeColor="textSecondary">
          {nameOf(members, c.voter_id)}: &ldquo;{c.body}&rdquo;
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
    gap: Spacing.two,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.three,
  },
  heroText: {
    flex: 1,
    gap: Spacing.one,
  },
  marginNote: {
    marginTop: -Spacing.two,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 26,
  },
  credit: {
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  creditName: {
    fontFamily: Fonts.monoBold,
  },
  creditNotes: {
    paddingLeft: 24 + Spacing.three,
    gap: Spacing.one,
  },
  points: {
    alignItems: 'flex-end',
  },
  pointsNumber: {
    fontSize: 24,
    lineHeight: 26,
  },
  pressed: {
    opacity: 0.7,
  },
  votingHeader: {
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  votingFooter: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
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

import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AlbumArt } from '@/components/album-art';
import { Avatar } from '@/components/avatar';
import { BannedArtistsEditor, BannedArtistsNote } from '@/components/banned-artists';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DeadlineLabel } from '@/components/deadline-label';
import { GuessPicker } from '@/components/guess-picker';
import { NudgeButton } from '@/components/nudge-button';
import { PlaylistCard } from '@/components/playlist-card';
import { MAX_COMMENT_LENGTH, RankingList } from '@/components/ranking-list';
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
import { Fonts, playerColor, roundColor, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLoader } from '@/hooks/use-loader';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { bannedArtistIn } from '@/lib/banned-artists';
import { confirmChoice } from '@/lib/confirm';
import { alertOnError } from '@/lib/errors';
import { nameOf } from '@/lib/group-data';
import { findSimilarPicks, loadRoundDetails, type RoundDetails } from '@/lib/round-data';
import { reportPlayer } from '@/lib/safety';
import { describeSimilarPicks } from '@/lib/similar-picks';
import {
  describeRules,
  GUESS_BONUS_POINTS,
  pointsForPosition,
  scoreGuesses,
  scoreRound,
  scoreVotesSoFar,
} from '@/lib/scoring';
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

  // Ranking uses its own scrolling list so rows can be dragged. Once your
  // ranking is in, or if you didn't pick a song, there's nothing to drag.
  if (data.round.status === 'voting' && data.progress.has_submitted && !data.progress.has_ranked) {
    return (
      <>
        {title}
        <Voting
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
      {data.round.status === 'voting' && (
        <VotedOrSittingOut details={data} isCreator={isCreator} onChanged={reload} />
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
      <>
        <ThemedText themeColor="textSecondary">
          {nameOf(details.members, details.group.created_by)} will open this round when it is time.
        </ThemedText>
        <BannedArtistsNote leagueBans={details.group.banned_artists} roundBans={details.round.banned_artists} />
      </>
    );
  }
  return (
    <>
      <Button title="Start this round" onPress={start} loading={starting} />
      <RoundBans details={details} onChanged={onChanged} />
    </>
  );
}

/** The host bans artists for just this round, before or while songs are picked. */
function RoundBans({ details, onChanged }: { details: RoundDetails; onChanged: () => void }) {
  const { round, group } = details;

  async function save(banned_artists: string[]) {
    const { error } = await supabase.from('rounds').update({ banned_artists }).eq('id', round.id);
    if (alertOnError('Could not save the banned artists', error)) return false;
    onChanged();
    return true;
  }

  return (
    <BannedArtistsEditor
      title="Banned this round"
      hint={`Nobody can pick a song by these artists this round${
        round.status === 'submitting' ? '. Songs already picked stay in' : ''
      }.${group.banned_artists.length ? ` Banned in the whole league: ${group.banned_artists.join(', ')}.` : ''}`}
      bans={round.banned_artists}
      onSave={save}
    />
  );
}

function Submitting({ details, isCreator, onChanged }: StageProps) {
  const { round, group, progress, mySubmission } = details;
  const bans = [...round.banned_artists, ...group.banned_artists];
  const [notOnSpotify, setNotOnSpotify] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(song: NewSong) {
    setBusy(true);
    // Heads-up if someone else already picked this song, album or artist. It never says who.
    const warning = describeSimilarPicks(await findSimilarPicks(round.id, song), song);
    if (
      warning &&
      !(await confirmChoice(
        'Heads up',
        `${warning} You can still submit it, or go back and pick something else.`,
        'Submit anyway',
        'Pick another'
      ))
    ) {
      setBusy(false);
      return;
    }
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
          <OwnSongComment details={details} submissionId={mySubmission.id} onChanged={onChanged} />
          <Button title="Change my pick" variant="secondary" onPress={changePick} loading={busy} />
        </Card>
      ) : (
        <Card>
          <ThemedText type="smallBold">Pick a song that fits</ThemedText>
          <BannedArtistsNote leagueBans={group.banned_artists} roundBans={round.banned_artists} />
          {notOnSpotify ? (
            <NotOnSpotifyForm
              onSubmit={submit}
              busy={busy}
              bans={bans}
              onCancel={() => setNotOnSpotify(false)}
            />
          ) : (
            <>
              <SongSearch
                onPick={(track) => submit({ ...track, youtube_url: null })}
                disabled={busy}
                bans={bans}
              />
              <Button
                title="Not on Spotify? Add a YouTube link"
                variant="secondary"
                onPress={() => setNotOnSpotify(true)}
              />
            </>
          )}
        </Card>
      )}

      {details.submittedIds && (
        <PlayerChecklist
          title="Who's picked"
          members={details.members}
          statusOf={(id) => (details.submittedIds?.has(id) ? 'done' : 'waiting')}
          labels={{ done: 'Picked ✓', waiting: 'Still picking' }}
        />
      )}
      <ThemedText themeColor="textSecondary">
        {progress.submitted_count} of {progress.member_count} players have picked a song. Ranking
        starts once everyone is in{round.submit_deadline ? ' or time runs out' : ''}.
      </ThemedText>

      {isCreator && <RoundBans details={details} onChanged={onChanged} />}

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

/**
 * A comment on your own song, written while songs are being picked. Like every
 * comment, nobody else sees it until the round ends.
 */
function OwnSongComment({
  details,
  submissionId,
  onChanged,
}: {
  details: RoundDetails;
  submissionId: string;
  onChanged: () => void;
}) {
  const saved = details.comments.find((c) => c.submission_id === submissionId)?.body ?? '';
  const [comment, setComment] = useState(saved);
  const [busy, setBusy] = useState(false);
  const changed = comment.trim() !== saved;

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc('save_my_song_comment', { rid: details.round.id, body: comment });
    setBusy(false);
    if (!alertOnError('Could not save your comment', error)) onChanged();
  }

  return (
    <View style={styles.header}>
      <TextField
        value={comment}
        onChangeText={setComment}
        placeholder="Say something about your song (optional)"
        maxLength={MAX_COMMENT_LENGTH}
        multiline
        accessibilityLabel="Comment on your song"
      />
      <ThemedText type="small" themeColor="textSecondary">
        Only you see it until the round ends, then it shows with the results. You can still change it
        while ranking, until you lock in your ranking.
      </ThemedText>
      {changed && (
        <Button title={comment.trim() ? 'Save comment' : 'Remove comment'} onPress={save} loading={busy} />
      )}
    </View>
  );
}

type PlayerStatus = 'done' | 'waiting' | 'out';

/**
 * Everyone in the league and how far along they are this round: picked or
 * still picking, voted or still voting. Never what they picked or how they voted.
 */
function PlayerChecklist({
  title,
  members,
  statusOf,
  labels,
}: {
  title: string;
  members: Profile[];
  statusOf: (userId: string) => PlayerStatus;
  labels: { done: string; waiting: string; out?: string };
}) {
  const theme = useTheme();
  const order: Record<PlayerStatus, number> = { done: 0, waiting: 1, out: 2 };
  // Done first, then still going, then anyone sitting out, each in name order.
  const sorted = [...members].sort(
    (a, b) =>
      order[statusOf(a.id)] - order[statusOf(b.id)] ||
      (a.display_name || '').localeCompare(b.display_name || '')
  );
  return (
    <View>
      <SectionLabel>{title}</SectionLabel>
      {sorted.map((m) => {
        const status = statusOf(m.id);
        return (
          <View key={m.id} style={[styles.playerRow, { borderBottomColor: theme.rule }]}>
            <Avatar profile={m} size={28} color={playerColor(m.id, members.map((p) => p.id), 'light')} />
            <ThemedText type="small" style={styles.grow} numberOfLines={1}>
              {m.display_name || 'Someone'}
            </ThemedText>
            <ThemedText type="smallBold" themeColor={status === 'done' ? 'accent' : 'textSecondary'}>
              {labels[status]}
            </ThemedText>
          </View>
        );
      })}
    </View>
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
  bans,
  onCancel,
}: {
  onSubmit: (song: NewSong) => void;
  busy: boolean;
  bans: string[];
  onCancel: () => void;
}) {
  const [link, setLink] = useState('');
  const [trackName, setTrackName] = useState('');
  const [artistName, setArtistName] = useState('');
  const videoId = youtubeVideoId(link);
  const badLink = link.trim() !== '' && !videoId;
  const banned = bannedArtistIn(artistName, bans);

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
      {banned && (
        <ThemedText type="small" themeColor="danger">
          {banned} is banned. Pick a song by someone else.
        </ThemedText>
      )}
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
        disabled={badLink || !!banned || !trackName.trim() || !artistName.trim()}
      />
      <Button title="Search Spotify instead" variant="secondary" onPress={onCancel} />
    </>
  );
}

/**
 * Songs to rank: everyone's but yours, in the round's shuffled order (the same
 * order as the playlist), so nothing hints at who picked first.
 */
function initialOrder({ songs }: RoundDetails): RoundSong[] {
  return songs.filter((s) => !s.is_mine);
}

function Voting({
  details,
  userId,
  isCreator,
  onChanged,
  header,
}: StageProps & { userId: string; header: ReactElement }) {
  const { round, group, members } = details;
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
    const ok = await confirmChoice(
      'Lock in your ranking?',
      group.guessing_enabled
        ? "Once it's saved you can't change your ranking, guesses or comments."
        : "Once it's saved you can't change your ranking or comments.",
      'Lock it in'
    );
    if (!ok) return;
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
    // Your own song isn't ranked, but you can still comment on it.
    const commented = [...order, ...(mySong ? [mySong] : [])].filter((s) => comments[s.id]?.trim());
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
            <PlaylistCard details={details} />
            <ThemedText themeColor="textSecondary">
              Hold a song and drag it to rank it. Put your favourite at the top. Tap a song to hear it.
              Once you save, your ranking is locked in and you&apos;ll see the points so far.
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {describeRules(details.group)} Tap Add a comment under any song to say something about
              it{mySong ? ', and say something about your own song at the bottom' : ''}. Only you see
              your comments until the round ends, then everyone sees who said what. They&apos;re saved
              with your ranking.
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
                    Guess who picked each song. Each right guess is worth {GUESS_BONUS_POINTS} bonus
                    point, revealed when the round ends.
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
            {mySong && (
              <Card>
                <ThemedText type="label" themeColor="textSecondary">
                  Your song
                </ThemedText>
                <SongRow
                  trackName={mySong.track_name}
                  artistName={mySong.artist_name}
                  albumArtUrl={mySong.album_art_url}
                  artSize={40}
                  credit={mySong.youtube_url ? <YoutubeTag /> : undefined}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  You can&apos;t rank your own pick, but you can say something about it. Nobody sees it
                  until the round ends.
                </ThemedText>
                <TextField
                  value={comments[mySong.id] ?? ''}
                  onChangeText={(comment) => setComments((current) => ({ ...current, [mySong.id]: comment }))}
                  placeholder="Say something about your song"
                  maxLength={MAX_COMMENT_LENGTH}
                  multiline
                  accessibilityLabel="Comment on your song"
                />
              </Card>
            )}
            <Button
              title={group.guessing_enabled ? 'Lock in my ranking and guesses' : 'Lock in my ranking'}
              onPress={save}
              loading={busy}
              disabled={order.length === 0}
            />
            <VotingProgress details={details} isCreator={isCreator} onChanged={onChanged} />
          </View>
        }
      />
    </ThemedView>
  );
}

/** Players who can vote this round: those who picked a song and are still in the league. */
function voterCount({ progress }: RoundDetails): number {
  // Before the migration that adds it, everyone who picked a song can vote.
  return progress.voter_count ?? progress.submitted_count;
}

/** How many players have ranked, with a nudge and the host's "End voting now". */
function VotingProgress({ details, isCreator, onChanged }: StageProps) {
  const { round, progress } = details;
  const [ending, setEnding] = useState(false);
  const voters = voterCount(details);
  const stillToRank = voters - progress.ranked_count;
  const othersToRank = stillToRank - (progress.has_submitted && !progress.has_ranked ? 1 : 0);

  async function endVoting() {
    setEnding(true);
    const { error } = await supabase.rpc('advance_round', { rid: round.id });
    setEnding(false);
    if (!alertOnError('Could not end voting', error)) onChanged();
  }

  const { voterStatus, members } = details;

  return (
    <>
      {voterStatus && (
        <PlayerChecklist
          title="Who's voted"
          members={members}
          statusOf={(id) => (!voterStatus.has(id) ? 'out' : voterStatus.get(id) ? 'done' : 'waiting')}
          labels={{ done: 'Voted ✓', waiting: 'Still voting', out: 'Sitting out' }}
        />
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {progress.ranked_count} of {voters} players have ranked. Only players who picked a song this round can vote.
      </ThemedText>
      {othersToRank > 0 && <NudgeButton round={round} onChanged={onChanged} />}
      {isCreator && stillToRank > 0 && (
        <Button title="End voting now" variant="secondary" onPress={endVoting} loading={ending} />
      )}
    </>
  );
}

/** While ranking is open, for players who've locked in their ranking or didn't pick a song. */
function VotedOrSittingOut({ details, isCreator, onChanged }: StageProps) {
  const { progress, songs, votesSoFar, group } = details;
  const theme = useTheme();
  const points = scoreVotesSoFar(votesSoFar, group);
  const standings = [...songs].sort((a, b) => (points.get(b.id) ?? 0) - (points.get(a.id) ?? 0));

  return (
    <>
      <PlaylistCard details={details} />
      <Card>
        <ThemedText type="smallBold">
          {progress.has_ranked ? 'Your ranking is locked in.' : "You didn't pick a song this round, so you're sitting it out."}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {progress.has_ranked
            ? "Here are the points so far. Who picked what is revealed when everyone's voted."
            : "Only players who picked a song can vote. You're back in next round. Meanwhile, here's how the songs are doing."}
        </ThemedText>
      </Card>
      <SectionLabel>Points so far</SectionLabel>
      <View>
        {standings.map((s, i) => (
          <View key={s.id} style={[styles.credit, { borderBottomColor: theme.rule }]}>
            <SongRow
              trackName={s.track_name}
              artistName={s.artist_name}
              albumArtUrl={s.album_art_url}
              leading={<TrackNumber label={trackLabel(i, standings.length)} />}
              credit={
                s.is_mine ? (
                  <ThemedText type="mono" themeColor="textSecondary">
                    your pick
                  </ThemedText>
                ) : undefined
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
          </View>
        ))}
      </View>
      {group.guessing_enabled && (
        <ThemedText type="small" themeColor="textSecondary">
          Guess bonuses (+{GUESS_BONUS_POINTS} per right guess) are added when the round ends.
        </ThemedText>
      )}
      <VotingProgress details={details} isCreator={isCreator} onChanged={onChanged} />
    </>
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
      <PlaylistCard details={details} />
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
                <Comments
                  comments={comments.filter((c) => c.submission_id === s.id)}
                  pickedBy={s.user_id}
                  members={members}
                  userId={userId}
                  onBlocked={onChanged}
                />
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
            ? `You guessed right! +${GUESS_BONUS_POINTS} pt`
            : `You guessed ${nameOf(members, mine.guessed_user_id)}`}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {rightNames.length ? `Guessed right: ${rightNames.join(', ')}` : 'Nobody guessed it'}
      </ThemedText>
    </>
  );
}

function Comments({
  comments,
  pickedBy,
  members,
  userId,
  onBlocked,
}: {
  comments: SongComment[];
  /** Who picked the song, so their own comment on it can say so. */
  pickedBy: string;
  members: Profile[];
  userId: string | undefined;
  onBlocked: () => void;
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  if (comments.length === 0) return null;
  const memberIds = members.map((m) => m.id);
  return (
    <View style={styles.comments}>
      {/* Comments sit in the margin like liner notes. Each player's name and margin line get their own color. */}
      {comments.map((c) => {
        const color = playerColor(c.voter_id, memberIds, scheme);
        return (
          <View key={c.voter_id} style={[styles.commentRow, { borderLeftColor: color }]}>
            <View style={styles.grow}>
              <ThemedText type="smallBold" style={{ color }}>
                {nameOf(members, c.voter_id)}
                {c.voter_id === pickedBy && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {' '}
                    · their pick
                  </ThemedText>
                )}
              </ThemedText>
              <ThemedText>{c.body}</ThemedText>
            </View>
            {c.voter_id !== userId && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Report ${nameOf(members, c.voter_id)}'s comment`}
                hitSlop={8}
                onPress={async () => {
                  const blocked = await reportPlayer(
                    { id: c.voter_id, name: nameOf(members, c.voter_id) },
                    c.submission_id
                  );
                  if (blocked) onBlocked();
                }}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="mono" themeColor="textSecondary">
                  Report
                </ThemedText>
              </Pressable>
            )}
          </View>
        );
      })}
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
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderLeftWidth: 3,
    paddingLeft: Spacing.three,
  },
});

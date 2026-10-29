import { maskBlocked } from '@/lib/blocking';
import { check } from '@/lib/db';
import { isPastDeadline } from '@/lib/deadlines';
import { loadBlockedIds } from '@/lib/safety';
import type { VoteSoFar } from '@/lib/scoring';
import type { PickedSong } from '@/lib/similar-picks';
import { supabase } from '@/lib/supabase';
import type {
  Group,
  Guess,
  Profile,
  Ranking,
  Round,
  RoundProgress,
  RoundSong,
  SimilarPicks,
  SongComment,
  Submission,
} from '@/lib/types';

export type RoundDetails = {
  round: Round;
  group: Group;
  progress: RoundProgress;
  mySubmission: Submission | null;
  /** Every song in the round, once voting has started. Who picked them is hidden. */
  songs: RoundSong[];
  /** Your saved ranking (while voting) or everyone's (once finished). */
  rankings: Ranking[];
  /** Who picked what, once the round is finished. */
  submissions: Submission[];
  /** Your saved guesses (while voting) or everyone's (once finished). */
  guesses: Guess[];
  members: Profile[];
  /** Your own comments (while voting) or everyone's (once finished). */
  comments: SongComment[];
  /** Players you blocked. Their names and avatars are already hidden in members. */
  blockedIds: Set<string>;
  /** Who has picked a song so far, while songs are being picked. Null if that can't be loaded. */
  submittedIds: Set<string> | null;
  /**
   * The votes in so far while ranking is open, without who cast them. Only for
   * players who have ranked or who are sitting the round out; empty otherwise.
   */
  votesSoFar: VoteSoFar[];
  /**
   * While ranking is open: each player who picked a song, and whether they've
   * ranked yet (never how). Null if that can't be loaded.
   */
  voterStatus: Map<string, boolean> | null;
};

export async function loadRoundDetails(roundId: string, userId: string): Promise<RoundDetails> {
  const fetchRound = () =>
    supabase.from('rounds').select('*').eq('id', roundId).single().then(check<Round>);
  let round = await fetchRound();
  // Time is up: move the round on now rather than waiting for the scheduled job.
  if (isPastDeadline(round, new Date())) {
    await supabase.rpc('close_expired_rounds', { gid: round.group_id }).then(check);
    round = await fetchRound();
  }

  const [group, progressRows, mySubmission, songs, rankings, submissions, memberRows, guesses, comments, blockedIds, submitters, votesSoFar, voterStatus] =
    await Promise.all([
      supabase.from('groups').select('*').eq('id', round.group_id).single().then(check<Group>),
      supabase.rpc('round_progress', { rid: roundId }).then(check<RoundProgress[]>),
      supabase
        .from('submissions')
        .select('*')
        .eq('round_id', roundId)
        .eq('user_id', userId)
        .maybeSingle()
        .then(check<Submission | null>),
      supabase.rpc('round_songs', { rid: roundId }).then(check<RoundSong[]>),
      supabase.from('rankings').select('*').eq('round_id', roundId).then(check<Ranking[]>),
      round.status === 'finished'
        ? supabase.from('submissions').select('*').eq('round_id', roundId).then(check<Submission[]>)
        : Promise.resolve([]),
      supabase
        .from('group_members')
        .select('profiles (id, display_name, avatar_doodle)')
        .eq('group_id', round.group_id)
        .then(check<{ profiles: Profile }[]>),
      supabase.from('guesses').select('*').eq('round_id', roundId).then(check<Guess[]>),
      supabase
        .from('song_comments')
        .select('round_id, submission_id, voter_id, body')
        .eq('round_id', roundId)
        .order('created_at')
        .then(check<SongComment[]>),
      loadBlockedIds(),
      // Shown as a nice-to-have: if this fails the screen falls back to a count.
      round.status === 'submitting'
        ? supabase.rpc('round_submitters', { rid: roundId }).then(({ data, error }) =>
            error ? null : (data as { user_id: string }[])
          )
        : Promise.resolve(null),
      round.status === 'voting'
        ? // Also a nice-to-have: without it the screen just leaves out the points so far.
          supabase.rpc('round_votes_so_far', { rid: roundId }).then(({ data, error }) =>
            error ? [] : (data as VoteSoFar[])
          )
        : Promise.resolve([]),
      // Nice-to-have too: without it the screen just shows the count.
      round.status === 'voting'
        ? supabase.rpc('round_voter_status', { rid: roundId }).then(({ data, error }) =>
            error ? null : (data as { user_id: string; has_ranked: boolean }[])
          )
        : Promise.resolve(null),
    ]);

  return {
    round,
    group,
    progress: progressRows[0],
    mySubmission,
    songs,
    rankings,
    submissions,
    guesses,
    members: maskBlocked(memberRows.map((m) => m.profiles), blockedIds),
    comments,
    blockedIds,
    submittedIds: submitters ? new Set(submitters.map((s) => s.user_id)) : null,
    votesSoFar,
    voterStatus: voterStatus ? new Map(voterStatus.map((v) => [v.user_id, v.has_ranked])) : null,
  };
}

/**
 * Asks the database whether someone else this round already picked this song,
 * a song from its album, or a song by one of its artists. Only what matched
 * comes back, never who picked it. If the check can't run, it says nothing
 * matched so the pick still goes through.
 */
export async function findSimilarPicks(roundId: string, song: PickedSong): Promise<SimilarPicks | null> {
  const { data, error } = await supabase.rpc('similar_picks', {
    rid: roundId,
    title: song.track_name,
    artists: song.artist_name,
    track_id: song.spotify_track_id ?? null,
    album_id: song.spotify_album_id ?? null,
  });
  if (error || !Array.isArray(data)) return null;
  return (data[0] as SimilarPicks | undefined) ?? null;
}

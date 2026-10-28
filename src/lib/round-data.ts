import { check } from '@/lib/db';
import { isPastDeadline } from '@/lib/deadlines';
import { supabase } from '@/lib/supabase';
import type { Group, Profile, Ranking, Round, RoundProgress, RoundSong, Submission } from '@/lib/types';

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
  members: Profile[];
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

  const [group, progressRows, mySubmission, songs, rankings, submissions, memberRows] =
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
        .select('profiles (id, display_name)')
        .eq('group_id', round.group_id)
        .then(check<{ profiles: Profile }[]>),
    ]);

  return {
    round,
    group,
    progress: progressRows[0],
    mySubmission,
    songs,
    rankings,
    submissions,
    members: memberRows.map((m) => m.profiles),
  };
}

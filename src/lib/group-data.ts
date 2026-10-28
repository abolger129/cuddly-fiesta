import { check } from '@/lib/db';
import { isPastDeadline } from '@/lib/deadlines';
import { supabase } from '@/lib/supabase';
import type { Group, Guess, Profile, Ranking, Round, Submission } from '@/lib/types';

export type GroupDetails = {
  group: Group;
  members: Profile[];
  rounds: Round[];
  /** Only rounds that are finished: earlier ones are hidden by the database. */
  submissions: Submission[];
  rankings: Ranking[];
  guesses: Guess[];
};

export async function loadGroupDetails(groupId: string): Promise<GroupDetails> {
  const fetchRounds = () =>
    supabase
      .from('rounds')
      .select('*')
      .eq('group_id', groupId)
      .order('round_number')
      .then(check<Round[]>);
  const [group, memberRows, roundsAsLoaded] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).single().then(check<Group>),
    supabase
      .from('group_members')
      .select('profiles (id, display_name)')
      .eq('group_id', groupId)
      .order('joined_at')
      .then(check<{ profiles: Profile }[]>),
    fetchRounds(),
  ]);

  // Time is up: move rounds on now rather than waiting for the scheduled job.
  let rounds = roundsAsLoaded;
  const now = new Date();
  if (rounds.some((r) => isPastDeadline(r, now))) {
    await supabase.rpc('close_expired_rounds', { gid: groupId }).then(check);
    rounds = await fetchRounds();
  }

  const finishedRoundIds = rounds.filter((r) => r.status === 'finished').map((r) => r.id);
  const [submissions, rankings, guesses] = finishedRoundIds.length
    ? await Promise.all([
        supabase.from('submissions').select('*').in('round_id', finishedRoundIds).then(check<Submission[]>),
        supabase.from('rankings').select('*').in('round_id', finishedRoundIds).then(check<Ranking[]>),
        group.guessing_enabled
          ? supabase.from('guesses').select('*').in('round_id', finishedRoundIds).then(check<Guess[]>)
          : Promise.resolve([]),
      ])
    : [[], [], []];

  return {
    group,
    members: memberRows.map((m) => m.profiles),
    rounds,
    submissions,
    rankings,
    guesses,
  };
}

export function nameOf(members: Profile[], userId: string): string {
  return members.find((m) => m.id === userId)?.display_name || 'Someone';
}

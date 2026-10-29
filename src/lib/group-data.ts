import { maskBlocked, withoutBlocked } from '@/lib/blocking';
import { check } from '@/lib/db';
import { isPastDeadline } from '@/lib/deadlines';
import { loadBlockedIds } from '@/lib/safety';
import { supabase } from '@/lib/supabase';
import { PROFILE_FIELDS } from '@/lib/types';
import type { CategorySuggestion, Group, Guess, Profile, Ranking, Round, Submission } from '@/lib/types';

export type GroupDetails = {
  group: Group;
  members: Profile[];
  rounds: Round[];
  /** Only rounds that are finished: earlier ones are hidden by the database. */
  submissions: Submission[];
  rankings: Ranking[];
  guesses: Guess[];
  suggestions: CategorySuggestion[];
  /** Players you blocked. Their names and avatars are already hidden in members. */
  blockedIds: Set<string>;
};

export async function loadGroupDetails(groupId: string): Promise<GroupDetails> {
  const fetchRounds = () =>
    supabase
      .from('rounds')
      .select('*')
      .eq('group_id', groupId)
      .order('round_number')
      .then(check<Round[]>);
  const [group, memberRows, roundsAsLoaded, suggestions, blockedIds] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).single().then(check<Group>),
    supabase
      .from('group_members')
      .select(`profiles (${PROFILE_FIELDS})`)
      .eq('group_id', groupId)
      .order('joined_at')
      .then(check<{ profiles: Profile }[]>),
    fetchRounds(),
    supabase
      .from('category_suggestions')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at')
      .then(check<CategorySuggestion[]>),
    loadBlockedIds(),
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
    members: maskBlocked(memberRows.map((m) => m.profiles), blockedIds),
    rounds,
    submissions,
    rankings,
    guesses,
    suggestions: withoutBlocked(suggestions, blockedIds),
    blockedIds,
  };
}

export function nameOf(members: Profile[], userId: string): string {
  return members.find((m) => m.id === userId)?.display_name || 'Someone';
}

import { check } from '@/lib/db';
import type { LeagueRecord } from '@/lib/history';
import { supabase } from '@/lib/supabase';
import type { Group, Guess, Profile, Ranking, Round, Submission } from '@/lib/types';

export type LeagueHistory = {
  /** Newest first. */
  groups: (Group & { rounds: Pick<Round, 'id' | 'status'>[] })[];
  /** One per group, keyed by group id. */
  records: Map<string, LeagueRecord>;
};

/** Every league you're in, with the finished rounds' results, for the league list and stats. */
export async function loadLeagueHistory(): Promise<LeagueHistory> {
  const [groups, memberRows] = await Promise.all([
    supabase
      .from('groups')
      .select('*, rounds (id, status)')
      .order('created_at', { ascending: false })
      .then(check<LeagueHistory['groups']>),
    supabase
      .from('group_members')
      .select('group_id, profiles (id, display_name)')
      .then(check<{ group_id: string; profiles: Profile }[]>),
  ]);

  const finishedRoundIds = groups.flatMap((g) => g.rounds.filter((r) => r.status === 'finished').map((r) => r.id));
  const [submissions, rankings, guesses] = finishedRoundIds.length
    ? await Promise.all([
        supabase.from('submissions').select('*').in('round_id', finishedRoundIds).then(check<Submission[]>),
        supabase.from('rankings').select('*').in('round_id', finishedRoundIds).then(check<Ranking[]>),
        supabase.from('guesses').select('*').in('round_id', finishedRoundIds).then(check<Guess[]>),
      ])
    : [[], [], []];

  const records = new Map<string, LeagueRecord>();
  for (const group of groups) {
    const roundIds = new Set(group.rounds.map((r) => r.id));
    records.set(group.id, {
      group,
      members: memberRows.filter((m) => m.group_id === group.id).map((m) => m.profiles),
      rounds: group.rounds,
      submissions: submissions.filter((s) => roundIds.has(s.round_id)),
      rankings: rankings.filter((r) => roundIds.has(r.round_id)),
      // Guesses only count in leagues with guessing on, as on the league screen.
      guesses: group.guessing_enabled ? guesses.filter((g) => roundIds.has(g.round_id)) : [],
    });
  }
  return { groups, records };
}

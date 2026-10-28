import { check } from '@/lib/db';
import type { LeagueRecord } from '@/lib/history';
import { supabase } from '@/lib/supabase';
import type { Group, Guess, Profile, Ranking, Round, Submission } from '@/lib/types';

export type LeagueHistory = {
  /** Newest first. */
  groups: (Group & { rounds: Pick<Round, 'id' | 'status' | 'round_number' | 'category'>[] })[];
  /** One per group, keyed by group id. */
  records: Map<string, LeagueRecord>;
  /** Leagues waiting on you: a round is open and you haven't picked or ranked yet. */
  yourTurn: Set<string>;
  /** You, for the avatar at the top of the league list. */
  me: Profile | null;
};

/** Every league you're in, with the finished rounds' results, for the league list and stats. */
export async function loadLeagueHistory(): Promise<LeagueHistory> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id ?? '';
  const [groups, memberRows] = await Promise.all([
    supabase
      .from('groups')
      .select('*, rounds (id, status, round_number, category)')
      .order('created_at', { ascending: false })
      .then(check<LeagueHistory['groups']>),
    supabase
      .from('group_members')
      .select('group_id, profiles (id, display_name, avatar_doodle)')
      .then(check<{ group_id: string; profiles: Profile }[]>),
  ]);

  const openRounds = groups.flatMap((g) =>
    g.rounds.filter((r) => r.status === 'submitting' || r.status === 'voting').map((r) => ({ ...r, groupId: g.id }))
  );
  const yourTurn = await findYourTurns(openRounds, userId);

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
  const me = memberRows.find((m) => m.profiles.id === userId)?.profiles ?? null;
  return { groups, records, yourTurn, me };
}

/** The leagues whose open round still needs your song or your ranking. */
async function findYourTurns(
  openRounds: (Pick<Round, 'id' | 'status'> & { groupId: string })[],
  userId: string
): Promise<Set<string>> {
  const picking = openRounds.filter((r) => r.status === 'submitting').map((r) => r.id);
  const ranking = openRounds.filter((r) => r.status === 'voting').map((r) => r.id);
  // You only see your own songs and rankings in open rounds, so these are yours.
  const [picked, ranked] = await Promise.all([
    picking.length
      ? supabase
          .from('submissions')
          .select('round_id')
          .eq('user_id', userId)
          .in('round_id', picking)
          .then(check<{ round_id: string }[]>)
      : [],
    ranking.length
      ? supabase
          .from('rankings')
          .select('round_id')
          .eq('voter_id', userId)
          .in('round_id', ranking)
          .then(check<{ round_id: string }[]>)
      : [],
  ]);
  const done = new Set([...picked, ...ranked].map((r) => r.round_id));
  return new Set(openRounds.filter((r) => !done.has(r.id)).map((r) => r.groupId));
}

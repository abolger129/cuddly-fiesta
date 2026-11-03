import { maskBlocked, withoutBlocked } from '@/lib/blocking';
import { check } from '@/lib/db';
import { isPastDeadline } from '@/lib/deadlines';
import { logError } from '@/lib/error-log';
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
      .then(check<Round[]>)
      .then((rows) => rows.map(withRoundDefaults));
  const [group, memberRows, roundsAsLoaded, suggestions, blockedIds] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).single().then(check<Group>).then(withGroupDefaults),
    supabase
      .from('group_members')
      .select(`profiles (${PROFILE_FIELDS})`)
      .eq('group_id', groupId)
      .order('joined_at')
      .then(check<{ profiles: Profile | null }[]>),
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
  if (rounds.some((r) => isPastDeadline(r, now)) && (await closeExpiredRounds(groupId))) {
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
    members: maskBlocked(profilesOf(memberRows), blockedIds),
    rounds,
    submissions,
    rankings,
    guesses,
    suggestions: withoutBlocked(suggestions, blockedIds),
    blockedIds,
  };
}

/**
 * Fill in list columns that an older database doesn't have yet (a migration that
 * hasn't been run), so a screen shows the league instead of crashing on undefined.
 */
export function withGroupDefaults(group: Group): Group {
  return { ...group, banned_artists: group.banned_artists ?? [] };
}

export function withRoundDefaults(round: Round): Round {
  return { ...round, banned_artists: round.banned_artists ?? [] };
}

/**
 * Ask the database to move on rounds whose time is up. Best effort: if it fails
 * (say a hand-run update is missing) the screen still opens with the rounds as
 * they are, and the scheduled job tries again within five minutes.
 * Returns whether anything may have changed.
 */
export async function closeExpiredRounds(groupId: string): Promise<boolean> {
  const { error } = await supabase.rpc('close_expired_rounds', { gid: groupId });
  if (error) {
    logError(new Error(`close_expired_rounds: ${error.message}`), 'closeExpiredRounds');
    return false;
  }
  return true;
}

/** The players from a group_members query, skipping any whose profile didn't come back. */
export function profilesOf<T extends { profiles: Profile | null }>(rows: T[]): Profile[] {
  return rows.map((m) => m.profiles).filter((p): p is Profile => !!p && typeof p.id === 'string');
}

export function nameOf(members: Profile[], userId: string): string {
  return members.find((m) => m.id === userId)?.display_name || 'Someone';
}

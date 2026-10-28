import type { Group, Guess, Ranking, Submission } from './types';

/**
 * Scoring rules live here so they are easy to change.
 *
 * Each voter ranks every song except their own, favourite first. With the
 * default rules a song in position p out of n ranked songs gets n - p + 1
 * points from that voter, so their favourite gets the most and their last
 * pick gets 1.
 *
 * A league can change this in two ways:
 * - Points cap: only the voter's top N songs score (N points down to 1). The
 *   rest get 0.
 * - Downvotes: the voter's last-place song loses a point instead of gaining
 *   one, and the songs above it score as if it weren't there. Needs at least
 *   two songs to rank.
 *
 * In groups with guessing turned on, each correct guess at who picked a song
 * earns the guesser GUESS_BONUS_POINTS.
 */
export const GUESS_BONUS_POINTS = 2;

/** A league's ranking rules. */
export type ScoringRules = Pick<Group, 'points_cap' | 'downvotes'>;

export const DEFAULT_RULES: ScoringRules = { points_cap: null, downvotes: false };

export function pointsForPosition(
  position: number,
  songsRanked: number,
  rules: ScoringRules = DEFAULT_RULES
): number {
  const downvote = rules.downvotes && songsRanked >= 2;
  if (downvote && position === songsRanked) return -1;
  const scoringSlots = downvote ? songsRanked - 1 : songsRanked;
  const top = Math.min(rules.points_cap ?? scoringSlots, scoringSlots);
  return position <= top ? top - position + 1 : 0;
}

/** A short description of the rules, for showing to players. */
export function describeRules(rules: ScoringRules): string {
  const points = rules.points_cap
    ? `Only your top ${rules.points_cap} ${rules.points_cap === 1 ? 'song scores' : 'songs score'} (${rules.points_cap === 1 ? '1 point' : `${rules.points_cap} points down to 1`}).`
    : 'Every song you rank scores: your favourite gets the most points, your last pick gets 1.';
  return rules.downvotes ? `${points} Your last-place song loses a point.` : points;
}

/** Points per submission id for one round. */
export function scoreRound(rankings: Ranking[], rules: ScoringRules = DEFAULT_RULES): Map<string, number> {
  const songsRankedByVoter = new Map<string, number>();
  for (const r of rankings) {
    songsRankedByVoter.set(r.voter_id, (songsRankedByVoter.get(r.voter_id) ?? 0) + 1);
  }

  const points = new Map<string, number>();
  for (const r of rankings) {
    const n = songsRankedByVoter.get(r.voter_id) ?? 0;
    points.set(r.submission_id, (points.get(r.submission_id) ?? 0) + pointsForPosition(r.position, n, rules));
  }
  return points;
}

/** Bonus points per guesser for correct guesses. */
export function scoreGuesses(
  guesses: Guess[],
  submissions: Pick<Submission, 'id' | 'user_id'>[]
): Map<string, number> {
  const submissionOwner = new Map(submissions.map((s) => [s.id, s.user_id]));
  const points = new Map<string, number>();
  for (const g of guesses) {
    if (submissionOwner.get(g.submission_id) === g.guessed_user_id) {
      points.set(g.guesser_id, (points.get(g.guesser_id) ?? 0) + GUESS_BONUS_POINTS);
    }
  }
  return points;
}

export type Standing = {
  userId: string;
  points: number;
};

/**
 * Total points per player across rounds, highest first. Pass guesses only for
 * groups with guessing turned on.
 */
export function leaderboard(
  submissions: Pick<Submission, 'id' | 'user_id'>[],
  rankings: Ranking[],
  memberIds: string[],
  rules: ScoringRules = DEFAULT_RULES,
  guesses: Guess[] = []
): Standing[] {
  const submissionOwner = new Map(submissions.map((s) => [s.id, s.user_id]));
  const totals = new Map<string, number>(memberIds.map((id) => [id, 0]));

  const rankingsByRound = new Map<string, Ranking[]>();
  for (const r of rankings) {
    rankingsByRound.set(r.round_id, [...(rankingsByRound.get(r.round_id) ?? []), r]);
  }
  for (const roundRankings of rankingsByRound.values()) {
    for (const [submissionId, points] of scoreRound(roundRankings, rules)) {
      const owner = submissionOwner.get(submissionId);
      if (owner) totals.set(owner, (totals.get(owner) ?? 0) + points);
    }
  }
  for (const [userId, points] of scoreGuesses(guesses, submissions)) {
    if (totals.has(userId)) totals.set(userId, (totals.get(userId) ?? 0) + points);
  }

  return [...totals]
    .map(([userId, points]) => ({ userId, points }))
    .sort((a, b) => b.points - a.points);
}

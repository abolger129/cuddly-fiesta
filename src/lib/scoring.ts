import type { Ranking, Submission } from './types';

/**
 * Scoring rules live here so they are easy to change.
 *
 * Current rule: each voter ranks every song except their own. A song in
 * position p out of n ranked songs gets n - p + 1 points from that voter, so
 * a voter's favourite gets the most points and their last pick gets 1.
 */
export function pointsForPosition(position: number, songsRanked: number): number {
  return songsRanked - position + 1;
}

/** Points per submission id for one round. */
export function scoreRound(rankings: Ranking[]): Map<string, number> {
  const songsRankedByVoter = new Map<string, number>();
  for (const r of rankings) {
    songsRankedByVoter.set(r.voter_id, (songsRankedByVoter.get(r.voter_id) ?? 0) + 1);
  }

  const points = new Map<string, number>();
  for (const r of rankings) {
    const n = songsRankedByVoter.get(r.voter_id) ?? 0;
    points.set(r.submission_id, (points.get(r.submission_id) ?? 0) + pointsForPosition(r.position, n));
  }
  return points;
}

export type Standing = {
  userId: string;
  points: number;
};

/** Total points per player across rounds, highest first. */
export function leaderboard(
  submissions: Pick<Submission, 'id' | 'user_id'>[],
  rankings: Ranking[],
  memberIds: string[]
): Standing[] {
  const submissionOwner = new Map(submissions.map((s) => [s.id, s.user_id]));
  const totals = new Map<string, number>(memberIds.map((id) => [id, 0]));

  const rankingsByRound = new Map<string, Ranking[]>();
  for (const r of rankings) {
    rankingsByRound.set(r.round_id, [...(rankingsByRound.get(r.round_id) ?? []), r]);
  }
  for (const roundRankings of rankingsByRound.values()) {
    for (const [submissionId, points] of scoreRound(roundRankings)) {
      const owner = submissionOwner.get(submissionId);
      if (owner) totals.set(owner, (totals.get(owner) ?? 0) + points);
    }
  }

  return [...totals]
    .map(([userId, points]) => ({ userId, points }))
    .sort((a, b) => b.points - a.points);
}

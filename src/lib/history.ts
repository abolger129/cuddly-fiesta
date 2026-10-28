import { GUESS_BONUS_POINTS, leaderboard, scoreGuesses, scoreRound, type ScoringRules, type Standing } from './scoring.ts';
import type { Guess, Profile, Ranking, Round, Submission } from './types';

/**
 * Looking back at leagues: awards for a finished league, and each player's
 * record across every league you've shared. All worked out from the same
 * finished-round data the leaderboard uses, so the scoring rules apply.
 */

export type LeagueRecord = {
  group: ScoringRules & { id: string; name: string };
  members: Profile[];
  rounds: Pick<Round, 'id' | 'status'>[];
  /** Finished rounds only. */
  submissions: Submission[];
  rankings: Ranking[];
  guesses: Guess[];
};

export function isLeagueOver(rounds: Pick<Round, 'status'>[]): boolean {
  return rounds.length > 0 && rounds.every((r) => r.status === 'finished');
}

export function standingsFor(league: LeagueRecord): Standing[] {
  return leaderboard(
    league.submissions,
    league.rankings,
    league.members.map((m) => m.id),
    league.group,
    league.guesses
  );
}

/** Place for each player: 1 for the top score, players on the same score share a place. */
export function placesFrom(standings: Standing[]): Map<string, number> {
  return new Map(
    standings.map((s) => [s.userId, 1 + standings.filter((o) => o.points > s.points).length])
  );
}

/**
 * How many places each player moved in the given round, the latest finished one:
 * 2 means up two places, -1 down one. Players on the same score share a place.
 */
export function placeChanges(league: LeagueRecord, latestRoundId: string): Map<string, number> {
  const before = standingsFor({
    ...league,
    submissions: league.submissions.filter((s) => s.round_id !== latestRoundId),
    rankings: league.rankings.filter((r) => r.round_id !== latestRoundId),
    guesses: league.guesses.filter((g) => g.round_id !== latestRoundId),
  });
  const placesBefore = placesFrom(before);
  const placesNow = placesFrom(standingsFor(league));
  return new Map(
    [...placesNow].map(([userId, place]) => [userId, (placesBefore.get(userId) ?? place) - place])
  );
}

export type SongScore = { submission: Submission; points: number };

/** Every song's points in its round, best first. */
export function songScores(league: LeagueRecord): SongScore[] {
  const points = new Map<string, number>();
  for (const roundRankings of groupBy(league.rankings, (r) => r.round_id).values()) {
    for (const [id, p] of scoreRound(roundRankings, league.group)) points.set(id, p);
  }
  return league.submissions
    .map((submission) => ({ submission, points: points.get(submission.id) ?? 0 }))
    .sort((a, b) => b.points - a.points);
}

export type Awards = {
  /** The song that scored the most in its round. */
  bestSong: SongScore | null;
  /** The song voters disagreed on most: loved by some, ranked low by others. */
  mostControversial: Submission | null;
  /** Most right guesses at who picked a song. Only in leagues with guessing. */
  bestGuesser: { userId: string; correct: number } | null;
  /** The two players whose rankings lined up best. agreement is 0 to 1. */
  tasteTwins: { userIds: [string, string]; agreement: number } | null;
};

export function leagueAwards(league: LeagueRecord): Awards {
  const scores = songScores(league);
  const bestSong = scores.length && scores[0].points > 0 ? scores[0] : null;

  // How highly each voter rated each song, from 1 (their favourite) to 0 (their last pick).
  const ratings = voterRatings(league.rankings);

  let mostControversial: Submission | null = null;
  let widestSpread = 0;
  for (const s of league.submissions) {
    const values = ratings.filter((r) => r.submissionId === s.id).map((r) => r.rating);
    if (values.length < 2) continue;
    const spread = standardDeviation(values);
    if (spread > widestSpread) {
      widestSpread = spread;
      mostControversial = s;
    }
  }

  let bestGuesser: Awards['bestGuesser'] = null;
  for (const [userId, points] of scoreGuesses(league.guesses, league.submissions)) {
    const correct = points / GUESS_BONUS_POINTS;
    if (!bestGuesser || correct > bestGuesser.correct) bestGuesser = { userId, correct };
  }

  return { bestSong, mostControversial, bestGuesser, tasteTwins: tasteTwins(ratings) };
}

type Rating = { roundId: string; voterId: string; submissionId: string; rating: number };

function voterRatings(rankings: Ranking[]): Rating[] {
  const counts = new Map<string, number>();
  for (const r of rankings) {
    const key = `${r.round_id}:${r.voter_id}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return rankings.flatMap((r) => {
    const n = counts.get(`${r.round_id}:${r.voter_id}`) ?? 0;
    if (n < 2) return [];
    return [{ roundId: r.round_id, voterId: r.voter_id, submissionId: r.submission_id, rating: (n - r.position) / (n - 1) }];
  });
}

function tasteTwins(ratings: Rating[]): Awards['tasteTwins'] {
  // Total difference and number of songs compared, per pair of voters.
  const pairs = new Map<string, { diff: number; count: number }>();
  for (const round of groupBy(ratings, (r) => r.roundId).values()) {
    const bySong = groupBy(round, (r) => r.submissionId);
    for (const songRatings of bySong.values()) {
      for (let i = 0; i < songRatings.length; i++) {
        for (let j = i + 1; j < songRatings.length; j++) {
          const [a, b] = [songRatings[i], songRatings[j]].sort((x, y) => x.voterId.localeCompare(y.voterId));
          const key = `${a.voterId}|${b.voterId}`;
          const pair = pairs.get(key) ?? { diff: 0, count: 0 };
          pair.diff += Math.abs(a.rating - b.rating);
          pair.count += 1;
          pairs.set(key, pair);
        }
      }
    }
  }

  let best: Awards['tasteTwins'] = null;
  for (const [key, { diff, count }] of pairs) {
    // One song in common says too little.
    if (count < 2) continue;
    const agreement = 1 - diff / count;
    if (!best || agreement > best.agreement) {
      const [a, b] = key.split('|');
      best = { userIds: [a, b], agreement };
    }
  }
  return best;
}

export type PlayerStats = {
  userId: string;
  name: string;
  /** Leagues with every round finished. */
  leaguesFinished: number;
  wins: number;
  /** Average place across finished leagues. null until one has finished. */
  averagePlace: number | null;
  songsPicked: number;
  /** The artists they've picked most, most first. */
  topArtists: { name: string; count: number }[];
};

/** Each player's record across the given leagues, most wins first. */
export function playerStats(leagues: LeagueRecord[]): PlayerStats[] {
  const stats = new Map<string, PlayerStats & { placeTotal: number; artists: Map<string, number> }>();
  const statsFor = (p: Profile) => {
    let s = stats.get(p.id);
    if (!s) {
      s = {
        userId: p.id,
        name: p.display_name || 'Someone',
        leaguesFinished: 0,
        wins: 0,
        averagePlace: null,
        songsPicked: 0,
        topArtists: [],
        placeTotal: 0,
        artists: new Map(),
      };
      stats.set(p.id, s);
    }
    return s;
  };

  for (const league of leagues) {
    const memberById = new Map(league.members.map((m) => [m.id, m]));
    for (const sub of league.submissions) {
      const member = memberById.get(sub.user_id);
      if (!member) continue;
      const s = statsFor(member);
      s.songsPicked += 1;
      // Spotify joins several artists with commas; count each one.
      for (const artist of sub.artist_name.split(', ').map((a) => a.trim()).filter(Boolean)) {
        s.artists.set(artist, (s.artists.get(artist) ?? 0) + 1);
      }
    }
    if (!isLeagueOver(league.rounds)) continue;
    for (const [userId, place] of placesFrom(standingsFor(league))) {
      const member = memberById.get(userId);
      if (!member) continue;
      const s = statsFor(member);
      s.leaguesFinished += 1;
      s.placeTotal += place;
      if (place === 1) s.wins += 1;
    }
  }

  return [...stats.values()]
    .map(({ placeTotal, artists, ...s }) => ({
      ...s,
      averagePlace: s.leaguesFinished ? placeTotal / s.leaguesFinished : null,
      topArtists: [...artists]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 3),
    }))
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        (a.averagePlace ?? Infinity) - (b.averagePlace ?? Infinity) ||
        a.name.localeCompare(b.name)
    );
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}

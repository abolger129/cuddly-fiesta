/** Ideas for round categories, for when the host is stuck. Spin the roulette to pick one. */
export const CATEGORY_IDEAS = [
  'Songs about the weather',
  'A song from the year you were born',
  'Best opening track on an album',
  'Guilty pleasure',
  'Songs that sound like summer',
  'A song for a breakup',
  'Music to drive to at night',
  'A cover better than the original',
  'A one-hit wonder',
  'Songs with a number in the title',
  'Your go-to karaoke song',
  'A song your parents played',
  'Best song under two minutes',
  'A song in a language you don\'t speak',
  'The best key change',
  'A song from a film or TV show',
  'Songs to cry to',
  'Something to get the party started',
  'A song from a band that broke up',
  'The song you\'d walk out to in a boxing match',
  'Best duet',
  'A song with a colour in the title',
  'A song you discovered this year',
  'Songs for a rainy Sunday',
  'The best guitar solo',
  'A song from a video game',
  'Hidden gem: under a million plays',
  'Songs about food',
  'A song that makes you want to dance',
  'Best song from the 80s',
  'Best song from the 90s',
  'Best song from the 2000s',
  'A song that tells a story',
  'A song with a whistle in it',
  'The most overplayed song you still love',
  'A song for a road trip',
  'Songs about places',
  'A song for your nemesis',
  'Your most-played song ever',
  'The song stuck in your head right now',
  'A song you hated at first',
  'A song for 3am',
  'Instrumentals only',
  'Songs about animals',
  'A song from a live album',
  'The best final track on an album',
  'A song about money',
  'Songs that remind you of school',
  'A Christmas song that isn\'t terrible',
  'Something your friends have never heard',
] as const;

/**
 * A random category idea that isn't already one of the league's rounds.
 * random is a number from 0 up to 1, from Math.random by default.
 */
export function pickCategory(taken: string[], random: number = Math.random()): string {
  const used = new Set(taken.map((c) => c.trim().toLowerCase()));
  const fresh = CATEGORY_IDEAS.filter((c) => !used.has(c.toLowerCase()));
  const pool = fresh.length ? fresh : CATEGORY_IDEAS;
  return pool[Math.min(pool.length - 1, Math.floor(random * pool.length))];
}

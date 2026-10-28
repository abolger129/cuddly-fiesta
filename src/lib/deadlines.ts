import type { Round } from './types';

/** Timer choices offered to the group creator, in hours. null means no timer. */
export const TIMER_OPTIONS: (number | null)[] = [null, 12, 24, 48, 72, 168];

/** "No timer", "12 hours", "1 day", "3 days", "1 week" */
export function describeHours(hours: number | null): string {
  if (hours == null) return 'No timer';
  if (hours % 168 === 0) return plural(hours / 168, 'week');
  if (hours % 24 === 0) return plural(hours / 24, 'day');
  return plural(hours, 'hour');
}

/** When the round's current stage closes, if it has a timer. */
export function activeDeadline(round: Pick<Round, 'status' | 'submit_deadline' | 'vote_deadline'>): Date | null {
  const deadline =
    round.status === 'submitting' ? round.submit_deadline : round.status === 'voting' ? round.vote_deadline : null;
  return deadline ? new Date(deadline) : null;
}

export function isPastDeadline(
  round: Pick<Round, 'status' | 'submit_deadline' | 'vote_deadline'>,
  now: Date
): boolean {
  const deadline = activeDeadline(round);
  return deadline != null && deadline <= now;
}

/** "3 days", "1 day 4 hours", "5 hours", "1 hour 20 minutes", "12 minutes" */
export function formatTimeLeft(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 2) return plural(days, 'day');
  if (days === 1) return hours % 24 ? `1 day ${plural(hours % 24, 'hour')}` : '1 day';
  if (hours >= 2) return plural(hours, 'hour');
  if (hours === 1) return minutes % 60 ? `1 hour ${plural(minutes % 60, 'minute')}` : '1 hour';
  if (minutes >= 1) return plural(minutes, 'minute');
  return 'less than a minute';
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

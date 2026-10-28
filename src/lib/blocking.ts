import type { Profile } from '@/lib/types';

/** What a blocked player is called everywhere in the app. */
export const BLOCKED_NAME = 'Blocked player';

/** Hide the names and avatars of players you blocked. Their songs and scores still count. */
export function maskBlocked<T extends Profile>(members: T[], blockedIds: ReadonlySet<string>): T[] {
  return members.map((m) =>
    blockedIds.has(m.id) ? { ...m, display_name: BLOCKED_NAME, avatar_doodle: null } : m
  );
}

/** Drop things written by players you blocked, such as category suggestions. */
export function withoutBlocked<T extends { user_id: string }>(items: T[], blockedIds: ReadonlySet<string>): T[] {
  return items.filter((item) => !blockedIds.has(item.user_id));
}

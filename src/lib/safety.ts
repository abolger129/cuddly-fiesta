import { Alert, Platform } from 'react-native';

import { check } from '@/lib/db';
import { confirmDestructive } from '@/lib/confirm';
import { alertOnError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/** The ids of players you blocked. */
export async function loadBlockedIds(): Promise<Set<string>> {
  const rows = await supabase.from('blocks').select('blocked_id').then(check<{ blocked_id: string }[]>);
  return new Set(rows.map((r) => r.blocked_id));
}

const REPORT_REASONS = ['Offensive or abusive', 'Harassment or bullying', 'Spam', 'Something else'];

function pickReason(title: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\nReport as offensive or abusive?`) ? REPORT_REASONS[0] : null);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      'What is wrong with it? We review every report within 24 hours.',
      [
        ...REPORT_REASONS.map((reason) => ({ text: reason, onPress: () => resolve(reason) })),
        { text: 'Cancel', style: 'cancel' as const, onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
}

/**
 * Report a player, or their comment on a song. Offers to block them afterwards.
 * Resolves true if they were blocked, so the screen can reload.
 */
export async function reportPlayer(
  player: { id: string; name: string },
  commentOnSubmission?: string
): Promise<boolean> {
  const reason = await pickReason(commentOnSubmission ? 'Report this comment' : `Report ${player.name}`);
  if (!reason) return false;
  const { error } = await supabase.rpc('report_content', {
    target: player.id,
    report_reason: reason,
    comment_submission: commentOnSubmission ?? null,
  });
  if (alertOnError('Could not send the report', error)) return false;
  const block = await confirmDestructive(
    'Thanks for reporting',
    `We'll look at it within 24 hours. Do you also want to block ${player.name}? You won't see their comments, name or avatar.`,
    'Block',
  );
  return block && blockPlayer(player.id);
}

/** Block a player without asking. Resolves true if it worked. */
export async function blockPlayer(playerId: string): Promise<boolean> {
  const { error } = await supabase.rpc('block_player', { uid: playerId });
  return !alertOnError('Could not block the player', error);
}

/** Ask, then block. Resolves true if they were blocked. */
export async function confirmBlock(player: { id: string; name: string }): Promise<boolean> {
  const ok = await confirmDestructive(
    `Block ${player.name}?`,
    "You won't see their comments, name or avatar, and they won't see your comments. Their songs stay in the game. You can unblock them any time.",
    'Block',
  );
  return ok && blockPlayer(player.id);
}

/** Resolves true if they were unblocked. */
export async function unblockPlayer(playerId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getSession();
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', auth.session?.user.id ?? '')
    .eq('blocked_id', playerId);
  return !alertOnError('Could not unblock the player', error);
}

/**
 * The menu for another player: report, and block or unblock.
 * Resolves true if something changed that the screen should reload for.
 */
export function playerActions(player: { id: string; name: string }, blocked: boolean): Promise<boolean> {
  if (Platform.OS === 'web') {
    return blocked ? unblockPlayer(player.id) : confirmBlock(player);
  }
  return new Promise((resolve) => {
    Alert.alert(
      player.name,
      undefined,
      [
        { text: 'Report', onPress: () => reportPlayer(player).then(resolve) },
        blocked
          ? { text: 'Unblock', onPress: () => unblockPlayer(player.id).then(resolve) }
          : { text: 'Block', style: 'destructive' as const, onPress: () => confirmBlock(player).then(resolve) },
        { text: 'Cancel', style: 'cancel' as const, onPress: () => resolve(false) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

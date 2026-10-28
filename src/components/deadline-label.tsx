import { useEffect, useRef } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useNow } from '@/hooks/use-now';
import { activeDeadline, formatTimeLeft } from '@/lib/deadlines';
import type { Round } from '@/lib/types';

type DeadlineLabelProps = {
  round: Round;
  /** Called once when the deadline passes while this is on screen. */
  onExpired?: () => void;
  /** Leave out the date and the explanation, for lists. */
  compact?: boolean;
  style?: StyleProp<TextStyle>;
};

/** How long is left to pick or rank, for rounds with a timer. */
export function DeadlineLabel({ round, onExpired, compact, style }: DeadlineLabelProps) {
  const now = useNow();
  const deadline = activeDeadline(round);
  const expired = deadline != null && deadline <= now;

  const wasExpired = useRef(expired);
  useEffect(() => {
    if (expired && !wasExpired.current) onExpired?.();
    wasExpired.current = expired;
  }, [expired, onExpired]);

  if (!deadline) return null;

  const action = round.status === 'submitting' ? 'Picks close' : 'Ranking closes';
  let text: string;
  if (!expired) {
    text = `${action} in ${formatTimeLeft(deadline.getTime() - now.getTime())}`;
    if (!compact) {
      text += ` (${deadline.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })})`;
    }
  } else if (round.status === 'submitting') {
    text = compact ? "Time's up" : "Time's up. Ranking starts as soon as there are two songs.";
  } else {
    text = "Time's up";
  }

  return (
    <ThemedText type={compact ? 'small' : 'smallBold'} themeColor={compact ? 'textSecondary' : 'text'}
      style={style}>
      {text}
    </ThemedText>
  );
}

import { useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/button';
import { useNow } from '@/hooks/use-now';
import { formatTimeLeft } from '@/lib/deadlines';
import { alertOnError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Round } from '@/lib/types';

const COOLDOWN_MS = 60 * 60_000;

/** Send a push notification to everyone who hasn't picked or ranked yet. */
export function NudgeButton({ round, onChanged }: { round: Round; onChanged: () => void }) {
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const nextNudge = round.last_nudged_at ? new Date(round.last_nudged_at).getTime() + COOLDOWN_MS : 0;
  const waiting = nextNudge > now.getTime();

  async function nudge() {
    setBusy(true);
    const { data, error } = await supabase.rpc('nudge_round', { rid: round.id });
    setBusy(false);
    if (alertOnError('Could not nudge', error)) return;
    Alert.alert('Nudged', `${data} ${data === 1 ? 'player' : 'players'} got a reminder.`);
    onChanged();
  }

  return (
    <Button
      title={waiting ? `Nudge again in ${formatTimeLeft(nextNudge - now.getTime())}` : 'Nudge the others'}
      variant="secondary"
      onPress={nudge}
      loading={busy}
      disabled={waiting}
    />
  );
}

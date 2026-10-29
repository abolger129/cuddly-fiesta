import { useEffect, useState } from 'react';

import { Button } from '@/components/button';
import { useNow } from '@/hooks/use-now';
import { showAlert } from '@/lib/alert';
import { formatTimeLeft, nextNudgeAt } from '@/lib/deadlines';
import { alertOnError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Round } from '@/lib/types';

/** The old fixed limit, used until the host's setting has loaded. */
const DEFAULT_COOLDOWN_MINUTES = 60;

/** Send a push notification to everyone who hasn't picked or ranked yet, as often as the host allows. */
export function NudgeButton({ round, onChanged }: { round: Round; onChanged: () => void }) {
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState<number | null>(DEFAULT_COOLDOWN_MINUTES);

  useEffect(() => {
    supabase
      .from('groups')
      .select('nudge_cooldown_minutes')
      .eq('id', round.group_id)
      .single()
      .then(({ data }) => {
        if (data) setCooldown(data.nudge_cooldown_minutes);
      });
  }, [round.group_id]);

  const nextNudge = nextNudgeAt(round.last_nudged_at, cooldown);
  if (!nextNudge) return null;
  const waiting = nextNudge.getTime() > now.getTime();

  async function nudge() {
    setBusy(true);
    const { data, error } = await supabase.rpc('nudge_round', { rid: round.id });
    setBusy(false);
    if (alertOnError('Could not nudge', error)) return;
    showAlert('Nudged', `${data} ${data === 1 ? 'player' : 'players'} got a reminder.`);
    onChanged();
  }

  return (
    <Button
      title={waiting ? `Nudge again in ${formatTimeLeft(nextNudge.getTime() - now.getTime())}` : 'Nudge the others'}
      variant="secondary"
      onPress={nudge}
      loading={busy}
      disabled={waiting}
    />
  );
}

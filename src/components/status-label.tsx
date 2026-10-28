import { Stamp } from '@/components/sleeve';
import type { RoundStatus } from '@/lib/types';

const LABELS: Record<RoundStatus, string> = {
  upcoming: 'Not started',
  submitting: 'Picking songs',
  voting: 'Ranking',
  finished: 'Finished',
};

export function statusText(status: RoundStatus): string {
  return LABELS[status];
}

/** A round's status as a stamp on its sleeve. */
export function StatusLabel({ status, color }: { status: RoundStatus; color?: string }) {
  return <Stamp text={LABELS[status]} color={color} />;
}

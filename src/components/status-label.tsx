import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { RoundStatus } from '@/lib/types';

const LABELS: Record<RoundStatus, string> = {
  upcoming: 'Not started',
  submitting: 'Picking songs',
  voting: 'Ranking',
  finished: 'Finished',
};

export function StatusLabel({ status }: { status: RoundStatus }) {
  const active = status === 'submitting' || status === 'voting';
  return (
    <ThemedView type={active ? 'backgroundSelected' : 'background'} style={styles.label}>
      <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
        {LABELS[status]}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  label: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
  },
});

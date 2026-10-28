import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A small uppercase heading over an ink rule, like a section on an album's back cover. */
export function SectionLabel({ children, trailing }: { children: string; trailing?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.label, { borderBottomColor: theme.text }]}>
      <ThemedText type="label" themeColor="textSecondary" style={styles.text}>
        {children}
      </ThemedText>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: Spacing.one,
    marginTop: Spacing.two,
  },
  text: {
    flex: 1,
  },
});

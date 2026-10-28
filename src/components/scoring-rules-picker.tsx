import { StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeRules, type ScoringRules } from '@/lib/scoring';

const CAP_OPTIONS: { label: string; cap: number | null }[] = [
  { label: 'Every song', cap: null },
  { label: 'Top 3', cap: 3 },
  { label: 'Top 5', cap: 5 },
];

type ScoringRulesPickerProps = {
  rules: ScoringRules;
  onChange: (rules: ScoringRules) => void;
  disabled?: boolean;
};

/** Choose a league's points cap and whether downvotes are on. */
export function ScoringRulesPicker({ rules, onChange, disabled }: ScoringRulesPickerProps) {
  const theme = useTheme();

  return (
    <View style={styles.picker}>
      <ThemedText type="small" themeColor="textSecondary">
        Which songs score points
      </ThemedText>
      <View style={styles.options}>
        {CAP_OPTIONS.map((option) => (
          <Button
            key={option.label}
            title={option.label}
            variant={rules.points_cap === option.cap ? 'primary' : 'secondary'}
            accessibilityState={{ selected: rules.points_cap === option.cap }}
            onPress={() => onChange({ ...rules, points_cap: option.cap })}
            disabled={disabled}
            style={styles.option}
          />
        ))}
      </View>
      <View style={styles.toggle}>
        <ThemedText type="small" style={styles.grow}>
          Downvotes: each player&apos;s last-place song loses a point
        </ThemedText>
        <Switch
          value={rules.downvotes}
          onValueChange={(downvotes) => onChange({ ...rules, downvotes })}
          disabled={disabled}
          trackColor={{ true: theme.accent }}
          accessibilityLabel="Downvotes"
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {describeRules(rules)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    gap: Spacing.two,
  },
  options: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  option: {
    flex: 1,
    paddingHorizontal: Spacing.two,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  grow: {
    flex: 1,
  },
});

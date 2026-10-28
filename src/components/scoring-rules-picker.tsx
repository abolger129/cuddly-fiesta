import { StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeRules, MAX_POINTS_LIMIT, type ScoringRules } from '@/lib/scoring';

/** Max points picked when the host first turns on a max. */
const DEFAULT_MAX_POINTS = 5;

type ScoringRulesPickerProps = {
  rules: ScoringRules;
  onChange: (rules: ScoringRules) => void;
  disabled?: boolean;
};

/**
 * Choose a league's max points, what songs ranked below the max get, and
 * whether downvotes are on.
 */
export function ScoringRulesPicker({ rules, onChange, disabled }: ScoringRulesPickerProps) {
  const theme = useTheme();
  const cap = rules.points_cap;

  function setCap(points_cap: number | null) {
    // Without a max every song scores, so nothing can go negative.
    onChange({ ...rules, points_cap, negative_points: points_cap === null ? false : rules.negative_points });
  }

  return (
    <View style={styles.picker}>
      <ThemedText type="small" themeColor="textSecondary">
        Points for each player&apos;s favourite
      </ThemedText>
      <View style={styles.options}>
        <Button
          title="No max"
          variant={cap === null ? 'primary' : 'secondary'}
          accessibilityState={{ selected: cap === null }}
          onPress={() => setCap(null)}
          disabled={disabled}
          style={styles.option}
        />
        <Button
          title="Set a max"
          variant={cap !== null ? 'primary' : 'secondary'}
          accessibilityState={{ selected: cap !== null }}
          onPress={() => cap === null && setCap(DEFAULT_MAX_POINTS)}
          disabled={disabled}
          style={styles.option}
        />
      </View>

      {cap !== null && (
        <>
          <View style={styles.stepper}>
            <Button
              title="−"
              variant="secondary"
              accessibilityLabel="Fewer max points"
              onPress={() => setCap(cap - 1)}
              disabled={disabled || cap <= 1}
              style={styles.step}
            />
            <ThemedText type="smallBold" style={styles.stepValue} accessibilityLiveRegion="polite">
              {cap} {cap === 1 ? 'point' : 'points'}
            </ThemedText>
            <Button
              title="+"
              variant="secondary"
              accessibilityLabel="More max points"
              onPress={() => setCap(cap + 1)}
              disabled={disabled || cap >= MAX_POINTS_LIMIT}
              style={styles.step}
            />
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            Songs ranked lower
          </ThemedText>
          <View style={styles.options}>
            <Button
              title="Get 0"
              variant={!rules.negative_points ? 'primary' : 'secondary'}
              accessibilityState={{ selected: !rules.negative_points }}
              onPress={() => onChange({ ...rules, negative_points: false })}
              disabled={disabled}
              style={styles.option}
            />
            <Button
              title="Go negative"
              variant={rules.negative_points ? 'primary' : 'secondary'}
              accessibilityState={{ selected: rules.negative_points }}
              onPress={() => onChange({ ...rules, negative_points: true, downvotes: false })}
              disabled={disabled}
              style={styles.option}
            />
          </View>
        </>
      )}

      {!rules.negative_points && (
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
      )}
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  step: {
    width: 48,
    paddingHorizontal: 0,
  },
  stepValue: {
    flex: 1,
    textAlign: 'center',
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

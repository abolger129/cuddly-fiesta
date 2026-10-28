import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeHours, TIMER_OPTIONS } from '@/lib/deadlines';

type TimerPickerProps = {
  label: string;
  value: number | null;
  onChange: (hours: number | null) => void;
};

/** A row of choices for how long a round stage lasts. */
export function TimerPicker({ label, value, onChange }: TimerPickerProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.options}>
        {TIMER_OPTIONS.map((hours) => {
          const selected = hours === value;
          return (
            <Pressable
              key={hours ?? 'none'}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(hours)}
              style={[
                styles.option,
                { backgroundColor: selected ? theme.accent : theme.backgroundElement },
              ]}>
              <ThemedText type="small" style={{ color: selected ? theme.onAccent : theme.text }}>
                {describeHours(hours)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});

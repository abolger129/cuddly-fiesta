import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Profile } from '@/lib/types';

type GuessPickerProps = {
  players: Profile[];
  selected: string | undefined;
  onSelect: (userId: string | undefined) => void;
};

/** A row of player names. Tap one to guess them, tap again to clear the guess. */
export function GuessPicker({ players, selected, onSelect }: GuessPickerProps) {
  const theme = useTheme();

  return (
    <View style={styles.chips}>
      {players.map((p) => {
        const isSelected = p.id === selected;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(isSelected ? undefined : p.id)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: isSelected ? theme.accent : theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="small" style={{ color: isSelected ? theme.onAccent : theme.text }}>
              {p.display_name || 'Someone'}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
});

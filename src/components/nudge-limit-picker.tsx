import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeNudgeLimit, NUDGE_OPTIONS } from '@/lib/deadlines';
import { alertOnError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/lib/types';

/** Host setting: how often a round can be nudged, or nudges off. Saves on tap. */
export function NudgeLimitPicker({ group, onChanged }: { group: Group; onChanged: () => void }) {
  const theme = useTheme();
  const [saving, setSaving] = useState(false);
  const value = nudgeLimitOf(group);

  async function choose(minutes: number | null) {
    if (minutes === value || saving) return;
    setSaving(true);
    const { error } = await supabase.from('groups').update({ nudge_cooldown_minutes: minutes }).eq('id', group.id);
    setSaving(false);
    if (!alertOnError('Could not change the nudge limit', error)) onChanged();
  }

  return (
    <Card>
      <ThemedText type="label" themeColor="textSecondary">
        Nudges
      </ThemedText>
      <View style={styles.options}>
        {NUDGE_OPTIONS.map((minutes) => {
          const selected = minutes === value;
          return (
            <Pressable
              key={minutes ?? 'off'}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: saving }}
              onPress={() => choose(minutes)}
              style={[styles.option, { backgroundColor: selected ? theme.accent : theme.backgroundElement }]}>
              <ThemedText type="small" style={{ color: selected ? theme.onAccent : theme.text }}>
                {describeNudgeLimit(minutes)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {value == null
          ? 'Nobody can nudge in this league.'
          : 'How often anyone can nudge the players who haven’t picked or ranked yet, per round.'}
      </ThemedText>
    </Card>
  );
}

/** The league's nudge limit in minutes. Leagues from before the setting existed keep once an hour. */
export function nudgeLimitOf(group: Group): number | null {
  return group.nudge_cooldown_minutes === undefined ? 60 : group.nudge_cooldown_minutes;
}

const styles = StyleSheet.create({
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    borderRadius: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addBan } from '@/lib/banned-artists';

type EditorProps = {
  title: string;
  hint: string;
  bans: string[];
  /** Saves the new list. Returns true if it saved. */
  onSave: (bans: string[]) => Promise<boolean>;
};

/** The host bans artists: type a name to add it, tap ✕ on a name to lift the ban. */
export function BannedArtistsEditor({ title, hint, bans, onSave }: EditorProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(next: string[]) {
    setSaving(true);
    const saved = await onSave(next);
    setSaving(false);
    return saved;
  }

  async function add() {
    if (await save(addBan(bans, name))) setName('');
  }

  return (
    <Card>
      <ThemedText type="label" themeColor="textSecondary">
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {hint}
      </ThemedText>
      {bans.length > 0 && (
        <View style={styles.chips}>
          {bans.map((ban) => (
            <Pressable
              key={ban}
              accessibilityRole="button"
              accessibilityLabel={`Lift the ban on ${ban}`}
              disabled={saving}
              onPress={() => save(bans.filter((b) => b !== ban))}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: theme.backgroundSelected },
                (pressed || saving) && styles.pressed,
              ]}>
              <ThemedText type="small">{ban}</ThemedText>
              <ThemedText type="smallBold" themeColor="textSecondary">
                ✕
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.row}>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="Artist name"
          autoCorrect={false}
          maxLength={100}
          returnKeyType="done"
          onSubmitEditing={() => name.trim() && add()}
          style={styles.grow}
        />
        <Button title="Ban" variant="secondary" onPress={add} loading={saving} disabled={!name.trim()} />
      </View>
    </Card>
  );
}

/** For players: which artists are off limits. Nothing when there are none. */
export function BannedArtistsNote({ leagueBans, roundBans }: { leagueBans: string[]; roundBans?: string[] }) {
  if (leagueBans.length === 0 && !roundBans?.length) return null;
  return (
    <View style={styles.note}>
      {leagueBans.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Banned in this league: {leagueBans.join(', ')}
        </ThemedText>
      )}
      {roundBans && roundBans.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Banned this round: {roundBans.join(', ')}
        </ThemedText>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  grow: {
    flex: 1,
  },
  note: {
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.6,
  },
});

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { alertOnError } from '@/lib/errors';
import { nameOf, type GroupDetails } from '@/lib/group-data';
import { supabase } from '@/lib/supabase';

type Props = { details: GroupDetails; onChanged: () => void };

/** The host renames, reorders, adds or removes rounds that haven't started, and adds players' suggestions. */
export function UpcomingRoundsEditor({ details, onChanged }: Props) {
  const { group, rounds, members, suggestions } = details;
  const upcoming = rounds.filter((r) => r.status === 'upcoming').map((r) => r.category);
  const [editing, setEditing] = useState(false);
  const [categories, setCategories] = useState(upcoming);
  const [saving, setSaving] = useState(false);

  async function save(next: string[]) {
    setSaving(true);
    const { error } = await supabase.rpc('set_upcoming_rounds', {
      gid: group.id,
      categories: next.map((c) => c.trim()).filter(Boolean),
    });
    setSaving(false);
    return !alertOnError('Could not save the rounds', error);
  }

  async function addSuggestion(id: string, category: string) {
    if (!(await save([...upcoming, category]))) return;
    await supabase.from('category_suggestions').delete().eq('id', id);
    onChanged();
  }

  async function dismissSuggestion(id: string) {
    const { error } = await supabase.from('category_suggestions').delete().eq('id', id);
    if (!alertOnError('Could not dismiss the suggestion', error)) onChanged();
  }

  function move(index: number, by: number) {
    setCategories((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }

  if (editing) {
    return (
      <Card>
        <ThemedText type="label" themeColor="textSecondary">
          Upcoming rounds
        </ThemedText>
        {categories.map((category, index) => (
          <View key={index} style={styles.row}>
            <TextField
              value={category}
              onChangeText={(text) => setCategories((c) => c.map((x, i) => (i === index ? text : x)))}
              placeholder="Category"
              maxLength={120}
              style={styles.grow}
            />
            <SmallButton label="↑" a11y={`Move ${category} earlier`} disabled={index === 0} onPress={() => move(index, -1)} />
            <SmallButton
              label="↓"
              a11y={`Move ${category} later`}
              disabled={index === categories.length - 1}
              onPress={() => move(index, 1)}
            />
            <SmallButton
              label="✕"
              a11y={`Remove ${category}`}
              onPress={() => setCategories((c) => c.filter((_, i) => i !== index))}
            />
          </View>
        ))}
        <Button title="Add a round" variant="secondary" onPress={() => setCategories((c) => [...c, ''])} />
        <Button
          title="Save rounds"
          loading={saving}
          onPress={async () => {
            if (!(await save(categories))) return;
            setEditing(false);
            onChanged();
          }}
        />
        <Button title="Cancel" variant="secondary" onPress={() => setEditing(false)} />
      </Card>
    );
  }

  return (
    <Card>
      <ThemedText type="label" themeColor="textSecondary">
        Upcoming rounds
      </ThemedText>
      <ThemedText type="small">
        {upcoming.length ? upcoming.join(' · ') : 'No rounds left to play. Add one to keep the league going.'}
      </ThemedText>
      <Button
        title="Edit upcoming rounds"
        variant="secondary"
        onPress={() => {
          setCategories(upcoming);
          setEditing(true);
        }}
      />
      {suggestions.length > 0 && (
        <ThemedText type="label" themeColor="textSecondary" style={styles.subhead}>
          Suggestions
        </ThemedText>
      )}
      {suggestions.map((s) => (
        <View key={s.id} style={styles.row}>
          <View style={styles.grow}>
            <ThemedText type="small">{s.category}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              from {nameOf(members, s.user_id)}
            </ThemedText>
          </View>
          <SmallButton label="Add" a11y={`Add ${s.category} as a round`} disabled={saving} onPress={() => addSuggestion(s.id, s.category)} />
          <SmallButton label="✕" a11y={`Dismiss ${s.category}`} onPress={() => dismissSuggestion(s.id)} />
        </View>
      ))}
    </Card>
  );
}

/** Players suggest categories for the host to add. */
export function SuggestCategory({ details, userId, onChanged }: Props & { userId: string }) {
  const { group, suggestions } = details;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function suggest() {
    setSending(true);
    const { error } = await supabase
      .from('category_suggestions')
      .insert({ group_id: group.id, category: text.trim() });
    setSending(false);
    if (alertOnError('Could not send the suggestion', error)) return;
    setText('');
    onChanged();
  }

  async function withdraw(id: string) {
    const { error } = await supabase.from('category_suggestions').delete().eq('id', id);
    if (!alertOnError('Could not remove the suggestion', error)) onChanged();
  }

  const mine = suggestions.filter((s) => s.user_id === userId);
  return (
    <Card>
      <ThemedText type="label" themeColor="textSecondary">
        Suggest a category
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        The host can add it as a future round.
      </ThemedText>
      <TextField value={text} onChangeText={setText} placeholder="Songs to drive to at night" maxLength={120} />
      <Button title="Suggest" onPress={suggest} loading={sending} disabled={!text.trim()} />
      {mine.map((s) => (
        <View key={s.id} style={styles.row}>
          <ThemedText type="small" style={styles.grow}>
            {s.category}
          </ThemedText>
          <SmallButton label="✕" a11y={`Withdraw ${s.category}`} onPress={() => withdraw(s.id)} />
        </View>
      ))}
    </Card>
  );
}

function SmallButton({
  label,
  a11y,
  onPress,
  disabled,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.small,
        { backgroundColor: theme.background },
        (pressed || disabled) && styles.dimmed,
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  grow: {
    flex: 1,
  },
  subhead: {
    marginTop: Spacing.two,
  },
  small: {
    minWidth: 40,
    minHeight: 40,
    paddingHorizontal: Spacing.two,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.4,
  },
});

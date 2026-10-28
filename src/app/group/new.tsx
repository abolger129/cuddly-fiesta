import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ScoringRulesPicker } from '@/components/scoring-rules-picker';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { alertOnError } from '@/lib/errors';
import { DEFAULT_RULES } from '@/lib/scoring';
import { supabase } from '@/lib/supabase';

const STARTER_CATEGORIES = [
  'Songs about the weather',
  'A song from the year you were born',
  'Best opening track on an album',
  'Guilty pleasure',
];

export default function NewGroupScreen() {
  const [name, setName] = useState('');
  const [categories, setCategories] = useState(STARTER_CATEGORIES);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [creating, setCreating] = useState(false);

  const filledCategories = categories.map((c) => c.trim()).filter(Boolean);

  function updateCategory(index: number, text: string) {
    setCategories((current) => current.map((c, i) => (i === index ? text : c)));
  }

  function removeCategory(index: number) {
    setCategories((current) => current.filter((_, i) => i !== index));
  }

  async function create() {
    setCreating(true);
    const { data, error } = await supabase.rpc('create_group', {
      group_name: name.trim(),
      categories: filledCategories,
    });
    if (alertOnError('Could not create the group', error)) {
      setCreating(false);
      return;
    }
    if (rules.points_cap !== DEFAULT_RULES.points_cap || rules.downvotes !== DEFAULT_RULES.downvotes) {
      const { error: rulesError } = await supabase.from('groups').update(rules).eq('id', data);
      // The group exists either way; the creator can fix the rules on its page.
      alertOnError('Your group was made, but its scoring rules were not saved', rulesError);
    }
    setCreating(false);
    router.replace(`/group/${data}`);
  }

  return (
    <Screen>
      <ThemedText type="smallBold">Group name</ThemedText>
      <TextField value={name} onChangeText={setName} placeholder="Friday Night Tunes" maxLength={60} />

      <ThemedText type="smallBold">Rounds</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Each round has a category. Everyone picks one song that fits it.
      </ThemedText>
      {categories.map((category, index) => (
        <View key={index} style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.number}>
            {index + 1}
          </ThemedText>
          <TextField
            value={category}
            onChangeText={(text) => updateCategory(index, text)}
            placeholder="Category"
            maxLength={120}
            style={styles.field}
          />
          <Button
            title="✕"
            variant="secondary"
            accessibilityLabel={`Remove round ${index + 1}`}
            onPress={() => removeCategory(index)}
            style={styles.remove}
          />
        </View>
      ))}
      <Button
        title="Add a round"
        variant="secondary"
        onPress={() => setCategories((current) => [...current, ''])}
      />

      <ThemedText type="smallBold">Scoring</ThemedText>
      <ScoringRulesPicker rules={rules} onChange={setRules} />

      <Button
        title={`Create group with ${filledCategories.length} ${filledCategories.length === 1 ? 'round' : 'rounds'}`}
        onPress={create}
        loading={creating}
        disabled={!name.trim() || filledCategories.length === 0}
        style={styles.create}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  number: {
    width: 20,
    textAlign: 'right',
  },
  field: {
    flex: 1,
  },
  remove: {
    paddingHorizontal: Spacing.three,
  },
  create: {
    marginTop: Spacing.three,
  },
});

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { CategoryRoulette } from '@/components/category-roulette';
import { Screen } from '@/components/screen';
import { ScoringRulesPicker } from '@/components/scoring-rules-picker';
import { TextField } from '@/components/text-field';
import { TimerPicker } from '@/components/timer-picker';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { alertOnError } from '@/lib/errors';
import { DEFAULT_RULES, GUESS_BONUS_POINTS } from '@/lib/scoring';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/lib/types';

const STARTER_CATEGORIES = [
  'Songs about the weather',
  'A song from the year you were born',
  'Best opening track on an album',
  'Guilty pleasure',
];

export default function NewGroupScreen() {
  // Set when starting a rematch: the old league, whose players and rules carry over.
  const { rematch } = useLocalSearchParams<{ rematch?: string }>();
  const [rematchOf, setRematchOf] = useState<Group | null>(null);
  const [name, setName] = useState('');
  const [categories, setCategories] = useState(STARTER_CATEGORIES);
  const [guessing, setGuessing] = useState(false);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [submitHours, setSubmitHours] = useState<number | null>(24);
  const [voteHours, setVoteHours] = useState<number | null>(48);
  const [creating, setCreating] = useState(false);

  const filledCategories = categories.map((c) => c.trim()).filter(Boolean);

  useEffect(() => {
    if (!rematch) return;
    supabase
      .from('groups')
      .select('*')
      .eq('id', rematch)
      .single()
      .then(({ data }) => {
        const old = data as Group | null;
        if (!old) return;
        setRematchOf(old);
        setName(`${old.name}: Rematch`.slice(0, 60));
        setGuessing(old.guessing_enabled);
        setRules({ points_cap: old.points_cap, downvotes: old.downvotes });
        setSubmitHours(old.submit_hours);
        setVoteHours(old.vote_hours);
      });
  }, [rematch]);

  /** Put the roulette's category in the first empty round, or add a round for it. */
  function addCategory(category: string) {
    setCategories((current) => {
      const empty = current.findIndex((c) => !c.trim());
      return empty === -1 ? [...current, category] : current.map((c, i) => (i === empty ? category : c));
    });
  }

  function updateCategory(index: number, text: string) {
    setCategories((current) => current.map((c, i) => (i === index ? text : c)));
  }

  function removeCategory(index: number) {
    setCategories((current) => current.filter((_, i) => i !== index));
  }

  async function create() {
    setCreating(true);
    const { data, error } = rematchOf
      ? await supabase.rpc('rematch_league', {
          gid: rematchOf.id,
          group_name: name.trim(),
          categories: filledCategories,
        })
      : await supabase.rpc('create_group', {
          group_name: name.trim(),
          categories: filledCategories,
        });
    if (alertOnError('Could not create the league', error)) {
      setCreating(false);
      return;
    }
    const { error: settingsError } = await supabase
      .from('groups')
      .update({ ...rules, guessing_enabled: guessing, submit_hours: submitHours, vote_hours: voteHours })
      .eq('id', data);
    setCreating(false);
    // The league exists either way; the creator can fix its settings on its page.
    alertOnError('Your league was made, but its settings were not saved', settingsError);
    router.replace(`/group/${data}`);
  }

  return (
    <Screen>
      {rematch && <Stack.Screen options={{ title: 'Rematch' }} />}
      {rematchOf && (
        <ThemedText type="small" themeColor="textSecondary">
          Everyone from {rematchOf.name} is added to the new league, and you&apos;ll be the host. Its
          rules are filled in below.
        </ThemedText>
      )}
      <ThemedText type="smallBold">League name</ThemedText>
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
      <CategoryRoulette taken={categories} onPick={addCategory} />

      <ThemedText type="smallBold">Scoring</ThemedText>
      <ScoringRulesPicker rules={rules} onChange={setRules} />
      <View style={[styles.row, styles.setting]}>
        <View style={styles.field}>
          <ThemedText type="smallBold">Guess who picked it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Players guess who picked each song. Right guesses are worth {GUESS_BONUS_POINTS} bonus points.
          </ThemedText>
        </View>
        <Switch value={guessing} onValueChange={setGuessing} accessibilityLabel="Guess who picked it" />
      </View>

      <ThemedText type="smallBold" style={styles.section}>
        Round timers
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        When time runs out, the round moves on without anyone who hasn&apos;t played. You can change
        these later.
      </ThemedText>
      <TimerPicker label="Time to pick a song" value={submitHours} onChange={setSubmitHours} />
      <TimerPicker label="Time to rank the songs" value={voteHours} onChange={setVoteHours} />

      <Button
        title={`${rematchOf ? 'Start rematch' : 'Create league'} with ${filledCategories.length} ${filledCategories.length === 1 ? 'round' : 'rounds'}`}
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
  section: {
    marginTop: Spacing.three,
  },
  setting: {
    marginTop: Spacing.three,
  },
  create: {
    marginTop: Spacing.three,
  },
});

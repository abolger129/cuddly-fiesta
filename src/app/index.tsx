import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { Sleeve } from '@/components/sleeve';
import { ThemedText } from '@/components/themed-text';
import { colorForId, Spacing } from '@/constants/theme';
import { useLoader } from '@/hooks/use-loader';
import { useTheme } from '@/hooks/use-theme';
import { nameOf } from '@/lib/group-data';
import { isLeagueOver, placesFrom, songScores, standingsFor, type LeagueRecord } from '@/lib/history';
import { loadLeagueHistory } from '@/lib/history-data';
import { unregisterPushNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

export default function GroupsScreen() {
  const { data, error, loading, reload } = useLoader(loadLeagueHistory);
  const groups = data?.groups;
  const current = groups?.filter((g) => !isLeagueOver(g.rounds)) ?? [];
  const past = groups?.filter((g) => isLeagueOver(g.rounds)) ?? [];

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <View style={styles.actions}>
        <Button title="New group" onPress={() => router.push('/group/new')} style={styles.action} />
        <Button
          title="Join with code"
          variant="secondary"
          onPress={() => router.push('/group/join')}
          style={styles.action}
        />
      </View>

      {current.length > 0 && <SectionLabel>Your leagues</SectionLabel>}
      {current.map((group) => (
        <Sleeve
          key={group.id}
          color={colorForId(group.id)}
          kicker={`${group.total_rounds} ${group.total_rounds === 1 ? 'round' : 'rounds'}`}
          title={group.name}
          onPress={() => router.push(`/group/${group.id}`)}
        />
      ))}

      {past.length > 0 && <SectionLabel>Past leagues</SectionLabel>}
      {past.map((group) => {
        const record = data?.records.get(group.id);
        return record && <PastLeague key={group.id} league={record} />;
      })}

      {!loading && (error || groups?.length === 0) && (
        <View style={styles.empty}>
          <ThemedText type="smallBold">
            {error ? 'Could not load your groups' : 'No groups yet'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            {error ?? 'Start a group and share the invite code with your friends, or join one with a code.'}
          </ThemedText>
        </View>
      )}

      <View style={styles.footer}>
        {past.length > 0 && <Button title="Stats" variant="secondary" onPress={() => router.push('/stats')} />}
        <Button title="Settings" variant="secondary" onPress={() => router.push('/profile')} />
        <Button title="Sign out" variant="secondary" onPress={async () => {
            await unregisterPushNotifications();
            await supabase.auth.signOut();
          }} />
      </View>
    </Screen>
  );
}

/** A finished league: who won, and the song of the league. */
function PastLeague({ league }: { league: LeagueRecord }) {
  const theme = useTheme();
  const standings = standingsFor(league);
  const places = placesFrom(standings);
  const winners = standings.filter((s) => places.get(s.userId) === 1);
  const best = songScores(league)[0];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/group/${league.group.id}`)}
      style={({ pressed }) => [styles.past, { borderBottomColor: theme.rule }, pressed && styles.pressed]}>
      <ThemedText type="smallBold">{league.group.name}</ThemedText>
      {winners.length > 0 && (
        <ThemedText type="small">
          {winners.length > 1 ? 'Joint winners' : 'Winner'}: {winners.map((w) => nameOf(league.members, w.userId)).join(' & ')} ·{' '}
          {winners[0].points} pts
        </ThemedText>
      )}
      {best && best.points > 0 && (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          Song of the league: {best.submission.track_name} by {best.submission.artist_name}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  past: {
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.7,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.six,
  },
  centered: {
    textAlign: 'center',
  },
  footer: {
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
});

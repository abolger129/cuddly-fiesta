import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLoader } from '@/hooks/use-loader';
import { useAuth } from '@/lib/auth';
import { playerStats, type PlayerStats } from '@/lib/history';
import { loadLeagueHistory } from '@/lib/history-data';

/** Everyone you've played with, across all your leagues. */
export default function StatsScreen() {
  const { session } = useAuth();
  const { data, error, loading, reload } = useLoader(loadLeagueHistory);
  const stats = data ? playerStats([...data.records.values()]) : [];

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error && <ThemedText>{error}</ThemedText>}
      <ThemedText type="small" themeColor="textSecondary">
        Wins and places count finished leagues. Songs and artists count every finished round.
      </ThemedText>
      {stats.map((s) => (
        <PlayerCard key={s.userId} stats={s} isYou={s.userId === session?.user.id} />
      ))}
    </Screen>
  );
}

function PlayerCard({ stats, isYou }: { stats: PlayerStats; isYou: boolean }) {
  return (
    <Card>
      <ThemedText type="smallBold">
        {stats.name}
        {isYou ? ' (you)' : ''}
      </ThemedText>
      <View style={styles.numbers}>
        <Stat label="Wins" value={String(stats.wins)} />
        <Stat
          label="Avg place"
          value={stats.averagePlace == null ? '–' : stats.averagePlace.toFixed(1)}
        />
        <Stat label="Leagues" value={String(stats.leaguesFinished)} />
        <Stat label="Songs" value={String(stats.songsPicked)} />
      </View>
      {stats.topArtists.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Picks most: {stats.topArtists.map((a) => `${a.name} (${a.count})`).join(', ')}
        </ThemedText>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="mono">{value}</ThemedText>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  numbers: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  stat: {
    flex: 1,
  },
});

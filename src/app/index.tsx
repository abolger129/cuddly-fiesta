import { router, Stack } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Figure, ScribbleCircle } from '@/components/doodles';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { Sleeve, Sticker } from '@/components/sleeve';
import { statusText } from '@/components/status-label';
import { ThemedText } from '@/components/themed-text';
import { colorForId, Fonts, OnSleeve, Spacing } from '@/constants/theme';
import { useLoader } from '@/hooks/use-loader';
import { useTheme } from '@/hooks/use-theme';
import { nameOf } from '@/lib/group-data';
import { isLeagueOver, placesFrom, standingsFor, type LeagueRecord } from '@/lib/history';
import { loadLeagueHistory, type LeagueHistory } from '@/lib/history-data';

export default function GroupsScreen() {
  const { data, error, loading, reload } = useLoader(loadLeagueHistory);
  const groups = data?.groups;
  const current = groups?.filter((g) => !isLeagueOver(g.rounds)) ?? [];
  const past = groups?.filter((g) => isLeagueOver(g.rounds)) ?? [];

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Stack.Screen
        options={{
          headerTitle: () => <HeaderTitle />,
          headerRight: () => <HeaderButtons me={data?.me ?? null} showStats={past.length > 0} />,
        }}
      />
      <View style={styles.actions}>
        <Button title="New league" onPress={() => router.push('/group/new')} style={styles.action} />
        <Button
          title="Join with code"
          variant="secondary"
          onPress={() => router.push('/group/join')}
          style={styles.action}
        />
      </View>

      {current.length > 0 && <SectionLabel>Your leagues</SectionLabel>}
      {current.map((group) => (
        <CurrentLeague key={group.id} group={group} yourTurn={!!data?.yourTurn.has(group.id)} />
      ))}

      {past.length > 0 && <SectionLabel>Past leagues</SectionLabel>}
      <View>
        {past.map((group) => {
          const record = data?.records.get(group.id);
          return record && <PastLeague key={group.id} league={record} myId={data?.me?.id} />;
        })}
      </View>

      {!loading && (error || groups?.length === 0) && (
        <View style={styles.empty}>
          <Figure height={110} label="A stick figure, cowering" />
          <ThemedText type="smallBold">{error ? 'Could not load your leagues' : 'No leagues yet'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            {error ?? 'Start a league and send your friends the invite, or join one with a code.'}
          </ThemedText>
        </View>
      )}
    </Screen>
  );
}

function HeaderTitle() {
  return (
    <View style={styles.headerTitle}>
      <Figure height={28} />
      <ThemedText type="smallBold" style={styles.headerTitleText}>
        The Gauntlet
      </ThemedText>
    </View>
  );
}

function HeaderButtons({ me, showStats }: { me: LeagueHistory['me']; showStats: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.headerButtons}>
      {showStats && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stats"
          hitSlop={8}
          onPress={() => router.push('/stats')}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
            <Path d="M5 20V11M12 20V4M19 20v-6" stroke={theme.text} strokeWidth={2} strokeLinecap="round" fill="none" />
          </Svg>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        hitSlop={8}
        onPress={() => router.push('/profile')}
        style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
        {me ? <Avatar profile={me} size={32} /> : <View style={[styles.avatarBlank, { backgroundColor: theme.backgroundSelected }]} />}
      </Pressable>
    </View>
  );
}

/** A league in progress: where it's up to, and a sticker if it's waiting on you. */
function CurrentLeague({ group, yourTurn }: { group: LeagueHistory['groups'][number]; yourTurn: boolean }) {
  const open = group.rounds.find((r) => r.status === 'submitting' || r.status === 'voting');
  const played = group.rounds.filter((r) => r.status === 'finished').length;
  const kicker = open
    ? `Round ${open.round_number} of ${group.total_rounds} · ${statusText(open.status)}`
    : played === 0
      ? `${group.total_rounds} ${group.total_rounds === 1 ? 'round' : 'rounds'} · Not started`
      : `${played} of ${group.total_rounds} rounds played`;
  return (
    <Sleeve
      color={colorForId(group.id)}
      kicker={kicker}
      stamp={yourTurn ? <Sticker text="Your turn" /> : undefined}
      title={group.name}
      onPress={() => router.push(`/group/${group.id}`)}>
      {open && (
        <ThemedText type="small" style={styles.sleeveNote} numberOfLines={2}>
          {open.category}
        </ThemedText>
      )}
    </Sleeve>
  );
}

/** A finished league: who won, and where you came. Wins get circled. */
function PastLeague({ league, myId }: { league: LeagueRecord; myId?: string }) {
  const theme = useTheme();
  const standings = standingsFor(league);
  const places = placesFrom(standings);
  const winners = standings.filter((s) => places.get(s.userId) === 1);
  const myPlace = myId ? places.get(myId) : undefined;
  const winnerNames = winners.map((w) => (w.userId === myId ? 'you' : nameOf(league.members, w.userId)));
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/group/${league.group.id}`)}
      style={({ pressed }) => [styles.past, { borderBottomColor: theme.rule }, pressed && styles.pressed]}>
      <View style={[styles.pastCover, { backgroundColor: colorForId(league.group.id) }]} />
      <View style={styles.grow}>
        <ThemedText type="smallBold">{league.group.name}</ThemedText>
        {winners.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {winners.length > 1 ? 'Joint winners' : 'Winner'}: {winnerNames.join(' & ')} · {winners[0].points} pts
          </ThemedText>
        )}
      </View>
      {myPlace !== undefined && (
        <View style={styles.place}>
          {myPlace === 1 && <ScribbleCircle width={52} height={36} style={styles.circle} />}
          <ThemedText
            type={myPlace === 1 ? 'hand' : 'mono'}
            themeColor={myPlace === 1 ? undefined : 'textSecondary'}
            style={myPlace === 1 && { color: theme.accent }}>
            {ordinal(myPlace)}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

const styles = StyleSheet.create({
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerTitleText: {
    fontFamily: Fonts.display,
    fontSize: 20,
    lineHeight: 24,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerButton: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBlank: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  sleeveNote: {
    color: OnSleeve,
    opacity: 0.9,
  },
  past: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pastCover: {
    width: 44,
    height: 44,
    borderRadius: 3,
  },
  place: {
    width: 52,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
  },
  grow: {
    flex: 1,
    gap: Spacing.half,
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
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  centered: {
    textAlign: 'center',
  },
});

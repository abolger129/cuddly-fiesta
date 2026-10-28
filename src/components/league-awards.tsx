import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { nameOf } from '@/lib/group-data';
import { leagueAwards, type LeagueRecord } from '@/lib/history';

/** End-of-league awards, shown once every round is finished. */
export function LeagueAwards({ league }: { league: LeagueRecord }) {
  const { bestSong, mostControversial, bestGuesser, tasteTwins } = leagueAwards(league);
  const who = (userId: string) => nameOf(league.members, userId);

  const awards = [
    bestSong && {
      title: 'Song of the league',
      detail: `${bestSong.submission.track_name} by ${bestSong.submission.artist_name}, picked by ${who(bestSong.submission.user_id)} (${bestSong.points} pts)`,
    },
    mostControversial && {
      title: 'Most controversial',
      detail: `${mostControversial.track_name} by ${mostControversial.artist_name}, picked by ${who(mostControversial.user_id)}. Some loved it, some really didn't.`,
    },
    bestGuesser && {
      title: 'Best guesser',
      detail: `${who(bestGuesser.userId)}, with ${bestGuesser.correct} right ${bestGuesser.correct === 1 ? 'guess' : 'guesses'}`,
    },
    tasteTwins && {
      title: 'Taste twins',
      detail: `${who(tasteTwins.userIds[0])} and ${who(tasteTwins.userIds[1])}, whose rankings agreed ${Math.round(tasteTwins.agreement * 100)}% of the way`,
    },
  ].filter((a) => !!a);

  if (awards.length === 0) return null;
  return (
    <Card>
      {awards.map((a) => (
        <View key={a.title} style={styles.award}>
          <ThemedText type="label" themeColor="textSecondary">
            {a.title}
          </ThemedText>
          <ThemedText type="small">{a.detail}</ThemedText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  award: {
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
});

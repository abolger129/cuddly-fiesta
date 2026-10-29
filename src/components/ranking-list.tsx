import { useState, type ReactElement } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import ReorderableList, {
  reorderItems,
  useIsActive,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';

import { SongRow, TrackNumber } from '@/components/song-row';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { YoutubeTag } from '@/components/youtube-tag';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { songUrl } from '@/lib/song-links';
import { trackLabel } from '@/lib/track-labels';
import type { RoundSong } from '@/lib/types';

export const MAX_COMMENT_LENGTH = 280;

type RankingListProps = {
  songs: RoundSong[];
  onChange: (songs: RoundSong[]) => void;
  /** Points a song in this position (1 = top) would get under the league's rules. */
  pointsFor: (position: number) => number;
  /** Your comment on each song, by song id. */
  comments: Record<string, string>;
  onCommentChange: (songId: string, comment: string) => void;
  header?: ReactElement;
  footer?: ReactElement;
};

/** Drag songs up and down to rank them. The top song is your favourite. */
export function RankingList({
  songs,
  onChange,
  pointsFor,
  comments,
  onCommentChange,
  header,
  footer,
}: RankingListProps) {
  function handleReorder({ from, to }: ReorderableListReorderEvent) {
    onChange(reorderItems(songs, from, to));
  }

  return (
    <ReorderableList
      data={songs}
      keyExtractor={(song) => song.id}
      onReorder={handleReorder}
      shouldUpdateActiveItem
      renderItem={({ item, index }) => (
        <RankingRow
          song={item}
          position={index + 1}
          total={songs.length}
          points={pointsFor(index + 1)}
          comment={comments[item.id] ?? ''}
          onCommentChange={(comment) => onCommentChange(item.id, comment)}
        />
      )}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      // Keep the comment box you're typing in above the keyboard.
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={styles.list}
    />
  );
}

type RankingRowProps = {
  song: RoundSong;
  position: number;
  total: number;
  points: number;
  comment: string;
  onCommentChange: (comment: string) => void;
};

function RankingRow({ song, position, total, points, comment, onCommentChange }: RankingRowProps) {
  const drag = useReorderableDrag();
  const isActive = useIsActive();
  const theme = useTheme();
  // With a keyboard on the web, every comment box is open so you can Tab from one song to the next.
  const [commenting, setCommenting] = useState(Platform.OS === 'web' || comment !== '');
  const url = songUrl(song);

  return (
    <Pressable
      onPress={url ? (e) => !isInTextBox(e) && Linking.openURL(url) : undefined}
      onLongPress={drag}
      delayLongPress={150}
      // Skipped by Tab on the web, so Tab goes straight from one comment box to the next.
      tabIndex={Platform.OS === 'web' ? -1 : undefined}
      accessibilityHint="Press and hold, then drag to change its rank">
      <ThemedView
        type={isActive ? 'backgroundElement' : 'background'}
        style={[styles.row, { borderBottomColor: isActive ? 'transparent' : theme.rule }, isActive && styles.lifted]}>
        <SongRow
          trackName={song.track_name}
          artistName={song.artist_name}
          albumArtUrl={song.album_art_url}
          leading={<TrackNumber label={trackLabel(position - 1, total)} />}
          credit={song.youtube_url ? <YoutubeTag /> : undefined}
          trailing={
            <View style={styles.trailing}>
              <ThemedText type="mono" themeColor={points < 0 ? 'danger' : 'textSecondary'}>
                {formatPoints(points)}
              </ThemedText>
              <Pressable
                onPressIn={drag}
                hitSlop={Spacing.three}
                tabIndex={Platform.OS === 'web' ? -1 : undefined}
                accessibilityLabel="Drag to reorder">
                <ThemedText themeColor="textSecondary" style={styles.handle}>
                  ≡
                </ThemedText>
              </Pressable>
            </View>
          }
        />
        {commenting ? (
          <TextField
            value={comment}
            onChangeText={onCommentChange}
            placeholder="Say something about this song"
            maxLength={MAX_COMMENT_LENGTH}
            multiline
            autoFocus={Platform.OS !== 'web' && comment === ''}
            onBlur={() => setCommenting(Platform.OS === 'web' || comment.trim() !== '')}
            style={[styles.comment, { backgroundColor: theme.backgroundElement }]}
            accessibilityLabel={`Comment on ${song.track_name}`}
          />
        ) : (
          <Pressable
            onPress={() => setCommenting(true)}
            hitSlop={Spacing.two}
            accessibilityRole="button"
            accessibilityLabel={`Add a comment on ${song.track_name}`}
            style={({ pressed }) => [styles.addComment, { borderColor: theme.accent }, pressed && styles.pressed]}>
            <ThemedText type="smallBold" themeColor="accent">
              💬 Add a comment
            </ThemedText>
          </Pressable>
        )}
      </ThemedView>
    </Pressable>
  );
}

/** On the web, a click in the comment box also reaches the row around it. */
function isInTextBox(e: GestureResponderEvent): boolean {
  const target = e.target as unknown as { tagName?: string } | null;
  return Platform.OS === 'web' && target?.tagName === 'TEXTAREA';
}

function formatPoints(points: number): string {
  if (points < 0) return `−${-points} pt`;
  return `${points} ${points === 1 ? 'pt' : 'pts'}`;
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  // Rows sit flush like a tracklist, split by hairline rules, so drag positions line up.
  row: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.one,
    gap: Spacing.two,
  },
  lifted: {
    transform: [{ scale: 1.02 }],
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  comment: {
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  addComment: {
    alignSelf: 'flex-start',
    marginLeft: 24 + Spacing.three,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.6,
  },
  handle: {
    fontSize: 24,
    paddingHorizontal: Spacing.one,
  },
});

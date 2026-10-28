import { useState, type ReactElement } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import ReorderableList, {
  reorderItems,
  useIsActive,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';

import { SongRow } from '@/components/song-row';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { spotifyTrackUrl } from '@/lib/spotify';
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
          points={pointsFor(index + 1)}
          comment={comments[item.id] ?? ''}
          onCommentChange={(comment) => onCommentChange(item.id, comment)}
        />
      )}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={styles.list}
    />
  );
}

type RankingRowProps = {
  song: RoundSong;
  position: number;
  points: number;
  comment: string;
  onCommentChange: (comment: string) => void;
};

function RankingRow({ song, position, points, comment, onCommentChange }: RankingRowProps) {
  const drag = useReorderableDrag();
  const isActive = useIsActive();
  const theme = useTheme();
  const [commenting, setCommenting] = useState(comment !== '');
  const trackId = song.spotify_track_id;

  return (
    <Pressable
      onPress={trackId ? () => Linking.openURL(spotifyTrackUrl(trackId)) : undefined}
      onLongPress={drag}
      delayLongPress={150}
      style={styles.cell}
      accessibilityHint="Press and hold, then drag to change its rank">
      <ThemedView type={isActive ? 'backgroundSelected' : 'backgroundElement'} style={styles.row}>
        <SongRow
          trackName={song.track_name}
          artistName={song.artist_name}
          albumArtUrl={song.album_art_url}
          leading={
            <ThemedText type="smallBold" style={styles.position}>
              {position}
            </ThemedText>
          }
          trailing={
            <View style={styles.trailing}>
              <ThemedText type="small" themeColor={points < 0 ? 'danger' : 'textSecondary'}>
                {formatPoints(points)}
              </ThemedText>
              <Pressable onPressIn={drag} hitSlop={Spacing.three} accessibilityLabel="Drag to reorder">
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
            autoFocus={comment === ''}
            onBlur={() => setCommenting(comment.trim() !== '')}
            style={[styles.comment, { backgroundColor: theme.background }]}
            accessibilityLabel={`Comment on ${song.track_name}`}
          />
        ) : (
          <Pressable onPress={() => setCommenting(true)} hitSlop={Spacing.two} style={styles.addComment}>
            <ThemedText type="small" themeColor="textSecondary">
              + Add a comment
            </ThemedText>
          </Pressable>
        )}
      </ThemedView>
    </Pressable>
  );
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
  // Spacing between rows is padding inside each cell so drag positions line up.
  cell: {
    paddingBottom: Spacing.two,
  },
  row: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
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
  },
  position: {
    width: 20,
    textAlign: 'center',
  },
  handle: {
    fontSize: 24,
    paddingHorizontal: Spacing.one,
  },
});

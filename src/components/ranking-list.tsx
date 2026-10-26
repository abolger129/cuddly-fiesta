import type { ReactElement } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import ReorderableList, {
  reorderItems,
  useIsActive,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';

import { SongRow } from '@/components/song-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { RoundSong } from '@/lib/types';

type RankingListProps = {
  songs: RoundSong[];
  onChange: (songs: RoundSong[]) => void;
  header?: ReactElement;
  footer?: ReactElement;
};

/** Drag songs up and down to rank them. The top song is your favourite. */
export function RankingList({ songs, onChange, header, footer }: RankingListProps) {
  function handleReorder({ from, to }: ReorderableListReorderEvent) {
    onChange(reorderItems(songs, from, to));
  }

  return (
    <ReorderableList
      data={songs}
      keyExtractor={(song) => song.id}
      onReorder={handleReorder}
      shouldUpdateActiveItem
      renderItem={({ item, index }) => <RankingRow song={item} position={index + 1} />}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={styles.list}
    />
  );
}

function RankingRow({ song, position }: { song: RoundSong; position: number }) {
  const drag = useReorderableDrag();
  const isActive = useIsActive();

  return (
    <Pressable
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
            <Pressable onPressIn={drag} hitSlop={Spacing.three} accessibilityLabel="Drag to reorder">
              <ThemedText themeColor="textSecondary" style={styles.handle}>
                ≡
              </ThemedText>
            </Pressable>
          }
        />
      </ThemedView>
    </Pressable>
  );
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

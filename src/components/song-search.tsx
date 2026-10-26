import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { SongRow } from '@/components/song-row';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { searchTracks, type SpotifyTrack } from '@/lib/spotify';

type SongSearchProps = {
  onPick: (track: SpotifyTrack) => void;
  disabled?: boolean;
};

/** Search Spotify as you type and tap a result to pick it. */
export function SongSearch({ onPick, disabled }: SongSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    let cancelled = false;
    // Wait for a pause in typing before searching.
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const tracks = await searchTracks(trimmed);
        if (!cancelled) {
          setResults(tracks);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const showResults = query.trim().length >= 2;

  return (
    <View style={styles.container}>
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search Spotify for a song"
        autoCorrect={false}
        returnKeyType="search"
      />
      {showResults && searching && <ActivityIndicator />}
      {error && (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      )}
      {showResults &&
        results.map((track) => (
          <Pressable
            key={track.spotify_track_id}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => onPick(track)}
            style={({ pressed }) => [styles.result, pressed && styles.pressed]}>
            <SongRow
              trackName={track.track_name}
              artistName={track.artist_name}
              albumArtUrl={track.album_art_url}
              trailing={<ThemedText type="smallBold">Pick</ThemedText>}
            />
          </Pressable>
        ))}
      {showResults && !searching && !error && results.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No songs found.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  result: {
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
});

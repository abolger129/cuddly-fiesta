import { ThemedText } from '@/components/themed-text';

/** Marks a song that isn't on Spotify and plays on YouTube instead. */
export function YoutubeTag() {
  return (
    <ThemedText type="mono" themeColor="danger" numberOfLines={1}>
      ▶ On YouTube, not Spotify
    </ThemedText>
  );
}

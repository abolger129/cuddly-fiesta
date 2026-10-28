import { useEffect, useState } from 'react';
import { Linking, Share } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import type { RoundDetails } from '@/lib/round-data';
import { songListText } from '@/lib/song-links';
import { makeRoundPlaylist } from '@/lib/spotify';

type PlaylistCardProps = {
  details: RoundDetails;
};

/**
 * Exporting the round. The Spotify playlist is made automatically, on the
 * app's own Spotify account, the first time anyone opens the round once
 * ranking starts, so nobody has to connect Spotify. Anyone can also share the
 * song list as text.
 */
export function PlaylistCard({ details }: PlaylistCardProps) {
  const { round, group, songs } = details;
  const [url, setUrl] = useState(round.playlist_url);
  const spotifySongs = songs.filter((s) => s.spotify_track_id).length;
  const [making, setMaking] = useState(!round.playlist_url && spotifySongs > 0);
  const [failed, setFailed] = useState<string | null>(null);

  // Kicks off once; retry runs it again.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (round.playlist_url || spotifySongs === 0) return;
    makeRoundPlaylist(round.id)
      .then((link) => {
        setUrl(link);
        setFailed(null);
      })
      .catch((e) => setFailed(e instanceof Error ? e.message : String(e)))
      .finally(() => setMaking(false));
  }, [round.id, round.playlist_url, spotifySongs, attempt]);

  function retry() {
    setMaking(true);
    setAttempt((n) => n + 1);
  }

  const youtubeOnly = songs.filter((s) => s.youtube_url).length;
  const youtubeNote = youtubeOnly > 0 && (
    <ThemedText type="small" themeColor="textSecondary">
      {youtubeOnly === 1 ? '1 song isn’t' : `${youtubeOnly} songs aren’t`} on Spotify, so{' '}
      {youtubeOnly === 1 ? 'it’s' : 'they’re'} not in the playlist. Tap{' '}
      {youtubeOnly === 1 ? 'it' : 'them'} in the list to play on YouTube.
    </ThemedText>
  );

  const title = `${group.name}: Round ${round.round_number}`;

  function shareSongList() {
    Share.share({ message: songListText(`${title} · ${round.category}`, songs) }).catch(() => {});
  }

  return (
    <Card>
      <ThemedText type="smallBold">Round playlist</ThemedText>
      {url ? (
        <Button title="Open playlist in Spotify" onPress={() => Linking.openURL(url)} />
      ) : failed ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            The Spotify playlist couldn&apos;t be made: {failed}
          </ThemedText>
          <Button title="Try again" onPress={retry} loading={making} />
        </>
      ) : making ? (
        <Button title="Making the Spotify playlist…" onPress={() => {}} loading disabled />
      ) : null}
      <Button title="Share the song list" variant="secondary" onPress={shareSongList} disabled={songs.length === 0} />
      {youtubeNote}
    </Card>
  );
}

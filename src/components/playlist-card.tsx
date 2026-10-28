import { useEffect, useState } from 'react';
import { Linking, Share } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { alertOnError } from '@/lib/errors';
import { nameOf } from '@/lib/group-data';
import type { RoundDetails } from '@/lib/round-data';
import { songListText } from '@/lib/song-links';
import { canConnectSpotify, createPlaylist, isSpotifyConnected, useConnectSpotify } from '@/lib/spotify';
import { supabase } from '@/lib/supabase';

type PlaylistCardProps = {
  details: RoundDetails;
  isCreator: boolean;
  onChanged: () => void;
};

/**
 * Exporting the round. The group creator makes a Spotify playlist on their own
 * account once ranking opens and everyone else gets the link. Anyone can share
 * the song list as text, which works without Spotify.
 */
export function PlaylistCard({ details, isCreator, onChanged }: PlaylistCardProps) {
  const { round, group, songs, members } = details;
  const { connect, connecting } = useConnectSpotify();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    isSpotifyConnected().then(setConnected);
  }, []);

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

  const shareButton = (
    <Button title="Share the song list" variant="secondary" onPress={shareSongList} disabled={songs.length === 0} />
  );

  if (round.playlist_url) {
    const url = round.playlist_url;
    return (
      <Card>
        <ThemedText type="smallBold">Round playlist</ThemedText>
        <Button title="Open playlist in Spotify" onPress={() => Linking.openURL(url)} />
        {shareButton}
        {youtubeNote}
      </Card>
    );
  }

  if (!isCreator) {
    return (
      <Card>
        <ThemedText type="smallBold">Round playlist</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {nameOf(members, group.created_by)} hosts this league, so the Spotify playlist goes on their
          account. The link shows up here once they make it. Until then, tap a song to hear it or
          share the song list.
        </ThemedText>
        {shareButton}
        {youtubeNote}
      </Card>
    );
  }

  const trackIds = songs.flatMap((s) => (s.spotify_track_id ? [s.spotify_track_id] : []));

  async function connectAccount() {
    try {
      if (await connect()) setConnected(true);
    } catch (e) {
      alertOnError('Could not connect Spotify', { message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function makePlaylist() {
    setCreating(true);
    try {
      const url = await createPlaylist(
        title,
        `The Gauntlet round ${round.round_number}: ${round.category}`,
        trackIds
      );
      const { error } = await supabase.from('rounds').update({ playlist_url: url }).eq('id', round.id);
      if (!alertOnError('Playlist made, but the link could not be saved', error)) onChanged();
    } catch (e) {
      alertOnError('Could not make the playlist', { message: e instanceof Error ? e.message : String(e) });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <ThemedText type="smallBold">Round playlist</ThemedText>
      {!canConnectSpotify ? (
        <ThemedText type="small" themeColor="textSecondary">
          Spotify playlists can&apos;t be made in Expo Go because Spotify can&apos;t send you back to
          it after you sign in. Open The Gauntlet from an installed build to connect Spotify. You can
          still share the song list.
        </ThemedText>
      ) : connected ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Make a playlist of this round&apos;s {trackIds.length} songs on your Spotify account and
            share it with the group.
          </ThemedText>
          {youtubeNote}
          <Button
            title="Make Spotify playlist"
            onPress={makePlaylist}
            loading={creating}
            disabled={trackIds.length === 0}
          />
        </>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Connect your Spotify account to make a playlist for each round. Only you need to connect;
            everyone else just gets the link.
          </ThemedText>
          <Button
            title="Connect Spotify"
            onPress={connectAccount}
            loading={connecting || connected === null}
          />
        </>
      )}
      {shareButton}
    </Card>
  );
}

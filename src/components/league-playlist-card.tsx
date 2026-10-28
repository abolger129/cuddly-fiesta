import { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { alertOnError } from '@/lib/errors';
import type { GroupDetails } from '@/lib/group-data';
import {
  createPlaylist,
  isSpotifyConnected,
  replacePlaylistTracks,
  useConnectSpotify,
} from '@/lib/spotify';
import { supabase } from '@/lib/supabase';

type LeaguePlaylistCardProps = {
  details: GroupDetails;
  isCreator: boolean;
  onChanged: () => void;
};

/**
 * One playlist with every song from the league's finished rounds, in round
 * order. Like round playlists, the group creator makes it on their own Spotify
 * account and can refresh it as more rounds finish; everyone else gets the link.
 */
export function LeaguePlaylistCard({ details, isCreator, onChanged }: LeaguePlaylistCardProps) {
  const { group, rounds, submissions } = details;
  const { connect, connecting } = useConnectSpotify();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isCreator) isSpotifyConnected().then(setConnected);
  }, [isCreator]);

  // Submissions only cover finished rounds; songs typed in by hand are skipped.
  const roundNumber = new Map(rounds.map((r) => [r.id, r.round_number]));
  const trackIds = [
    ...new Set(
      [...submissions]
        .sort((a, b) => (roundNumber.get(a.round_id) ?? 0) - (roundNumber.get(b.round_id) ?? 0))
        .flatMap((s) => (s.spotify_track_id ? [s.spotify_track_id] : []))
    ),
  ];
  const url = group.playlist_url;

  if (!isCreator) {
    if (!url) return null;
    return (
      <Card>
        <ThemedText type="smallBold">League playlist</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Every song from the finished rounds in one place.
        </ThemedText>
        <Button title="Open league playlist in Spotify" onPress={() => Linking.openURL(url)} />
      </Card>
    );
  }

  if (!url && trackIds.length === 0) return null;

  async function connectAccount() {
    try {
      if (await connect()) setConnected(true);
    } catch (e) {
      alertOnError('Could not connect Spotify', { message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function makePlaylist() {
    setSaving(true);
    try {
      const newUrl = await createPlaylist(
        `${group.name}: The whole league`,
        `Every song from ${group.name} on The Gauntlet`,
        trackIds
      );
      const { error } = await supabase.from('groups').update({ playlist_url: newUrl }).eq('id', group.id);
      if (!alertOnError('Playlist made, but the link could not be saved', error)) onChanged();
    } catch (e) {
      alertOnError('Could not make the playlist', { message: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function updatePlaylist(playlistUrl: string) {
    setSaving(true);
    try {
      await replacePlaylistTracks(playlistUrl, trackIds);
      Alert.alert('League playlist updated', `It now has ${trackIds.length} songs.`);
    } catch (e) {
      alertOnError('Could not update the playlist', { message: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <ThemedText type="smallBold">League playlist</ThemedText>
      {url && (
        <Button title="Open league playlist in Spotify" onPress={() => Linking.openURL(url)} />
      )}
      {connected ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {url
              ? `Bring it up to date with all ${trackIds.length} songs from the finished rounds.`
              : `Make one playlist with all ${trackIds.length} songs from the finished rounds and share it with the group.`}
          </ThemedText>
          <Button
            title={url ? 'Update league playlist' : 'Make league playlist'}
            variant={url ? 'secondary' : 'primary'}
            onPress={() => (url ? updatePlaylist(url) : makePlaylist())}
            loading={saving}
            disabled={trackIds.length === 0}
          />
        </>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Connect your Spotify account to make a playlist of every song in this league.
          </ThemedText>
          <Button
            title="Connect Spotify"
            onPress={connectAccount}
            loading={connecting || connected === null}
          />
        </>
      )}
    </Card>
  );
}

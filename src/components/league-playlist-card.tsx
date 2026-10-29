import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import type { GroupDetails } from '@/lib/group-data';
import { shareText } from '@/lib/share';
import { songListText } from '@/lib/song-links';
import { syncLeaguePlaylist } from '@/lib/spotify';

type LeaguePlaylistCardProps = {
  details: GroupDetails;
};

/**
 * One playlist with every song from the league's finished rounds, in round
 * order. Like round playlists it's made automatically on the app's Spotify
 * account, and opening the league brings it up to date as more rounds finish.
 */
export function LeaguePlaylistCard({ details }: LeaguePlaylistCardProps) {
  const { group, rounds, submissions } = details;
  const [url, setUrl] = useState(group.playlist_url);

  // Submissions only cover finished rounds; songs typed in by hand are skipped.
  const roundNumber = new Map(rounds.map((r) => [r.id, r.round_number]));
  const inRoundOrder = [...submissions].sort(
    (a, b) => (roundNumber.get(a.round_id) ?? 0) - (roundNumber.get(b.round_id) ?? 0)
  );
  const trackCount = new Set(inRoundOrder.flatMap((s) => (s.spotify_track_id ? [s.spotify_track_id] : []))).size;

  const [syncing, setSyncing] = useState(trackCount > 0);
  const [failed, setFailed] = useState<string | null>(null);

  // Runs whenever more finished songs show up; retry runs it again.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (trackCount === 0) return;
    syncLeaguePlaylist(group.id)
      .then((link) => {
        setUrl(link);
        setFailed(null);
      })
      .catch((e) => setFailed(e instanceof Error ? e.message : String(e)))
      .finally(() => setSyncing(false));
  }, [group.id, trackCount, attempt]);

  function retry() {
    setSyncing(true);
    setAttempt((n) => n + 1);
  }

  if (submissions.length === 0 && !url) {
    return (
      <Card>
        <ThemedText type="smallBold">League playlist</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Once the first round finishes, every song in the league goes on one Spotify playlist.
          Each round also gets its own playlist on its round page.
        </ThemedText>
      </Card>
    );
  }

  return (
    <Card>
      <ThemedText type="smallBold">League playlist</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Every song from the finished rounds in one place. It updates itself as rounds finish.
      </ThemedText>
      {url ? (
        <Button title="Open league playlist in Spotify" onPress={() => Linking.openURL(url)} />
      ) : (
        syncing && !failed && <Button title="Making the Spotify playlist…" onPress={() => {}} loading disabled />
      )}
      {failed && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            The Spotify playlist couldn&apos;t be {url ? 'updated' : 'made'}: {failed}
          </ThemedText>
          <Button title="Try again" variant="secondary" onPress={retry} loading={syncing} />
        </>
      )}
      <Button
        title="Share the song list"
        variant="secondary"
        onPress={() =>
          shareText(songListText(`${group.name}: The whole league`, inRoundOrder)).catch(() => {})
        }
      />
    </Card>
  );
}

import {
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
  TokenResponse,
  useAuthRequest,
} from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';

import { deleteSecureItem, getSecureItem, setSecureItem } from '@/lib/secure-storage';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

/** Must also be added as a Redirect URI in the Spotify app's settings. */
export const spotifyRedirectUri = makeRedirectUri({
  native: 'musicleague://spotify-auth',
  path: 'spotify-auth',
});

const TOKEN_KEY = 'spotify-token';

export type SpotifyTrack = {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  album_art_url: string | null;
};

export function spotifyTrackUrl(trackId: string) {
  return `https://open.spotify.com/track/${trackId}`;
}

// Song search ------------------------------------------------------------------

/** Search runs on Supabase so the Spotify secret stays off the phone. */
export async function searchTracks(query: string): Promise<SpotifyTrack[]> {
  const { data, error } = await supabase.functions.invoke('spotify-search', {
    body: { query },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.tracks;
}

// Connecting the group creator's account ------------------------------------------

async function saveToken(token: TokenResponse) {
  await setSecureItem(TOKEN_KEY, JSON.stringify(token.getRequestConfig()));
}

async function loadToken(): Promise<TokenResponse | null> {
  const saved = await getSecureItem(TOKEN_KEY);
  return saved ? new TokenResponse(JSON.parse(saved)) : null;
}

export async function isSpotifyConnected() {
  return (await loadToken()) !== null;
}

export async function disconnectSpotify() {
  await deleteSecureItem(TOKEN_KEY);
}

/** A fresh access token for the connected account, refreshing it if needed. */
async function getAccessToken(): Promise<string> {
  let token = await loadToken();
  if (!token) throw new Error('Connect Spotify first');
  if (token.shouldRefresh()) {
    const refreshed = await refreshAsync({ clientId, refreshToken: token.refreshToken }, discovery);
    // Spotify doesn't always send a new refresh token; keep the old one then.
    token = new TokenResponse({
      ...refreshed.getRequestConfig(),
      refreshToken: refreshed.refreshToken ?? token.refreshToken,
    });
    await saveToken(token);
  }
  return token.accessToken;
}

/**
 * Sign in to Spotify (authorization code with PKCE, so no secret is needed on
 * the phone). Only the group creator connects; playlists go on their account.
 */
export function useConnectSpotify() {
  const [request, , promptAsync] = useAuthRequest(
    {
      clientId,
      scopes: ['playlist-modify-public', 'playlist-modify-private'],
      redirectUri: spotifyRedirectUri,
      usePKCE: true,
    },
    discovery
  );
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    if (!request) throw new Error('Spotify sign-in is still loading, try again in a moment');
    if (!clientId) throw new Error('EXPO_PUBLIC_SPOTIFY_CLIENT_ID is missing from .env');
    setConnecting(true);
    try {
      const result = await promptAsync();
      if (result.type !== 'success') return false;
      const token = await exchangeCodeAsync(
        {
          clientId,
          code: result.params.code,
          redirectUri: spotifyRedirectUri,
          extraParams: { code_verifier: request.codeVerifier ?? '' },
        },
        discovery
      );
      await saveToken(token);
      return true;
    } finally {
      setConnecting(false);
    }
  }, [request, promptAsync]);

  return { connect, connecting, ready: !!request };
}

// Playlists --------------------------------------------------------------------

async function spotifyFetch(path: string, body: unknown, method: 'POST' | 'PUT' = 'POST') {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    throw new Error(details?.error?.message ?? `Spotify request failed (${response.status})`);
  }
  return response.json();
}

/** Create a playlist on the connected account and return its link. */
export async function createPlaylist(
  name: string,
  description: string,
  trackIds: string[]
): Promise<string> {
  const playlist = await spotifyFetch('/me/playlists', { name, description, public: true });
  await addTracks(playlist.id, trackIds);
  return playlist.external_urls.spotify;
}

/** Swap out every song on a playlist made earlier, e.g. to add newer rounds. */
export async function replacePlaylistTracks(playlistUrl: string, trackIds: string[]) {
  const playlistId = playlistUrl.match(/playlist\/([A-Za-z0-9]+)/)?.[1];
  if (!playlistId) throw new Error('That does not look like a Spotify playlist link');
  // Replacing takes up to 100 tracks; the rest are added after.
  await spotifyFetch(
    `/playlists/${playlistId}/items`,
    { uris: trackIds.slice(0, 100).map(trackUri) },
    'PUT'
  );
  await addTracks(playlistId, trackIds.slice(100));
}

function trackUri(id: string) {
  return `spotify:track:${id}`;
}

async function addTracks(playlistId: string, trackIds: string[]) {
  // Spotify accepts up to 100 tracks per request.
  for (let i = 0; i < trackIds.length; i += 100) {
    await spotifyFetch(`/playlists/${playlistId}/items`, {
      uris: trackIds.slice(i, i + 100).map(trackUri),
    });
  }
}

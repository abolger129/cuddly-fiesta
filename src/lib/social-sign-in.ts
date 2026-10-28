import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

/** Must also be listed under Redirect URLs in Supabase (Authentication > URL Configuration). */
export const authRedirectUri = makeRedirectUri({
  native: 'musicleague://auth-callback',
  path: 'auth-callback',
});

/**
 * Google sign-in through Supabase's hosted OAuth page, opened in an in-app
 * browser. No native Google SDK, so it works in existing builds and on web.
 * Returns false if the person closed the browser.
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authRedirectUri, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, authRedirectUri);
  if (result.type !== 'success') return false;

  // Supabase sends the session back in the URL fragment (or an error in the query).
  const url = new URL(result.url);
  const params = new URLSearchParams(url.hash.slice(1) || url.search);
  const message = params.get('error_description') ?? params.get('error');
  if (message) throw new Error(message);

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) throw new Error('Google sign-in did not return a session');
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) throw sessionError;
  return true;
}

/** Sign in with Apple only exists on iPhone/iPad (and needs a native build). */
export function isAppleSignInAvailable() {
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/**
 * Native Sign in with Apple. Apple gets a hashed nonce and Supabase checks the
 * raw one against the identity token. Returns false if the person cancelled.
 */
export async function signInWithApple() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }
  if (!credential.identityToken) throw new Error('Apple did not return an identity token');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  // Apple only shares the name on the very first sign-in, so save it right away.
  const name = credential.fullName
    ? AppleAuthentication.formatFullName(credential.fullName).trim()
    : '';
  if (name && data.user) {
    await supabase.from('profiles').update({ display_name: name }).eq('id', data.user.id);
  }
  return true;
}

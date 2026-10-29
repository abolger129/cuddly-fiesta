import * as Linking from 'expo-linking';
import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { webAppUrl } from '@/lib/web-url';

/**
 * A link that opens the app on the join screen with the invite code filled in,
 * for sharing and for the QR code. Friends who don't have the app yet can still type the code.
 * From the web version it's a web link, so friends can join in their browser.
 */
export function inviteLink(code: string): string {
  if (Platform.OS === 'web') return webAppUrl(`/group/join?code=${encodeURIComponent(code)}`);
  return Linking.createURL('/group/join', { queryParams: { code } });
}

// A friend who opens an invite link in a browser while signed out is sent to sign in
// first, which drops the code. Note it as the page loads, before that happens.
const PENDING_INVITE_KEY = 'pending-invite-code';
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (url.pathname.endsWith('/group/join') && code) sessionStorage.setItem(PENDING_INVITE_KEY, code);
}

/** On the web, open the join screen for an invite link once its visitor has signed in. */
export function usePendingWebInvite(signedIn: boolean) {
  const pathname = usePathname();
  // Wait until signing in has moved on from the sign-in screen, or that move would win.
  const ready = signedIn && pathname !== '/sign-in';
  useEffect(() => {
    if (Platform.OS !== 'web' || !ready) return;
    const code = sessionStorage.getItem(PENDING_INVITE_KEY);
    sessionStorage.removeItem(PENDING_INVITE_KEY);
    if (code && pathname !== '/group/join') {
      router.push({ pathname: '/group/join', params: { code } });
    }
  }, [ready, pathname]);
}

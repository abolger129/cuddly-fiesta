import * as Linking from 'expo-linking';

/**
 * A link that opens the app on the join screen with the invite code filled in,
 * for sharing and for the QR code. Friends who don't have the app yet can still type the code.
 */
export function inviteLink(code: string): string {
  return Linking.createURL('/group/join', { queryParams: { code } });
}

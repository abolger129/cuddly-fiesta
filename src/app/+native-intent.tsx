import { safeAppPath } from '@/lib/deep-links';

// Links that open the app (invites, sign-in redirects from Google and Spotify,
// and Supabase's Site URL fallback such as musicleague://**) all pass through
// here. Ones with no screen go home instead of to "Unmatched Route".
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return safeAppPath(path);
  } catch {
    return '/';
  }
}

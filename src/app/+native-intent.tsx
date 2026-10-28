// Sign-in redirects (Google via Supabase, and Spotify) come back to the app as
// deep links. The in-app browser reads them, but on Android the router sees them
// too, and there is no screen at those paths, so send them home instead.
const AUTH_REDIRECT_PATHS = ['auth-callback', 'spotify-auth'];

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  if (AUTH_REDIRECT_PATHS.some((p) => path.includes(p))) return '/';
  return path;
}

// Decides where a link that opens the app should go. Anything the app has no
// screen for (a sign-in redirect, or a link like musicleague://** that Supabase
// sends when it falls back to its Site URL) goes home instead of to Expo
// Router's "Unmatched Route" page.

const SCREENS = [
  /^$/,
  /^(stats|profile|avatar|sign-in)$/,
  /^group\/[^/]+$/, // group/new, group/join, group/<id>
  /^round\/[^/]+$/,
];

/** The route part of a link: no scheme, no leading or trailing slashes, no query or hash. */
export function routeOf(link: string): string {
  let rest = link.trim();
  const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(rest);
  if (scheme) rest = rest.slice(scheme[0].length);
  rest = rest.split(/[?#]/)[0];
  try {
    rest = decodeURIComponent(rest);
  } catch {
    // Leave badly encoded links as they are; they won't match a screen anyway.
  }
  return rest.replace(/^\/+|\/+$/g, '');
}

/** The link itself if the app has a screen for it, otherwise the home screen. */
export function safeAppPath(link: string): string {
  const route = routeOf(link);
  return SCREENS.some((s) => s.test(route)) ? link : '/';
}

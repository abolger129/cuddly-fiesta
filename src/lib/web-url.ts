/**
 * A full link to a screen of the web version, such as `/group/join`. The web
 * version lives under a base path on GitHub Pages (see app.config.js), which
 * expo-linking leaves out.
 */
export function webAppUrl(path = '/'): string {
  return `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}${path}`;
}

import * as WebBrowser from 'expo-web-browser';

// The privacy policy, terms and support pages live in site/ and are published to GitHub Pages.
const SITE_URL = 'https://abolger129.github.io/cuddly-fiesta';

export const PRIVACY_URL = `${SITE_URL}/privacy.html`;
export const TERMS_URL = `${SITE_URL}/terms.html`;
export const SUPPORT_URL = `${SITE_URL}/`;

export function openPrivacyPolicy() {
  return WebBrowser.openBrowserAsync(PRIVACY_URL);
}

export function openTerms() {
  return WebBrowser.openBrowserAsync(TERMS_URL);
}

const fs = require('fs');

// Android push notifications go through Firebase Cloud Messaging, which needs
// google-services.json from the Firebase console. EAS builds get it from the
// GOOGLE_SERVICES_JSON file variable (see docs/android-push-notifications.md);
// a local copy in the project folder works too. It's kept out of git.
function googleServicesFile() {
  if (process.env.GOOGLE_SERVICES_JSON) return process.env.GOOGLE_SERVICES_JSON;
  if (fs.existsSync('./google-services.json')) return './google-services.json';
  return undefined;
}

module.exports = ({ config }) => {
  const googleServices = googleServicesFile();
  if (googleServices) {
    config = { ...config, android: { ...config.android, googleServicesFile: googleServices } };
  }

  // The web version is published to GitHub Pages under /cuddly-fiesta/app, so the
  // web build sets WEB_BASE_URL (see .github/workflows/pages.yml). Phone builds and
  // over-the-air updates leave it unset, so nothing changes for them.
  const baseUrl = process.env.WEB_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};

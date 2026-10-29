// The web version is published to GitHub Pages under /cuddly-fiesta/app, so the
// web build sets WEB_BASE_URL (see .github/workflows/pages.yml). Phone builds and
// over-the-air updates leave it unset, so nothing changes for them.
module.exports = ({ config }) => {
  const baseUrl = process.env.WEB_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};

const { net } = require('electron');

// Releases are public, so the app reads them without credentials.
const RELEASES_REPO = 'toomanyitem/hanuman';
const RELEASES_PAGE_URL = `https://github.com/${RELEASES_REPO}/releases`;
const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;

const parseVersion = (version) => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(version || '').trim());
  return match ? match.slice(1, 4).map(Number) : null;
};

// Pre-release suffixes are ignored: GitHub's "latest release" never points at a
// pre-release, so only major.minor.patch decides.
const isNewerVersion = (candidate, current) => {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) {
    return false;
  }
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      return a[i] > b[i];
    }
  }
  return false;
};

/**
 * Asks GitHub for the latest published release. The request carries no user or
 * machine data beyond what any HTTPS request does.
 *
 * @returns {Promise<{ status: 'available' | 'up-to-date' | 'no-releases', latestVersion?: string, releaseUrl: string, release?: object }>}
 */
const checkForUpdates = async ({ currentVersion, fetch = net.fetch } = {}) => {
  const response = await fetch(LATEST_RELEASE_API_URL, {
    headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Hanuman' }
  });

  if (response.status === 404) {
    return { status: 'no-releases', releaseUrl: RELEASES_PAGE_URL };
  }
  if (!response.ok) {
    throw new Error(`GitHub responded with HTTP ${response.status}`);
  }

  const release = await response.json();
  const latestVersion = String(release.tag_name || '').replace(/^v/, '');
  const releaseUrl = release.html_url || RELEASES_PAGE_URL;

  if (isNewerVersion(latestVersion, currentVersion)) {
    return { status: 'available', latestVersion, releaseUrl, release };
  }
  return { status: 'up-to-date', latestVersion, releaseUrl };
};

module.exports = {
  RELEASES_PAGE_URL,
  LATEST_RELEASE_API_URL,
  isNewerVersion,
  checkForUpdates
};

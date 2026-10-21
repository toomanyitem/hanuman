const { checkForUpdates, isNewerVersion, LATEST_RELEASE_API_URL, RELEASES_PAGE_URL } = require('./update-check');

const respond = (status, body = {}) => jest.fn().mockResolvedValue({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body
});

describe('isNewerVersion', () => {
  it.each([
    ['0.2.0', '0.1.0', true],
    ['v1.0.0', '0.9.9', true],
    ['0.1.10', '0.1.9', true],
    ['0.1.0', '0.1.0', false],
    ['0.1.0', '0.2.0', false],
    ['1.0.0-beta.1', '1.0.0', false],
    ['not-a-version', '0.1.0', false],
    ['0.2.0', undefined, false]
  ])('%s newer than %s → %s', (candidate, current, expected) => {
    expect(isNewerVersion(candidate, current)).toBe(expected);
  });
});

describe('checkForUpdates', () => {
  it('asks GitHub for the latest release with no extra data', async () => {
    const fetch = respond(200, { tag_name: 'v0.1.0', html_url: 'https://example.test/r' });
    await checkForUpdates({ currentVersion: '0.1.0', fetch });

    expect(fetch).toHaveBeenCalledWith(LATEST_RELEASE_API_URL, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'Hanuman' }
    });
  });

  it('reports a newer release', async () => {
    const fetch = respond(200, { tag_name: 'v0.2.0', html_url: 'https://example.test/v0.2.0' });

    await expect(checkForUpdates({ currentVersion: '0.1.0', fetch })).resolves.toEqual({
      status: 'available',
      latestVersion: '0.2.0',
      releaseUrl: 'https://example.test/v0.2.0'
    });
  });

  it('reports up to date when the latest release is not newer', async () => {
    const fetch = respond(200, { tag_name: 'v0.1.0' });

    await expect(checkForUpdates({ currentVersion: '0.1.0', fetch })).resolves.toEqual({
      status: 'up-to-date',
      latestVersion: '0.1.0',
      releaseUrl: RELEASES_PAGE_URL
    });
  });

  it('treats a missing latest release as no releases yet', async () => {
    const fetch = respond(404);

    await expect(checkForUpdates({ currentVersion: '0.1.0', fetch })).resolves.toEqual({
      status: 'no-releases',
      releaseUrl: RELEASES_PAGE_URL
    });
  });

  it('throws on other HTTP errors', async () => {
    const fetch = respond(403);

    await expect(checkForUpdates({ currentVersion: '0.1.0', fetch })).rejects.toThrow('HTTP 403');
  });
});

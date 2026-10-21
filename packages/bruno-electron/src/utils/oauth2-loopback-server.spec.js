const http = require('http');
const { isLoopbackCallbackUrl, startOauth2LoopbackServer } = require('./oauth2-loopback-server');

const get = (url) => new Promise((resolve, reject) => {
  http.get(url, { agent: false }, (res) => {
    let body = '';
    res.on('data', (chunk) => (body += chunk));
    res.on('end', () => resolve({ status: res.statusCode, body }));
  }).on('error', reject);
});

describe('oauth2-loopback-server', () => {
  describe('isLoopbackCallbackUrl', () => {
    it('accepts http loopback hosts', () => {
      expect(isLoopbackCallbackUrl('http://127.0.0.1:9876/callback')).toBe(true);
      expect(isLoopbackCallbackUrl('http://localhost:3000/cb')).toBe(true);
      expect(isLoopbackCallbackUrl('http://[::1]:3000/cb')).toBe(true);
    });

    it('rejects remote, https, custom-scheme and malformed urls', () => {
      expect(isLoopbackCallbackUrl('https://127.0.0.1/callback')).toBe(false);
      expect(isLoopbackCallbackUrl('http://example.com/callback')).toBe(false);
      expect(isLoopbackCallbackUrl('hanuman://app/oauth2/callback')).toBe(false);
      expect(isLoopbackCallbackUrl('not a url')).toBe(false);
      expect(isLoopbackCallbackUrl(undefined)).toBe(false);
    });
  });

  describe('startOauth2LoopbackServer', () => {
    const callbackUrl = 'http://127.0.0.1:39876/callback';
    let server;

    afterEach(() => server?.close());

    it('forwards the authorization code callback url', async () => {
      const onCallback = jest.fn();
      server = await startOauth2LoopbackServer({ callbackUrl, onCallback });

      const res = await get(`${callbackUrl}?code=abc&state=xyz`);

      expect(res.status).toBe(200);
      expect(onCallback).toHaveBeenCalledWith(`${callbackUrl}?code=abc&state=xyz`);
    });

    it('forwards error callbacks', async () => {
      const onCallback = jest.fn();
      server = await startOauth2LoopbackServer({ callbackUrl, onCallback });

      await get(`${callbackUrl}?error=access_denied&state=xyz`);

      expect(onCallback).toHaveBeenCalledWith(`${callbackUrl}?error=access_denied&state=xyz`);
    });

    it('serves a fragment-forwarding page when no result is in the query', async () => {
      const onCallback = jest.fn();
      server = await startOauth2LoopbackServer({ callbackUrl, onCallback });

      const res = await get(callbackUrl);

      expect(res.body).toContain('window.location.hash');
      expect(onCallback).not.toHaveBeenCalled();
    });

    it('rebuilds implicit-grant fragments as the url hash', async () => {
      const onCallback = jest.fn();
      server = await startOauth2LoopbackServer({ callbackUrl, onCallback });

      const fragment = encodeURIComponent('access_token=t1&state=xyz');
      await get(`${callbackUrl}?__fragment=${fragment}`);

      expect(onCallback).toHaveBeenCalledWith(`${callbackUrl}#access_token=t1&state=xyz`);
    });

    it('ignores other paths', async () => {
      const onCallback = jest.fn();
      server = await startOauth2LoopbackServer({ callbackUrl, onCallback });

      const res = await get('http://127.0.0.1:39876/other?code=abc');

      expect(res.status).toBe(404);
      expect(onCallback).not.toHaveBeenCalled();
    });

    it('rejects with a readable error when the port is taken', async () => {
      server = await startOauth2LoopbackServer({ callbackUrl, onCallback: jest.fn() });

      await expect(startOauth2LoopbackServer({ callbackUrl, onCallback: jest.fn() }))
        .rejects.toThrow('OAuth2 callback port 39876 is already in use');
    });
  });
});

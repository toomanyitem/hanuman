const http = require('http');

// Default redirect URI for system-browser OAuth2 flows. A loopback listener
// (RFC 8252 §7.3) keeps the whole flow on the user's machine instead of bouncing
// through a vendor-hosted redirect page.
const DEFAULT_OAUTH2_CALLBACK_URL = 'http://127.0.0.1:9876/callback';

const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '[::1]'];

// Implicit-grant tokens arrive in the URL fragment, which browsers never send to
// the server. This page re-submits the fragment as a query parameter.
const FRAGMENT_PARAM = '__fragment';

const isLoopbackCallbackUrl = (callbackUrl) => {
  try {
    const url = new URL(callbackUrl);
    return url.protocol === 'http:' && LOOPBACK_HOSTS.includes(url.hostname);
  } catch (error) {
    return false;
  }
};

const renderPage = (message, script = '') => `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Hanuman</title></head>
  <body style="font-family: system-ui, sans-serif; text-align: center; padding-top: 4rem;">
    <p>${message}</p>
    ${script ? `<script>${script}</script>` : ''}
  </body>
</html>`;

const fragmentForwardingScript = `
  if (window.location.hash.length > 1) {
    var params = new URLSearchParams();
    params.set('${FRAGMENT_PARAM}', window.location.hash.substring(1));
    window.location.replace(window.location.pathname + '?' + params.toString());
  }
`;

/**
 * Listens once on the loopback callback URL and hands the full callback URL
 * (including any implicit-grant fragment) to `onCallback`.
 * Resolves with a `close` function once the listener is ready.
 */
const startOauth2LoopbackServer = ({ callbackUrl, onCallback }) => {
  const expected = new URL(callbackUrl);
  const port = Number(expected.port) || 80;

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url, `${expected.protocol}//${expected.host}`);

      if (requestUrl.pathname !== expected.pathname) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }

      const fragment = requestUrl.searchParams.get(FRAGMENT_PARAM);
      const hasResult = fragment || requestUrl.searchParams.has('code') || requestUrl.searchParams.has('error');

      if (!hasResult) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderPage('Completing sign-in…', fragmentForwardingScript));
        return;
      }

      const callback = new URL(expected.href);
      if (fragment) {
        callback.hash = fragment;
      } else {
        callback.search = requestUrl.search;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderPage('Authorization received. You can close this window and return to Hanuman.'));
      onCallback(callback.toString());
    });

    // Let the confirmation page finish sending, then drop any lingering keep-alive sockets.
    const close = () => {
      server.close();
      server.closeIdleConnections();
      setTimeout(() => server.closeAllConnections(), 1000).unref();
    };

    server.once('error', (error) => {
      const message = error.code === 'EADDRINUSE'
        ? `OAuth2 callback port ${port} is already in use. Free the port or set a different loopback Callback URL.`
        : `Could not start OAuth2 callback listener on ${expected.host}: ${error.message}`;
      reject(new Error(message));
    });

    server.listen(port, expected.hostname.replace(/^\[|\]$/g, ''), () => resolve({ close }));
  });
};

module.exports = {
  DEFAULT_OAUTH2_CALLBACK_URL,
  isLoopbackCallbackUrl,
  startOauth2LoopbackServer
};

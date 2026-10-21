const { shell } = require('electron');
const { registerOauth2AuthorizationRequest, rejectOauth2AuthorizationRequest, handleOauth2ProtocolUrl } = require('../../utils/oauth2-protocol-handler');
const { isLoopbackCallbackUrl, startOauth2LoopbackServer } = require('../../utils/oauth2-loopback-server');

const authorizeUserInSystemBrowser = ({ authorizeUrl, callbackUrl, grantType = 'authorization_code', expectedState = null }) => {
  return new Promise((resolve, reject) => {
    // Replace callback URL in authorization URL
    const authorizationUrlObj = new URL(authorizeUrl);
    authorizationUrlObj.searchParams.set('redirect_uri', callbackUrl);
    const modifiedAuthorizeUrl = authorizationUrlObj.toString();

    // Set timeout for the request (5 minutes)
    const timeout = setTimeout(() => {
      rejectOauth2AuthorizationRequest(new Error('Authorization timeout'));
    }, 5 * 60 * 1000);

    // Wrap resolve/reject to clear timeout and add debugInfo
    const debugInfo = {
      data: []
    };

    const authorizationRequest = {
      request: {
        url: modifiedAuthorizeUrl,
        method: 'GET',
        headers: {},
        error: null
      },
      response: {
        headers: {},
        status: null,
        statusText: null,
        error: null
      },
      fromCache: false,
      completed: false
    };

    debugInfo.data.push(authorizationRequest);

    let closeLoopbackServer = () => {};

    const wrappedResolve = (value) => {
      clearTimeout(timeout);
      closeLoopbackServer();
      if (grantType === 'implicit') {
        resolve({ implicitTokens: value, debugInfo });
      } else {
        resolve({ authorizationCode: value, debugInfo });
      }
    };

    const wrappedReject = (error) => {
      clearTimeout(timeout);
      closeLoopbackServer();
      reject(error);
    };

    registerOauth2AuthorizationRequest(wrappedResolve, wrappedReject, debugInfo, expectedState);

    const openSystemBrowser = () => shell.openExternal(modifiedAuthorizeUrl).catch((error) => {
      rejectOauth2AuthorizationRequest(error);
    });

    if (!isLoopbackCallbackUrl(callbackUrl)) {
      openSystemBrowser();
      return;
    }

    startOauth2LoopbackServer({ callbackUrl, onCallback: handleOauth2ProtocolUrl })
      .then(({ close }) => {
        closeLoopbackServer = close;
        openSystemBrowser();
      })
      .catch((error) => rejectOauth2AuthorizationRequest(error));
  });
};

module.exports = { authorizeUserInSystemBrowser };

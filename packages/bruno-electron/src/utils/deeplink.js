const { handleOauth2ProtocolUrl } = require('./oauth2-protocol-handler');

const APP_PROTOCOL = 'hanuman';

// Store appProtocolUrl - will be handled in the `did-finish-load` event handler
const getAppProtocolUrlFromArgv = (argv) => {
  return argv.find((arg) => arg.startsWith(`${APP_PROTOCOL}://`));
};

// Handle app protocol URLs
const handleAppProtocolUrl = (url) => {
  // Handle OAuth2 callback URLs - `hanuman://app/oauth2/callback`
  if (isOauth2Url(url)) {
    handleOauth2ProtocolUrl(url);
  }
  return;
};

const isOauth2Url = (url) => {
  try {
    const urlObj = new URL(url);

    if (urlObj.pathname === '/oauth2/callback') {
      return true;
    }
  } catch (error) {
    console.error('[Protocol Handler] Error handling protocol URL:', error);
  }
  return false;
};

module.exports = { APP_PROTOCOL, handleAppProtocolUrl, getAppProtocolUrlFromArgv };

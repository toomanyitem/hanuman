const HELPER_USERNAME_ENV = 'HANUMAN_GIT_USERNAME';
const HELPER_TOKEN_ENV = 'HANUMAN_GIT_TOKEN';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

const parseRemoteUrl = (url) => {
  if (typeof url !== 'string') return null;
  try {
    return new URL(url.trim());
  } catch (err) {
    return null;
  }
};

// Tokens go only over https; plain http is accepted for loopback servers, where nothing crosses the network.
const hostFromRemoteUrl = (url) => {
  const parsed = parseRemoteUrl(url);
  if (!parsed) return null;
  const isLoopbackHttp = parsed.protocol === 'http:' && LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase());
  if (parsed.protocol !== 'https:' && !isLoopbackHttp) return null;
  return parsed.host.toLowerCase();
};

// The empty helper drops the user's helpers for this one command, so a stale keychain entry can't win over
// the saved token. The new helper is keyed to the remote's scheme and host, so a redirect to another host
// gets nothing. The token travels by env, never argv.
const credentialConfig = (remoteUrl) => {
  const { protocol, host } = parseRemoteUrl(remoteUrl);
  return [
    'credential.helper=',
    `credential.${protocol}//${host}.helper=!f() { echo "username=$${HELPER_USERNAME_ENV}"; echo "password=$${HELPER_TOKEN_ENV}"; }; f`,
    'submodule.recurse=false'
  ];
};

const credentialEnv = ({ username, token }) => ({
  [HELPER_USERNAME_ENV]: username,
  [HELPER_TOKEN_ENV]: token
});

// https://user:password@host keeps the user; https://TOKEN@host (GitHub's token-only form) hides it all.
const HTTP_USERINFO_PATTERN = /(https?:\/\/)([^/@\s]+)@/gi;

const redactUrl = (url) => {
  if (typeof url !== 'string') return url;
  return url.replace(HTTP_USERINFO_PATTERN, (match, scheme, userinfo) => {
    const separator = userinfo.indexOf(':');
    return separator === -1 ? `${scheme}***@` : `${scheme}${userinfo.slice(0, separator)}:***@`;
  });
};

// A URL edited in the app starts from its redacted form; put the stored credentials back instead of saving "***".
const restoreRedactedUserinfo = (nextUrl, currentUrl) => {
  const redacted = /^(https?:\/\/)[^/@\s]*\*\*\*[^/@\s]*@/i;
  if (!redacted.test(nextUrl)) return nextUrl;
  const current = /^https?:\/\/([^/@\s]+)@/i.exec(currentUrl || '');
  if (!current) {
    throw new Error('"***" stands for a hidden password. Type the real credentials or remove them from the URL.');
  }
  return nextUrl.replace(redacted, `$1${current[1]}@`);
};

const scrubSecrets = (text, secrets = []) => {
  let scrubbed = redactUrl(String(text ?? ''));
  for (const secret of secrets) {
    if (secret) {
      scrubbed = scrubbed.split(secret).join('***');
    }
  }
  return scrubbed;
};

module.exports = {
  hostFromRemoteUrl,
  credentialConfig,
  credentialEnv,
  redactUrl,
  restoreRedactedUserinfo,
  scrubSecrets
};

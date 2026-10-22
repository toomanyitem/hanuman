const HELPER_USERNAME_ENV = 'HANUMAN_GIT_USERNAME';
const HELPER_TOKEN_ENV = 'HANUMAN_GIT_TOKEN';

const hostFromRemoteUrl = (url) => {
  if (typeof url !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch (err) {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  return parsed.host.toLowerCase();
};

// The empty helper resets every helper from the user's config for this one command, so a stale
// keychain entry can't win over the token the user saved in the app. The token travels by env, not argv.
const credentialConfig = () => [
  'credential.helper=',
  `credential.helper=!f() { echo "username=$${HELPER_USERNAME_ENV}"; echo "password=$${HELPER_TOKEN_ENV}"; }; f`
];

const credentialEnv = ({ username, token }) => ({
  [HELPER_USERNAME_ENV]: username,
  [HELPER_TOKEN_ENV]: token
});

const USERINFO_PATTERN = /\/\/([^/@:\s]+):[^/@\s]*@/g;

const redactUrl = (url) => (typeof url === 'string' ? url.replace(USERINFO_PATTERN, '//$1:***@') : url);

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
  scrubSecrets
};

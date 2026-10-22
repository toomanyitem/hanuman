const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const { gitCredentialStore } = require('../../store/git-credentials');
const { hostFromRemoteUrl, credentialConfig, credentialEnv, scrubSecrets } = require('./auth');

// git kills a command only after this long with no output; a large push over a slow link can be quiet for a while
const NETWORK_TIMEOUT_MS = 5 * 60 * 1000;

// - No terminal prompts: git would otherwise wait for a username or a GCM dialog. SSH is left to the user's own
//   config (core.sshCommand, GIT_SSH); without a TTY it fails instead of prompting.
// - Literal pathspecs: request files may be named "[v2] users.bru", and a glob pathspec would also touch "v users.bru".
// - No optional locks: the status refresh must not take index.lock while a stage or commit is running.
const nonInteractiveEnv = () => ({
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GCM_INTERACTIVE: 'never',
  GIT_LITERAL_PATHSPECS: '1',
  GIT_OPTIONAL_LOCKS: '0'
});

// simple-git's default only rejects when git writes to stderr, so `commit` with nothing staged (exit 1, stdout
// only) would look successful. Every non-zero exit is an error here, carrying whatever git printed.
const rejectNonZeroExit = (error, result) => {
  if (error) return error;
  if (result.exitCode === 0) return undefined;
  return Buffer.concat([...result.stdErr, ...result.stdOut]);
};

// A fresh instance per call: .env() mutates the instance, and a token must never stick to a later command.
const localGit = (repoRoot, env = {}) =>
  simpleGit({ baseDir: repoRoot, errors: rejectNonZeroExit }).env({ ...nonInteractiveEnv(), ...env });

// Repository config (.git/config, config.worktree and anything they include) travels with a copied or shared
// folder, so it is not trusted with a token: a proxy, a resolve override, a custom CA or a TLS setting there could
// hand the token to another server. Any such key is refused whatever its value, so Git's own boolean parsing never
// has to be reproduced here. The user's system and global config are still trusted.
const TOKEN_UNSAFE_KEY = /^(http\.(.+\.)?(proxy|sslverify|sslcainfo|sslcapath|curloptresolve)|remote\..+\.proxy)$/i;
const REPO_SCOPES = new Set(['local', 'worktree']);

const assertRepoConfigSafeForToken = async (repoRoot, host) => {
  // -z output: scope NUL key LF value NUL
  const fields = (await localGit(repoRoot).raw(['config', '--list', '--show-scope', '--includes', '-z'])).split('\0');
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const key = fields[i + 1].split('\n')[0];
    if (REPO_SCOPES.has(fields[i]) && TOKEN_UNSAFE_KEY.test(key)) {
      throw new Error(`This repository's own Git settings set "${key}", which could send your access token for ${host} to another server. Remove that setting from the repository's Git config, or remove the saved token for ${host}, then try again.`);
    }
  }
};

const networkGit = async (repoRoot, remoteUrl, extraEnv = {}) => {
  const host = hostFromRemoteUrl(remoteUrl);
  const credential = host ? gitCredentialStore.get(host) : null;
  if (!credential) {
    return {
      git: simpleGit({ baseDir: repoRoot, errors: rejectNonZeroExit, timeout: { block: NETWORK_TIMEOUT_MS } }).env({ ...nonInteractiveEnv(), ...extraEnv }),
      secrets: []
    };
  }
  await assertRepoConfigSafeForToken(repoRoot, host);
  const git = simpleGit({
    baseDir: repoRoot,
    config: credentialConfig(remoteUrl),
    errors: rejectNonZeroExit,
    timeout: { block: NETWORK_TIMEOUT_MS }
  }).env({ ...nonInteractiveEnv(), ...extraEnv, ...credentialEnv(credential) });
  return { git, secrets: [credential.token] };
};

const toGitError = (error, secrets = []) => {
  const message = scrubSecrets((error && error.message) || String(error), secrets).trim();
  return new Error(message || 'Git command failed');
};

const toPosix = (p) => p.split(path.sep).join('/');

const resolveRepo = async (targetPath) => {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Folder not found: ${targetPath}`);
  }
  let topLevel;
  try {
    topLevel = (await localGit(targetPath).revparse(['--show-toplevel'])).trim();
  } catch (error) {
    if (/not a git repository/i.test(error.message)) return null;
    throw toGitError(error);
  }
  const repoRoot = fs.realpathSync.native(path.resolve(topLevel));
  const scope = toPosix(path.relative(repoRoot, fs.realpathSync.native(targetPath))) || '.';
  return { repoRoot, scope };
};

const requireRepo = async (targetPath) => {
  const repo = await resolveRepo(targetPath);
  if (!repo) {
    throw new Error('This folder is not inside a Git repository');
  }
  return repo;
};

const repoQueues = new Map();

const withRepoLock = (repoRoot, fn) => {
  const previous = repoQueues.get(repoRoot) || Promise.resolve();
  const run = previous.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  repoQueues.set(repoRoot, tail);
  tail.then(() => {
    if (repoQueues.get(repoRoot) === tail) repoQueues.delete(repoRoot);
  });
  return run;
};

// --git-path follows worktrees and submodules, where .git is a file rather than a folder.
const getOperation = async (repoRoot) => {
  const output = await localGit(repoRoot).raw(['rev-parse', '--git-path', 'MERGE_HEAD', '--git-path', 'rebase-merge', '--git-path', 'rebase-apply']);
  const [mergeHead, rebaseMerge, rebaseApply] = output.trim().split(/\r\n|\r|\n/).map((p) => path.resolve(repoRoot, p));
  if (fs.existsSync(rebaseMerge) || fs.existsSync(rebaseApply)) return 'rebase';
  if (fs.existsSync(mergeHead)) return 'merge';
  return null;
};

const assertSafeArg = (value, label) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().startsWith('-')) {
    throw new Error(`${label} is not valid`);
  }
};

const assertBranchName = async (repoRoot, name) => {
  assertSafeArg(name, 'Branch name');
  try {
    await localGit(repoRoot).raw(['check-ref-format', '--branch', name]);
  } catch (error) {
    throw new Error(`"${name}" is not a valid branch name`);
  }
};

// Paths from the renderer are repo-relative; anything that escapes the collection's folder is refused.
const assertPathsInScope = (scope, paths) => {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('No files given');
  }
  for (const p of paths) {
    if (typeof p !== 'string' || !p || p.startsWith('-') || /[\\\0]/.test(p) || path.posix.isAbsolute(p) || path.win32.isAbsolute(p) || p.split('/').includes('..')) {
      throw new Error(`Path is not valid: ${p}`);
    }
    if (scope !== '.' && p !== scope && !p.startsWith(`${scope}/`)) {
      throw new Error(`Path is outside this collection: ${p}`);
    }
  }
};

module.exports = {
  localGit,
  networkGit,
  toGitError,
  resolveRepo,
  requireRepo,
  withRepoLock,
  getOperation,
  assertSafeArg,
  assertBranchName,
  assertPathsInScope
};

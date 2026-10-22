const { redactUrl, restoreRedactedUserinfo } = require('./auth');
const { localGit, resolveRepo, requireRepo, withRepoLock, toGitError, assertSafeArg } = require('./repo');

const REMOTE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const assertRemote = ({ name, url }, { requireUrl = true } = {}) => {
  if (typeof name !== 'string' || !REMOTE_NAME_PATTERN.test(name)) {
    throw new Error('Remote name may only use letters, digits, ".", "_" and "-"');
  }
  if (requireUrl) assertSafeArg(url, 'Remote URL');
};

const listRemotes = async (targetPath) => {
  const { repoRoot } = await requireRepo(targetPath);
  try {
    const remotes = await localGit(repoRoot).getRemotes(true);
    return remotes.map(({ name, refs }) => ({ name, url: redactUrl(refs.fetch || refs.push) }));
  } catch (error) {
    throw toGitError(error);
  }
};

const runRemoteCommand = async (targetPath, args) => {
  const { repoRoot } = await requireRepo(targetPath);
  return withRepoLock(repoRoot, async () => {
    try {
      await localGit(repoRoot).raw(args);
    } catch (error) {
      throw toGitError(error);
    }
  });
};

const addRemote = async (targetPath, remote = {}) => {
  assertRemote(remote);
  return runRemoteCommand(targetPath, ['remote', 'add', remote.name, remote.url.trim()]);
};

const setRemoteUrl = async (targetPath, remote = {}) => {
  assertRemote(remote);
  const { repoRoot } = await requireRepo(targetPath);
  let currentUrl;
  try {
    currentUrl = (await localGit(repoRoot).raw(['remote', 'get-url', remote.name])).trim();
  } catch (error) {
    throw toGitError(error);
  }
  return runRemoteCommand(targetPath, ['remote', 'set-url', remote.name, restoreRedactedUserinfo(remote.url.trim(), currentUrl)]);
};

const removeRemote = async (targetPath, remote = {}) => {
  assertRemote(remote, { requireUrl: false });
  return runRemoteCommand(targetPath, ['remote', 'remove', remote.name]);
};

const initRepository = async (targetPath) => {
  if (await resolveRepo(targetPath)) {
    throw new Error('This folder is already inside a Git repository');
  }
  const git = localGit(targetPath);
  try {
    await git.raw(['init']);
    await git.raw(['symbolic-ref', 'HEAD', 'refs/heads/main']);
  } catch (error) {
    throw toGitError(error);
  }
};

module.exports = { listRemotes, addRemote, setRemoteUrl, removeRemote, initRepository };

const { localGit, networkGit, requireRepo, withRepoLock, toGitError, assertSafeArg } = require('./repo');

const getRemoteUrl = async (repoRoot, remote, { forPush = false } = {}) => {
  assertSafeArg(remote, 'Remote name');
  try {
    return (await localGit(repoRoot).raw(['remote', 'get-url', ...(forPush ? ['--push'] : []), remote])).trim();
  } catch (error) {
    throw toGitError(error);
  }
};

const runNetwork = async (repoRoot, remote, args, env = {}) => {
  const url = await getRemoteUrl(repoRoot, remote, { forPush: args[0] === 'push' });
  const { git, secrets } = networkGit(repoRoot, url, env);
  try {
    return await git.raw(args);
  } catch (error) {
    throw toGitError(error, secrets);
  }
};

const fetchRemote = async (targetPath, { remote } = {}) => {
  const { repoRoot } = await requireRepo(targetPath);
  return withRepoLock(repoRoot, async () => {
    const remotes = remote ? [remote] : (await localGit(repoRoot).getRemotes()).map((r) => r.name);
    if (!remotes.length) {
      throw new Error('No remote is configured. Add one first.');
    }
    for (const name of remotes) {
      await runNetwork(repoRoot, name, ['fetch', '--prune', name]);
    }
  });
};

const getBranchUpstream = async (git) => {
  const status = await git.status();
  if (status.detached) {
    throw new Error('HEAD is detached. Check out a branch first.');
  }
  const remote = status.tracking
    ? (await git.raw(['config', '--get', `branch.${status.current}.remote`])).trim()
    : null;
  return { branch: status.current, remote };
};

const pull = async (targetPath, { mode } = {}) => {
  if (mode !== 'merge' && mode !== 'rebase') {
    throw new Error('Pull mode must be "merge" or "rebase"');
  }
  const { repoRoot } = await requireRepo(targetPath);
  return withRepoLock(repoRoot, async () => {
    const { remote } = await getBranchUpstream(localGit(repoRoot));
    if (!remote) {
      throw new Error('This branch has no upstream. Push it first or set one.');
    }
    const args = mode === 'rebase' ? ['pull', '--rebase'] : ['pull', '--no-rebase', '--no-edit'];
    return runNetwork(repoRoot, remote, args, { GIT_EDITOR: 'true' });
  });
};

const push = async (targetPath, { remote = 'origin' } = {}) => {
  const { repoRoot } = await requireRepo(targetPath);
  return withRepoLock(repoRoot, async () => {
    const upstream = await getBranchUpstream(localGit(repoRoot));
    if (upstream.remote) {
      return runNetwork(repoRoot, upstream.remote, ['push', upstream.remote, 'HEAD']);
    }
    return runNetwork(repoRoot, remote, ['push', '-u', remote, 'HEAD']);
  });
};

module.exports = { fetchRemote, pull, push };

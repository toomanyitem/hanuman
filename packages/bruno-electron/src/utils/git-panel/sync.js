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
  let secrets = [];
  try {
    const network = await networkGit(repoRoot, url, env);
    secrets = network.secrets;
    return await network.git.raw(args);
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
  if (!status.tracking) {
    return { branch: status.current, remote: null, mergeRef: null };
  }
  const readConfig = async (key) => (await git.raw(['config', '--get', `branch.${status.current}.${key}`])).trim();
  const remote = await readConfig('remote');
  if (remote === '.') {
    throw new Error(`${status.current} tracks a local branch. Set an upstream on a remote to pull or push.`);
  }
  return { branch: status.current, remote, mergeRef: await readConfig('merge') };
};

// With no upstream yet, push to origin, or to the only remote when there is just one.
const pickRemoteForNewBranch = async (git) => {
  const remotes = (await git.getRemotes()).map((r) => r.name);
  if (remotes.includes('origin')) return 'origin';
  if (remotes.length === 1) return remotes[0];
  throw new Error(remotes.length ? `Choose a remote: this repository has ${remotes.join(', ')} and none is named origin.` : 'No remote is configured. Add one first.');
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

// Push goes to the branch being tracked, which may be named differently from the local one.
const push = async (targetPath) => {
  const { repoRoot } = await requireRepo(targetPath);
  return withRepoLock(repoRoot, async () => {
    const git = localGit(repoRoot);
    const upstream = await getBranchUpstream(git);
    if (upstream.remote) {
      return runNetwork(repoRoot, upstream.remote, ['push', upstream.remote, `HEAD:${upstream.mergeRef}`]);
    }
    const remote = await pickRemoteForNewBranch(git);
    return runNetwork(repoRoot, remote, ['push', '-u', remote, 'HEAD']);
  });
};

module.exports = { fetchRemote, pull, push };

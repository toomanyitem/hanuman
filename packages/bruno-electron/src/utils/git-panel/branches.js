const { localGit, requireRepo, withRepoLock, toGitError, assertSafeArg, assertBranchName } = require('./repo');

const parseTrack = (track) => ({
  ahead: Number((track.match(/ahead (\d+)/) || [])[1] || 0),
  behind: Number((track.match(/behind (\d+)/) || [])[1] || 0)
});

const getCurrentBranch = async (git) => {
  try {
    return (await git.raw(['symbolic-ref', '--short', 'HEAD'])).trim();
  } catch (error) {
    // symbolic-ref fails only when HEAD is detached
    return null;
  }
};

const listBranches = async (targetPath) => {
  const { repoRoot } = await requireRepo(targetPath);
  const git = localGit(repoRoot);
  try {
    const output = await git.raw([
      'for-each-ref',
      '--format=%(refname)%00%(upstream:short)%00%(upstream:track,nobracket)',
      'refs/heads',
      'refs/remotes'
    ]);
    const local = [];
    const remote = [];
    output.split(/\r\n|\r|\n/).filter(Boolean).forEach((line) => {
      const [refname, upstream, track] = line.split('\0');
      if (refname.startsWith('refs/heads/')) {
        local.push({ name: refname.slice('refs/heads/'.length), upstream: upstream || null, ...parseTrack(track || '') });
      } else if (!refname.endsWith('/HEAD')) {
        remote.push(refname.slice('refs/remotes/'.length));
      }
    });
    return { current: await getCurrentBranch(git), local, remote };
  } catch (error) {
    throw toGitError(error);
  }
};

const withBranchLock = async (targetPath, fn) => {
  const { repoRoot } = await requireRepo(targetPath);
  return withRepoLock(repoRoot, async () => {
    try {
      return await fn(localGit(repoRoot), repoRoot);
    } catch (error) {
      throw toGitError(error);
    }
  });
};

const createBranch = async (targetPath, { name, startPoint } = {}) =>
  withBranchLock(targetPath, async (git, repoRoot) => {
    await assertBranchName(repoRoot, name);
    if (startPoint) assertSafeArg(startPoint, 'Start point');
    return git.raw(['checkout', '-b', name, ...(startPoint ? [startPoint] : []), '--']);
  });

const refExists = async (git, ref) => {
  try {
    await git.raw(['show-ref', '--verify', ref]);
    return true;
  } catch (error) {
    return false;
  }
};

// A remote branch with no local twin is checked out as a new local branch that tracks it.
const checkoutBranch = async (targetPath, { name } = {}) =>
  withBranchLock(targetPath, async (git) => {
    assertSafeArg(name, 'Branch name');
    if (await refExists(git, `refs/heads/${name}`)) {
      return git.raw(['checkout', name, '--']);
    }
    if (await refExists(git, `refs/remotes/${name}`)) {
      const localName = name.slice(name.indexOf('/') + 1);
      if (await refExists(git, `refs/heads/${localName}`)) {
        return git.raw(['checkout', localName, '--']);
      }
      return git.raw(['checkout', '--track', name, '--']);
    }
    throw new Error(`Branch not found: ${name}`);
  });

const deleteBranch = async (targetPath, { name, force = false } = {}) =>
  withBranchLock(targetPath, async (git) => {
    assertSafeArg(name, 'Branch name');
    if ((await getCurrentBranch(git)) === name) {
      throw new Error('Switch to another branch before deleting this one');
    }
    return git.raw(['branch', force ? '-D' : '-d', name]);
  });

module.exports = { listBranches, createBranch, checkoutBranch, deleteBranch };

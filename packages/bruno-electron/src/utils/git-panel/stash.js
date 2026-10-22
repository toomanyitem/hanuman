const { listStashes: listUpstreamStashes } = require('../git');
const { localGit, requireRepo, withRepoLock, toGitError } = require('./repo');

const assertStashIndex = (index) => {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('Stash index is not valid');
  }
};

const runStash = async (targetPath, fn) => {
  const { repoRoot, scope } = await requireRepo(targetPath);
  return withRepoLock(repoRoot, async () => {
    try {
      return await fn(localGit(repoRoot), scope);
    } catch (error) {
      throw toGitError(error);
    }
  });
};

// Scoped to the collection by default; the branch-switch prompt stashes the whole repo because checkout needs a clean tree.
const stashPush = (targetPath, { message, repoWide = false } = {}) =>
  runStash(targetPath, async (git, scope) => {
    const pathspec = repoWide ? [] : ['--', scope];
    const status = await git.status(pathspec);
    if (status.files.length === 0) {
      throw new Error('There are no local changes to stash');
    }
    const messageArgs = typeof message === 'string' && message.trim() ? ['-m', message.trim()] : [];
    return git.raw(['stash', 'push', '--include-untracked', ...messageArgs, ...pathspec]);
  });

const listStashes = async (targetPath) => {
  const { repoRoot } = await requireRepo(targetPath);
  try {
    return await listUpstreamStashes(repoRoot);
  } catch (error) {
    throw toGitError(error);
  }
};

const stashCommand = (command) => async (targetPath, { index } = {}) => {
  assertStashIndex(index);
  return runStash(targetPath, (git) => git.raw(['stash', command, `stash@{${index}}`]));
};

module.exports = {
  stashPush,
  listStashes,
  stashApply: stashCommand('apply'),
  // git keeps the stash when the pop stops on a conflict
  stashPop: stashCommand('pop'),
  stashDrop: stashCommand('drop')
};

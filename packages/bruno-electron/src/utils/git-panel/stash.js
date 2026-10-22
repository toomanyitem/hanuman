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

// Stash indexes shift when a stash is added or dropped elsewhere, so the hash the list showed must still match.
const stashCommand = (command) => async (targetPath, { index, hash } = {}) => {
  assertStashIndex(index);
  if (typeof hash !== 'string' || !/^[0-9a-f]{7,64}$/i.test(hash)) {
    throw new Error('Stash hash is not valid');
  }
  return runStash(targetPath, async (git) => {
    const ref = `stash@{${index}}`;
    const current = (await git.raw(['rev-parse', ref])).trim();
    if (!current.startsWith(hash) && !hash.startsWith(current)) {
      throw new Error('The stash list changed. Refresh and try again.');
    }
    return git.raw(['stash', command, ref]);
  });
};

module.exports = {
  stashPush,
  listStashes,
  stashApply: stashCommand('apply'),
  // git keeps the stash when the pop stops on a conflict
  stashPop: stashCommand('pop'),
  stashDrop: stashCommand('drop')
};

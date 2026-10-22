const { getWorkingFileContentForVisualDiff } = require('../git');
const { localGit, requireRepo, withRepoLock, toGitError, assertPathsInScope } = require('./repo');

const runInScope = async (targetPath, paths, fn) => {
  const { repoRoot, scope } = await requireRepo(targetPath);
  assertPathsInScope(scope, paths);
  return withRepoLock(repoRoot, async () => {
    try {
      return await fn(localGit(repoRoot), repoRoot);
    } catch (error) {
      throw toGitError(error);
    }
  });
};

const stageFiles = (targetPath, paths) =>
  runInScope(targetPath, paths, (git) => git.raw(['add', '-A', '--', ...paths]));

// `reset -- <paths>` without a commit argument also works on an unborn branch, before the first commit.
const unstageFiles = (targetPath, paths) =>
  runInScope(targetPath, paths, (git) => git.raw(['reset', '-q', '--', ...paths]));

const discardFiles = (targetPath, paths) =>
  runInScope(targetPath, paths, async (git) => {
    const status = await git.status(['--', ...paths]);
    const untracked = status.files.filter((file) => file.index === '?').map((file) => file.path);
    const conflicted = status.conflicted;
    if (conflicted.length) {
      throw new Error(`Resolve the conflict before discarding: ${conflicted.join(', ')}`);
    }
    const tracked = paths.filter((p) => !untracked.includes(p) && status.files.some((file) => file.path === p || file.path.startsWith(`${p}/`)));
    if (tracked.length) {
      await git.raw(['checkout', '--', ...tracked]);
    }
    if (untracked.length) {
      await git.raw(['clean', '-f', '-q', '--', ...untracked]);
    }
  });

const commit = async (targetPath, message) => {
  if (typeof message !== 'string' || !message.trim()) {
    throw new Error('Commit message is required');
  }
  const { repoRoot } = await requireRepo(targetPath);
  return withRepoLock(repoRoot, async () => {
    const git = localGit(repoRoot);
    try {
      await git.raw(['commit', '-m', message.trim()]);
      return { commit: (await git.revparse(['HEAD'])).trim() };
    } catch (error) {
      throw toGitError(error);
    }
  });
};

const getFileDiff = async (targetPath, { path, area }) => {
  if (area !== 'staged' && area !== 'unstaged') {
    throw new Error('Diff area must be "staged" or "unstaged"');
  }
  const { repoRoot, scope } = await requireRepo(targetPath);
  assertPathsInScope(scope, [path]);
  try {
    const diff = await getWorkingFileContentForVisualDiff(repoRoot, path, area);
    // the upstream helper parses only request files, so a parsed side means the visual viewer applies
    return { ...diff, visual: Boolean(diff.oldParsed || diff.newParsed) };
  } catch (error) {
    throw toGitError(error);
  }
};

module.exports = { stageFiles, unstageFiles, discardFiles, commit, getFileDiff };

const fs = require('fs');
const path = require('path');
const { localGit, requireRepo, withRepoLock, toGitError, getOperation, assertPathsInScope } = require('./repo');

// Index stage 2 is the side checked out when the operation stopped ("ours"), stage 3 the side being applied
// ("theirs"). During a rebase that means upstream and your commit, so the UI names them Current and Incoming.
const STAGE_BY_CHOICE = { current: 2, incoming: 3 };
const UNRESOLVED_MARKER = /^(<{7}|>{7})(\s|$)/m;

const readStage = async (git, stage, filePath) => {
  try {
    return await git.raw(['show', `:${stage}:${filePath}`]);
  } catch (error) {
    // the side deleted the file, so the stage is absent
    return null;
  }
};

// Only paths git lists as unmerged are written, never through a symlink, and only under the repo.
const resolveConflictFilePath = async (git, repoRoot, filePath) => {
  const unmerged = (await git.raw(['diff', '--name-only', '--diff-filter=U', '--', filePath])).split(/\r\n|\r|\n/);
  if (!unmerged.includes(filePath)) {
    throw new Error(`Not a conflicted file: ${filePath}`);
  }
  const fullPath = path.resolve(repoRoot, filePath);
  const parent = fs.realpathSync.native(path.dirname(fullPath));
  if (parent !== repoRoot && !parent.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error(`Path is outside the repository: ${filePath}`);
  }
  if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isSymbolicLink()) {
    throw new Error(`Refusing to read or write through a symbolic link: ${filePath}`);
  }
  return fullPath;
};

const withConflictFile = async (targetPath, filePath, fn) => {
  const { repoRoot, scope } = await requireRepo(targetPath);
  assertPathsInScope(scope, [filePath]);
  return withRepoLock(repoRoot, async () => {
    try {
      return await fn(localGit(repoRoot), repoRoot);
    } catch (error) {
      throw toGitError(error);
    }
  });
};

const getConflict = (targetPath, { path: filePath } = {}) =>
  withConflictFile(targetPath, filePath, async (git, repoRoot) => {
    const fullPath = await resolveConflictFilePath(git, repoRoot, filePath);
    return {
      path: filePath,
      operation: await getOperation(repoRoot),
      content: fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null,
      current: await readStage(git, STAGE_BY_CHOICE.current, filePath),
      incoming: await readStage(git, STAGE_BY_CHOICE.incoming, filePath)
    };
  });

const resolveConflict = (targetPath, { path: filePath, choice, content } = {}) =>
  withConflictFile(targetPath, filePath, async (git, repoRoot) => {
    if (choice === 'content') {
      if (typeof content !== 'string') {
        throw new Error('Resolved content is required');
      }
      if (UNRESOLVED_MARKER.test(content)) {
        throw new Error('The file still has conflict markers (<<<<<<< or >>>>>>>)');
      }
      fs.writeFileSync(await resolveConflictFilePath(git, repoRoot, filePath), content, 'utf8');
      return git.raw(['add', '--', filePath]);
    }

    const stage = STAGE_BY_CHOICE[choice];
    if (!stage) {
      throw new Error('Choice must be "current", "incoming" or "content"');
    }
    if ((await readStage(git, stage, filePath)) === null) {
      return git.raw(['rm', '-q', '--', filePath]);
    }
    await git.raw(['checkout', stage === 2 ? '--ours' : '--theirs', '--', filePath]);
    return git.raw(['add', '--', filePath]);
  });

const withOperation = async (targetPath, fn) => {
  const { repoRoot } = await requireRepo(targetPath);
  return withRepoLock(repoRoot, async () => {
    const operation = await getOperation(repoRoot);
    if (!operation) {
      throw new Error('No merge or rebase in progress');
    }
    try {
      return await fn(operation, repoRoot);
    } catch (error) {
      throw toGitError(error);
    }
  });
};

const continueOperation = (targetPath) =>
  withOperation(targetPath, async (operation, repoRoot) => {
    const git = localGit(repoRoot, { GIT_EDITOR: 'true' });
    const unresolved = (await git.raw(['diff', '--name-only', '--diff-filter=U'])).trim();
    if (unresolved) {
      throw new Error(`Resolve every conflict first: ${unresolved.split(/\r\n|\r|\n/).join(', ')}`);
    }
    if (operation === 'rebase') {
      return git.raw(['rebase', '--continue']);
    }
    return git.raw(['commit', '--no-edit']);
  });

const abortOperation = (targetPath) =>
  withOperation(targetPath, (operation, repoRoot) => localGit(repoRoot).raw([operation, '--abort']));

module.exports = { getConflict, resolveConflict, continueOperation, abortOperation };

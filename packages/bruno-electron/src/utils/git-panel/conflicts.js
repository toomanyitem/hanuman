const fs = require('fs');
const path = require('path');
const { localGit, requireRepo, withRepoLock, toGitError, getOperation, assertPathsInScope } = require('./repo');

// Index stage 2 is the side checked out when the operation stopped ("ours"), stage 3 the side being applied
// ("theirs"). During a rebase that means upstream and your commit, so the UI names them Current and Incoming.
const STAGE_BY_CHOICE = { current: 2, incoming: 3 };
const UNRESOLVED_MARKER = /^(<{7}|>{7})(\s|$)/m;

// -z keeps non-ASCII names unquoted, so they compare equal to the paths the status list sent.
const listUnmergedPaths = async (git, pathspec = []) => {
  const output = await git.raw(['diff', '-z', '--name-only', '--diff-filter=U', ...(pathspec.length ? ['--', ...pathspec] : [])]);
  return output.split('\0').filter(Boolean);
};

// `ls-files -u` lists one line per stage that exists: "<mode> <sha> <stage>\t<path>".
const listStages = async (git, filePath) => {
  const output = await git.raw(['ls-files', '-u', '-z', '--', filePath]);
  return new Set(output.split('\0').filter(Boolean).map((entry) => Number(entry.split('\t')[0].split(' ')[2])));
};

const readStage = (git, stage, stages, filePath) => (stages.has(stage) ? git.raw(['show', `:${stage}:${filePath}`]) : null);

const isSymbolicLink = (fullPath) => {
  try {
    return fs.lstatSync(fullPath).isSymbolicLink();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};

// Only paths git lists as unmerged are touched, never through a symlink (dangling ones included), and only under the repo.
const resolveConflictFilePath = async (git, repoRoot, filePath) => {
  if (!(await listUnmergedPaths(git, [filePath])).includes(filePath)) {
    throw new Error(`Not a conflicted file: ${filePath}`);
  }
  const fullPath = path.resolve(repoRoot, filePath);
  const parent = fs.realpathSync.native(path.dirname(fullPath));
  if (parent !== repoRoot && !parent.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error(`Path is outside the repository: ${filePath}`);
  }
  if (isSymbolicLink(fullPath)) {
    throw new Error(`Refusing to read or write through a symbolic link: ${filePath}`);
  }
  return fullPath;
};

const writeWithoutFollowingLinks = (fullPath, content) => {
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | (fs.constants.O_NOFOLLOW || 0);
  const fd = fs.openSync(fullPath, flags, 0o644);
  try {
    fs.writeFileSync(fd, content, 'utf8');
  } finally {
    fs.closeSync(fd);
  }
};

// The editor works in LF; a file that used CRLF keeps it, so resolving doesn't rewrite every line ending.
const matchLineEndings = (content, original) =>
  original && original.includes('\r\n') ? content.replace(/\r?\n/g, '\r\n') : content;

const withConflictFile = async (targetPath, filePath, fn) => {
  const { repoRoot, scope } = await requireRepo(targetPath);
  assertPathsInScope(scope, [filePath]);
  return withRepoLock(repoRoot, async () => {
    try {
      const git = localGit(repoRoot);
      const fullPath = await resolveConflictFilePath(git, repoRoot, filePath);
      return await fn(git, repoRoot, fullPath);
    } catch (error) {
      throw toGitError(error);
    }
  });
};

const getConflict = (targetPath, { path: filePath } = {}) =>
  withConflictFile(targetPath, filePath, async (git, repoRoot, fullPath) => {
    const stages = await listStages(git, filePath);
    return {
      path: filePath,
      operation: await getOperation(repoRoot),
      content: fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null,
      current: await readStage(git, STAGE_BY_CHOICE.current, stages, filePath),
      incoming: await readStage(git, STAGE_BY_CHOICE.incoming, stages, filePath)
    };
  });

const resolveConflict = (targetPath, { path: filePath, choice, content } = {}) =>
  withConflictFile(targetPath, filePath, async (git, repoRoot, fullPath) => {
    if (choice === 'content') {
      if (typeof content !== 'string') {
        throw new Error('Resolved content is required');
      }
      if (UNRESOLVED_MARKER.test(content)) {
        throw new Error('The file still has conflict markers (<<<<<<< or >>>>>>>)');
      }
      const original = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null;
      writeWithoutFollowingLinks(fullPath, matchLineEndings(content, original));
      return git.raw(['add', '--', filePath]);
    }

    const stage = STAGE_BY_CHOICE[choice];
    if (!stage) {
      throw new Error('Choice must be "current", "incoming" or "content"');
    }
    // the chosen side deleted the file, so taking that side means deleting it
    if (!(await listStages(git, filePath)).has(stage)) {
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
    const unresolved = await listUnmergedPaths(git);
    if (unresolved.length) {
      throw new Error(`Resolve every conflict first: ${unresolved.join(', ')}`);
    }
    if (operation === 'rebase') {
      return git.raw(['rebase', '--continue']);
    }
    return git.raw(['commit', '--no-edit']);
  });

const abortOperation = (targetPath) =>
  withOperation(targetPath, (operation, repoRoot) => localGit(repoRoot).raw([operation, '--abort']));

module.exports = { getConflict, resolveConflict, continueOperation, abortOperation };

const { redactUrl } = require('./auth');
const { localGit, resolveRepo, getOperation, toGitError } = require('./repo');

const CONFLICT_PAIRS = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);

const toStagedCode = (index) => {
  if (index === 'M' || index === 'T') return 'M';
  if (index === 'A' || index === 'C') return 'A';
  if (index === 'D') return 'D';
  if (index === 'R') return 'R';
  return null;
};

const toUnstagedCode = (index, workingDir) => {
  if (index === '?' || workingDir === '?') return '?';
  if (workingDir === 'M' || workingDir === 'T') return 'M';
  if (workingDir === 'D') return 'D';
  return null;
};

const toPanelFile = ({ path, from, index, working_dir: workingDir }) => {
  if (CONFLICT_PAIRS.has(`${index}${workingDir}`)) {
    return { path, staged: null, unstaged: null, conflicted: true };
  }
  const file = { path, staged: toStagedCode(index), unstaged: toUnstagedCode(index, workingDir), conflicted: false };
  if (from && from !== path) file.from = from;
  return file;
};

const hasHeadCommit = async (git) => {
  try {
    await git.raw(['rev-parse', '--verify', 'HEAD']);
    return true;
  } catch (error) {
    return false;
  }
};

const getPanelStatus = async (targetPath) => {
  const repo = await resolveRepo(targetPath);
  if (!repo) return { isRepo: false };
  const { repoRoot, scope } = repo;
  const git = localGit(repoRoot);

  try {
    const [scoped, whole, operation, remotes, hasCommits] = await Promise.all([
      git.status(['--', scope]),
      git.status(),
      getOperation(repoRoot),
      git.getRemotes(true),
      hasHeadCommit(git)
    ]);

    return {
      isRepo: true,
      repoRoot,
      scope,
      hasCommits,
      branch: scoped.detached ? null : scoped.current,
      detached: scoped.detached,
      upstream: scoped.tracking || null,
      ahead: scoped.ahead,
      behind: scoped.behind,
      operation,
      repoHasTrackedChanges: whole.files.some((file) => file.index !== '?'),
      // a commit takes the whole index, so files staged elsewhere in the repo go in too
      stagedOutsideScope: whole.files.filter((file) => toStagedCode(file.index) && !scoped.files.some((f) => f.path === file.path)).length,
      files: scoped.files.map(toPanelFile),
      remotes: remotes.map(({ name, refs }) => ({ name, url: redactUrl(refs.fetch || refs.push) }))
    };
  } catch (error) {
    throw toGitError(error);
  }
};

module.exports = { getPanelStatus, hasHeadCommit };

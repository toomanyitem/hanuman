import { flattenItems } from 'utils/collections';
import { normalizePath } from 'utils/common/path';

export const getGitPanelTab = (collectionUid) => ({
  uid: `${collectionUid}-git`,
  collectionUid,
  type: 'git',
  preview: false
});

export const groupFiles = (files = []) => ({
  conflicts: files.filter((file) => file.conflicted),
  staged: files.filter((file) => !file.conflicted && file.staged),
  changes: files.filter((file) => !file.conflicted && file.unstaged)
});

// The main process reports the repo root as a real path (macOS: /private/var/...), while collections keep the
// path they were opened with. Deriving the root from the panel's own path keeps both on the same spelling.
export const getRepoRootInAppPaths = (targetPath, scope) => {
  const target = normalizePath(targetPath);
  if (!scope || scope === '.') return target;
  return target.endsWith(`/${scope}`) ? target.slice(0, -(scope.length + 1)) : target;
};

const isInsideFolder = (candidate, folder) => {
  const candidatePath = normalizePath(candidate);
  return candidatePath === folder || candidatePath.startsWith(`${folder}/`);
};

export const countUnsavedDraftsInRepo = (collections = [], repoRoot) => {
  if (!repoRoot) return 0;
  const root = normalizePath(repoRoot);
  return collections
    .filter((collection) => collection.pathname && isInsideFolder(collection.pathname, root))
    .reduce((count, collection) => {
      const itemDrafts = flattenItems(collection.items).filter((item) => item.draft).length;
      return count + itemDrafts + (collection.draft ? 1 : 0);
    }, 0);
};

// Index stage 2 is "current" and stage 3 "incoming"; what each means depends on the operation that stopped.
export const conflictLabels = (operation) => {
  if (operation === 'rebase') {
    return { current: 'the branch you are rebasing onto', incoming: 'your commit being replayed' };
  }
  if (operation === 'merge') {
    return { current: 'your branch', incoming: 'the branch being merged' };
  }
  return { current: 'your working tree', incoming: 'the stash' };
};

export const STATUS_LABELS = {
  'A': 'Added',
  'M': 'Modified',
  'D': 'Deleted',
  'R': 'Renamed',
  '?': 'Untracked'
};

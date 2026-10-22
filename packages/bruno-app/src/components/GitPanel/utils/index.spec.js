import { getGitPanelTab, groupFiles, getRepoRootInAppPaths, countUnsavedDraftsInRepo, conflictLabels } from './index';

describe('GitPanel utils', () => {
  test('getGitPanelTab gives one non-preview tab per collection', () => {
    expect(getGitPanelTab('c1')).toEqual({ uid: 'c1-git', collectionUid: 'c1', type: 'git', preview: false });
  });

  test('groupFiles puts conflicts alone and partially staged files in both lists', () => {
    const files = [
      { path: 'c/a.bru', staged: 'M', unstaged: 'M', conflicted: false },
      { path: 'c/b.bru', staged: null, unstaged: '?', conflicted: false },
      { path: 'c/c.bru', staged: null, unstaged: null, conflicted: true },
      { path: 'c/d.bru', staged: 'A', unstaged: null, conflicted: false }
    ];
    const { conflicts, staged, changes } = groupFiles(files);
    expect(conflicts.map((f) => f.path)).toEqual(['c/c.bru']);
    expect(staged.map((f) => f.path)).toEqual(['c/a.bru', 'c/d.bru']);
    expect(changes.map((f) => f.path)).toEqual(['c/a.bru', 'c/b.bru']);
  });

  test('getRepoRootInAppPaths strips the scope from the panel path', () => {
    expect(getRepoRootInAppPaths('/var/x/repo/collection', 'collection')).toBe('/var/x/repo');
    expect(getRepoRootInAppPaths('C:\\work\\repo\\api\\col', 'api/col')).toBe('C:/work/repo');
    expect(getRepoRootInAppPaths('/var/x/repo', '.')).toBe('/var/x/repo');
  });

  test('countUnsavedDraftsInRepo counts drafts of collections inside the repo only', () => {
    const collections = [
      { pathname: '/repo/api', draft: { root: {} }, items: [{ draft: {} }, { items: [{ draft: {} }, {}] }] },
      { pathname: '/repo', items: [{ draft: {} }] },
      { pathname: '/elsewhere/api', items: [{ draft: {} }] }
    ];
    expect(countUnsavedDraftsInRepo(collections, '/repo')).toBe(4);
    expect(countUnsavedDraftsInRepo(collections, null)).toBe(0);
  });

  test('conflictLabels describe each side per operation', () => {
    expect(conflictLabels('merge')).toEqual({ current: 'your branch', incoming: 'the branch being merged' });
    expect(conflictLabels('rebase').incoming).toBe('your commit being replayed');
    expect(conflictLabels(null).incoming).toBe('the stash');
  });
});

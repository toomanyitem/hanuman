const fs = require('fs');
const path = require('path');

jest.mock('../../src/store/git-credentials', () => ({ gitCredentialStore: { get: () => null } }));

const { getPanelStatus } = require('../../src/utils/git-panel/status');
const { stageFiles, unstageFiles, discardFiles, commit, getFileDiff } = require('../../src/utils/git-panel/changes');
const { git, makeTmpDir, createRemoteAndClones, writeFile, PING_BRU } = require('./repos');

const fileStatus = (status, filePath) => status.files.find((file) => file.path === filePath);

describe('git-panel status and changes', () => {
  let a;
  let collection;

  beforeEach(() => {
    ({ clones: { a } } = createRemoteAndClones(['a']));
    collection = path.join(a, 'collection');
  });

  test('returns isRepo false outside a repo', async () => {
    await expect(getPanelStatus(makeTmpDir('plain'))).resolves.toEqual({ isRepo: false });
  });

  test('reports branch, upstream and scoped files', async () => {
    writeFile(a, 'collection/ping.bru', PING_BRU('https://example.com/changed'));
    writeFile(a, 'collection/new.bru', PING_BRU('https://example.com/new'));
    writeFile(a, 'README.md', 'changed outside\n');

    const status = await getPanelStatus(collection);
    expect(status).toMatchObject({ isRepo: true, repoRoot: a, scope: 'collection', branch: 'main', upstream: 'origin/main', ahead: 0, behind: 0, operation: null, hasCommits: true, repoHasTrackedChanges: true });
    expect(fileStatus(status, 'collection/ping.bru')).toEqual({ path: 'collection/ping.bru', staged: null, unstaged: 'M', conflicted: false });
    expect(fileStatus(status, 'collection/new.bru')).toMatchObject({ unstaged: '?' });
    expect(fileStatus(status, 'README.md')).toBeUndefined();
    expect(status.remotes).toEqual([{ name: 'origin', url: expect.stringContaining('remote.git') }]);
  });

  test('stage, unstage and commit', async () => {
    writeFile(a, 'collection/ping.bru', PING_BRU('https://example.com/changed'));
    await stageFiles(collection, ['collection/ping.bru']);
    expect(fileStatus(await getPanelStatus(collection), 'collection/ping.bru')).toMatchObject({ staged: 'M', unstaged: null });

    await unstageFiles(collection, ['collection/ping.bru']);
    expect(fileStatus(await getPanelStatus(collection), 'collection/ping.bru')).toMatchObject({ staged: null, unstaged: 'M' });

    await stageFiles(collection, ['collection/ping.bru']);
    await expect(commit(collection, '  ')).rejects.toThrow('Commit message is required');
    await unstageFiles(collection, ['collection/ping.bru']);
    await expect(commit(collection, 'nothing staged')).rejects.toThrow(/no changes added to commit|nothing to commit/);
    await stageFiles(collection, ['collection/ping.bru']);
    const { commit: sha } = await commit(collection, 'change url');
    expect(sha).toBe(git(a, ['rev-parse', 'HEAD']));
    const status = await getPanelStatus(collection);
    expect(status.files).toEqual([]);
    expect(status.ahead).toBe(1);
  });

  test('staged modify plus working-tree delete keeps both sides', async () => {
    writeFile(a, 'collection/ping.bru', PING_BRU('https://example.com/changed'));
    await stageFiles(collection, ['collection/ping.bru']);
    fs.unlinkSync(path.join(a, 'collection/ping.bru'));
    expect(fileStatus(await getPanelStatus(collection), 'collection/ping.bru')).toMatchObject({ staged: 'M', unstaged: 'D' });
  });

  test('unstage works before the first commit', async () => {
    const repo = makeTmpDir('fresh');
    git(repo, ['init']);
    writeFile(repo, 'collection/a.bru', 'x');
    const target = path.join(repo, 'collection');
    await stageFiles(target, ['collection/a.bru']);
    expect(fileStatus(await getPanelStatus(target), 'collection/a.bru')).toMatchObject({ staged: 'A' });
    await unstageFiles(target, ['collection/a.bru']);
    expect(fileStatus(await getPanelStatus(target), 'collection/a.bru')).toMatchObject({ staged: null, unstaged: '?' });
  });

  test('discard restores tracked files, deletes untracked ones and leaves the rest', async () => {
    writeFile(a, 'collection/ping.bru', PING_BRU('https://example.com/changed'));
    writeFile(a, 'collection/new.bru', 'new');
    writeFile(a, 'README.md', 'changed outside\n');
    await discardFiles(collection, ['collection/ping.bru', 'collection/new.bru']);

    expect(fs.readFileSync(path.join(a, 'collection/ping.bru'), 'utf8')).toContain('https://example.com/ping');
    expect(fs.existsSync(path.join(a, 'collection/new.bru'))).toBe(false);
    expect(fs.readFileSync(path.join(a, 'README.md'), 'utf8')).toBe('changed outside\n');
  });

  test('refuses paths outside the collection', async () => {
    await expect(stageFiles(collection, ['README.md'])).rejects.toThrow('Path is outside this collection');
    await expect(discardFiles(collection, ['collection/../README.md'])).rejects.toThrow('Path is not valid');
  });

  test('diff of a .bru file is parsed for the visual viewer', async () => {
    writeFile(a, 'collection/ping.bru', PING_BRU('https://example.com/changed'));
    const diff = await getFileDiff(collection, { path: 'collection/ping.bru', area: 'unstaged' });
    expect(diff.visual).toBe(true);
    expect(diff.oldParsed.request.url).toBe('https://example.com/ping');
    expect(diff.newParsed.request.url).toBe('https://example.com/changed');
  });
});

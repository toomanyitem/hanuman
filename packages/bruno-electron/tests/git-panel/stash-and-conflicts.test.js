const fs = require('fs');
const path = require('path');

jest.mock('../../src/store/git-credentials', () => ({ gitCredentialStore: { get: () => null } }));

const { getPanelStatus } = require('../../src/utils/git-panel/status');
const { pull } = require('../../src/utils/git-panel/sync');
const { stashPush, listStashes, stashPop, stashDrop } = require('../../src/utils/git-panel/stash');
const { getConflict, resolveConflict, continueOperation, abortOperation } = require('../../src/utils/git-panel/conflicts');
const { git, createRemoteAndClones, writeFile, commitAll, PING_BRU } = require('./repos');

const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('git-panel stash', () => {
  let a;
  let collection;

  beforeEach(() => {
    ({ clones: { a } } = createRemoteAndClones(['a']));
    collection = path.join(a, 'collection');
  });

  test('push then pop restores the change and empties the list', async () => {
    writeFile(a, 'collection/ping.bru', PING_BRU('https://example.com/stashed'));
    await stashPush(collection, { message: 'my work' });
    expect(read(a, 'collection/ping.bru')).toContain('https://example.com/ping');
    const stashes = await listStashes(collection);
    expect(stashes).toHaveLength(1);
    expect(stashes[0].message).toContain('my work');

    await stashPop(collection, { index: 0 });
    expect(read(a, 'collection/ping.bru')).toContain('https://example.com/stashed');
    expect(await listStashes(collection)).toEqual([]);
  });

  test('a scoped stash leaves changes outside the collection', async () => {
    writeFile(a, 'collection/ping.bru', PING_BRU('https://example.com/stashed'));
    writeFile(a, 'README.md', 'outside change\n');
    await stashPush(collection, {});
    expect(read(a, 'README.md')).toBe('outside change\n');

    await stashPush(collection, { repoWide: true, message: 'everything' });
    expect(read(a, 'README.md')).toBe('outside the collection\n');
    expect(await listStashes(collection)).toHaveLength(2);
  });

  test('explains when there is nothing to stash and validates the index', async () => {
    await expect(stashPush(collection, {})).rejects.toThrow('There are no local changes to stash');
    await expect(stashDrop(collection, { index: -1 })).rejects.toThrow('Stash index is not valid');
    await expect(stashDrop(collection, { index: 0 })).rejects.toThrow();
  });
});

describe('git-panel conflicts', () => {
  let repos;
  let a;
  let b;
  let collectionB;

  // A and B edit the same line; A pushes first.
  const divergeOnPing = () => {
    writeFile(a, 'collection/ping.bru', PING_BRU('https://example.com/from-a'));
    commitAll(a, 'from a');
    git(a, ['push']);
    writeFile(b, 'collection/ping.bru', PING_BRU('https://example.com/from-b'));
    commitAll(b, 'from b');
  };

  beforeEach(() => {
    repos = createRemoteAndClones(['a', 'b']);
    ({ a, b } = repos.clones);
    collectionB = path.join(b, 'collection');
  });

  test('merge conflict resolved with the incoming side', async () => {
    divergeOnPing();
    await expect(pull(collectionB, { mode: 'merge' })).rejects.toThrow(/CONFLICT/);

    const status = await getPanelStatus(collectionB);
    expect(status.operation).toBe('merge');
    expect(status.files).toContainEqual({ path: 'collection/ping.bru', staged: null, unstaged: null, conflicted: true });

    const conflict = await getConflict(collectionB, { path: 'collection/ping.bru' });
    expect(conflict.content).toMatch(/^<{7}/m);
    expect(conflict.current).toContain('from-b');
    expect(conflict.incoming).toContain('from-a');

    await expect(continueOperation(collectionB)).rejects.toThrow('Resolve every conflict first');
    await resolveConflict(collectionB, { path: 'collection/ping.bru', choice: 'incoming' });
    await continueOperation(collectionB);

    expect((await getPanelStatus(collectionB)).operation).toBeNull();
    expect(git(b, ['rev-list', '--merges', '-1', 'HEAD'])).not.toBe('');
    expect(read(b, 'collection/ping.bru')).toContain('from-a');
  });

  test('rebase conflict resolved with the current side', async () => {
    divergeOnPing();
    await expect(pull(collectionB, { mode: 'rebase' })).rejects.toThrow();
    expect((await getPanelStatus(collectionB)).operation).toBe('rebase');

    const conflict = await getConflict(collectionB, { path: 'collection/ping.bru' });
    // during a rebase the checked-out side is upstream and the incoming side is the replayed local commit
    expect(conflict.current).toContain('from-a');
    expect(conflict.incoming).toContain('from-b');

    await resolveConflict(collectionB, { path: 'collection/ping.bru', choice: 'current' });
    await continueOperation(collectionB);
    expect((await getPanelStatus(collectionB)).operation).toBeNull();
    expect(git(b, ['rev-list', '--merges', 'HEAD'])).toBe('');
  });

  test('stash-pop conflict resolved with edited content keeps the stash', async () => {
    writeFile(b, 'collection/ping.bru', PING_BRU('https://example.com/stashed'));
    git(b, ['stash', 'push']);
    writeFile(b, 'collection/ping.bru', PING_BRU('https://example.com/committed'));
    commitAll(b, 'committed');

    await expect(stashPop(collectionB, { index: 0 })).rejects.toThrow(/CONFLICT/);
    const status = await getPanelStatus(collectionB);
    expect(status.operation).toBeNull();
    expect(status.files.find((file) => file.path === 'collection/ping.bru').conflicted).toBe(true);

    await expect(resolveConflict(collectionB, { path: 'collection/ping.bru', choice: 'content', content: '<<<<<<< x\n' }))
      .rejects.toThrow('still has conflict markers');
    await resolveConflict(collectionB, { path: 'collection/ping.bru', choice: 'content', content: PING_BRU('https://example.com/merged') });

    expect(read(b, 'collection/ping.bru')).toContain('merged');
    expect((await getPanelStatus(collectionB)).files.some((file) => file.conflicted)).toBe(false);
    expect(await listStashes(collectionB)).toHaveLength(1);
    await expect(continueOperation(collectionB)).rejects.toThrow('No merge or rebase in progress');
  });

  test('abort during a merge restores the previous HEAD', async () => {
    divergeOnPing();
    const before = git(b, ['rev-parse', 'HEAD']);
    await expect(pull(collectionB, { mode: 'merge' })).rejects.toThrow();
    await abortOperation(collectionB);
    expect(git(b, ['rev-parse', 'HEAD'])).toBe(before);
    expect((await getPanelStatus(collectionB)).operation).toBeNull();
  });
});

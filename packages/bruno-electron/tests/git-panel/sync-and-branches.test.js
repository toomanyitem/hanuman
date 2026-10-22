const http = require('http');
const path = require('path');

const mockCredentials = new Map();
jest.mock('../../src/store/git-credentials', () => ({
  gitCredentialStore: { get: (host) => mockCredentials.get(host) || null }
}));

const { getPanelStatus } = require('../../src/utils/git-panel/status');
const { fetchRemote, pull, push } = require('../../src/utils/git-panel/sync');
const { listBranches, createBranch, checkoutBranch, deleteBranch } = require('../../src/utils/git-panel/branches');
const { listRemotes, addRemote, setRemoteUrl, removeRemote, initRepository } = require('../../src/utils/git-panel/remotes');
const { git, makeTmpDir, createRemoteAndClones, writeFile, commitAll, PING_BRU } = require('./repos');

describe('git-panel fetch, pull and push', () => {
  let repos;
  let a;
  let b;

  beforeEach(() => {
    repos = createRemoteAndClones(['a', 'b']);
    ({ a, b } = repos.clones);
  });

  test('B pulls what A pushed (merge)', async () => {
    writeFile(a, 'collection/ping.bru', PING_BRU('https://example.com/from-a'));
    commitAll(a, 'from a');
    await push(path.join(a, 'collection'));
    expect(git(repos.remote, ['log', '-1', '--format=%s', 'main'])).toBe('from a');

    await fetchRemote(path.join(b, 'collection'));
    expect((await getPanelStatus(path.join(b, 'collection'))).behind).toBe(1);
    await pull(path.join(b, 'collection'), { mode: 'merge' });
    expect(git(b, ['rev-parse', 'HEAD'])).toBe(git(a, ['rev-parse', 'HEAD']));
  });

  test('pull with rebase keeps history linear', async () => {
    writeFile(a, 'collection/ping.bru', PING_BRU('https://example.com/from-a'));
    commitAll(a, 'from a');
    git(a, ['push']);
    writeFile(b, 'collection/other.bru', 'other');
    commitAll(b, 'from b');

    await pull(path.join(b, 'collection'), { mode: 'rebase' });
    expect(git(b, ['rev-list', '--merges', 'HEAD'])).toBe('');
    expect(git(b, ['log', '--format=%s', '-2'])).toBe('from b\nfrom a');
  });

  test('push sets upstream on a new branch; pull without upstream explains', async () => {
    git(a, ['checkout', '-b', 'feature/x']);
    await expect(pull(a, { mode: 'merge' })).rejects.toThrow('This branch has no upstream. Push it first or set one.');
    await push(a);
    expect(git(a, ['rev-parse', '--abbrev-ref', '@{u}'])).toBe('origin/feature/x');
  });

  test('push goes to the tracked branch even when it has another name', async () => {
    git(a, ['checkout', '-b', 'feature', '--track', 'origin/main']);
    writeFile(a, 'collection/f.bru', 'f');
    commitAll(a, 'on feature');
    await push(a);
    expect(git(repos.remote, ['log', '-1', '--format=%s', 'main'])).toBe('on feature');
    expect(git(repos.remote, ['branch', '--list', 'feature'])).toBe('');
  });

  test('a new branch is pushed to the only remote when it is not called origin', async () => {
    git(a, ['remote', 'rename', 'origin', 'upstream']);
    git(a, ['checkout', '-b', 'topic']);
    await push(a);
    expect(git(a, ['rev-parse', '--abbrev-ref', '@{u}'])).toBe('upstream/topic');
  });

  test('fails fast when the server asks for credentials, without echoing the token', async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="git"' });
      res.end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const host = `127.0.0.1:${server.address().port}`;
    git(a, ['remote', 'add', 'x', `http://${host}/repo.git`]);
    try {
      const started = Date.now();
      await expect(fetchRemote(a, { remote: 'x' })).rejects.toThrow();

      mockCredentials.set(host, { username: 'bob', token: 'tok-SECRET-123' });
      const error = await fetchRemote(a, { remote: 'x' }).catch((e) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).not.toContain('tok-SECRET-123');
      expect(Date.now() - started).toBeLessThan(15000);
    } finally {
      mockCredentials.clear();
      server.close();
    }
  });

  test('refuses to attach a token when the repository config redirects traffic', async () => {
    let requests = 0;
    const server = http.createServer((req, res) => {
      requests += 1;
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="git"' });
      res.end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const host = `127.0.0.1:${server.address().port}`;
    git(a, ['remote', 'add', 'x', `http://${host}/repo.git`]);
    mockCredentials.set(host, { username: 'bob', token: 'tok-SECRET-123' });
    try {
      git(a, ['config', '--local', `http.http://${host}/.proxy`, 'http://127.0.0.1:9']);
      await expect(fetchRemote(a, { remote: 'x' })).rejects.toThrow(/proxy.*access token/);

      git(a, ['config', '--local', '--unset', `http.http://${host}/.proxy`]);
      git(a, ['config', '--local', 'http.sslVerify', 'NO']);
      await expect(fetchRemote(a, { remote: 'x' })).rejects.toThrow(/sslverify/);
      git(a, ['config', '--local', '--unset', 'http.sslVerify']);

      git(a, ['config', '--local', 'extensions.worktreeConfig', 'true']);
      git(a, ['config', '--worktree', 'http.sslCAInfo', '/tmp/evil-ca.pem']);
      await expect(fetchRemote(a, { remote: 'x' })).rejects.toThrow(/sslcainfo/);
      expect(requests).toBe(0);

      git(a, ['config', '--worktree', '--unset', 'http.sslCAInfo']);
      await expect(fetchRemote(a, { remote: 'x' })).rejects.not.toThrow(/access token for/);
      expect(requests).toBeGreaterThan(0);
    } finally {
      mockCredentials.clear();
      server.close();
    }
  });
});

describe('git-panel branches, remotes and init', () => {
  let repos;
  let a;
  let b;

  beforeEach(() => {
    repos = createRemoteAndClones(['a', 'b']);
    ({ a, b } = repos.clones);
  });

  test('create, list and checkout a remote branch', async () => {
    await createBranch(a, { name: 'feature/x' });
    expect((await listBranches(a)).current).toBe('feature/x');

    git(a, ['checkout', '-b', 'dev']);
    git(a, ['push', '-u', 'origin', 'dev']);
    git(b, ['fetch']);
    const branches = await listBranches(b);
    expect(branches.remote).toEqual(expect.arrayContaining(['origin/main', 'origin/dev']));
    expect(branches.remote).not.toContain('origin/HEAD');

    await checkoutBranch(b, { name: 'origin/dev' });
    const after = await listBranches(b);
    expect(after.current).toBe('dev');
    expect(after.local.find((branch) => branch.name === 'dev')).toMatchObject({ upstream: 'origin/dev', ahead: 0, behind: 0 });
  });

  test('delete needs force for unmerged work and refuses the current branch', async () => {
    await createBranch(a, { name: 'wip' });
    writeFile(a, 'collection/wip.bru', 'wip');
    commitAll(a, 'wip');
    await checkoutBranch(a, { name: 'main' });

    await expect(deleteBranch(a, { name: 'wip' })).rejects.toThrow(/not fully merged/);
    await deleteBranch(a, { name: 'wip', force: true });
    expect((await listBranches(a)).local.map((branch) => branch.name)).toEqual(['main']);
    await expect(deleteBranch(a, { name: 'main' })).rejects.toThrow('Switch to another branch before deleting this one');
  });

  test('bad branch names are refused', async () => {
    await expect(createBranch(a, { name: '-x' })).rejects.toThrow();
    await expect(createBranch(a, { name: 'a..b' })).rejects.toThrow('not a valid branch name');
  });

  test('add, edit and remove remotes', async () => {
    await addRemote(a, { name: 'mirror', url: 'https://bob:pw@example.com/a.git' });
    expect(await listRemotes(a)).toContainEqual({ name: 'mirror', url: 'https://bob:***@example.com/a.git' });
    await setRemoteUrl(a, { name: 'mirror', url: 'https://example.com/b.git' });
    expect(git(a, ['remote', 'get-url', 'mirror'])).toBe('https://example.com/b.git');
    await removeRemote(a, { name: 'mirror' });
    expect((await listRemotes(a)).map((remote) => remote.name)).toEqual(['origin']);
    await expect(addRemote(a, { name: '-x', url: 'u' })).rejects.toThrow();
    await expect(addRemote(a, { name: 'y', url: '--upload-pack=evil' })).rejects.toThrow('Remote URL is not valid');
  });

  test('initRepository creates main with no commits and refuses nested repos', async () => {
    const dir = makeTmpDir('init');
    await initRepository(dir);
    expect(await getPanelStatus(dir)).toMatchObject({ isRepo: true, branch: 'main', hasCommits: false, files: [] });
    await expect(initRepository(path.join(b, 'collection'))).rejects.toThrow('already inside a Git repository');
  });
});

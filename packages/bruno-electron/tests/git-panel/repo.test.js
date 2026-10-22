const fs = require('fs');
const path = require('path');

const mockCredentials = new Map();
jest.mock('../../src/store/git-credentials', () => ({
  gitCredentialStore: {
    get: (host) => mockCredentials.get(host) || null
  }
}));

const { resolveRepo, withRepoLock, getOperation, assertBranchName } = require('../../src/utils/git-panel/repo');
const { scrubSecrets, hostFromRemoteUrl, redactUrl, credentialConfig } = require('../../src/utils/git-panel/auth');
const { git, makeTmpDir, createRemoteAndClones, writeFile, commitAll } = require('./repos');

describe('git-panel repo core', () => {
  let repos;

  beforeAll(() => {
    repos = createRemoteAndClones(['a']);
  });

  test('resolveRepo gives the repo root and a posix scope', async () => {
    const { a } = repos.clones;
    await expect(resolveRepo(path.join(a, 'collection'))).resolves.toEqual({ repoRoot: a, scope: 'collection' });
    await expect(resolveRepo(a)).resolves.toEqual({ repoRoot: a, scope: '.' });
  });

  test('resolveRepo returns null outside a repo and works under a folder named like .git', async () => {
    await expect(resolveRepo(makeTmpDir('plain'))).resolves.toBeNull();

    const parent = path.join(makeTmpDir('dotted'), 'my.github');
    const repo = path.join(parent, 'repo');
    fs.mkdirSync(repo, { recursive: true });
    git(repo, ['init']);
    fs.mkdirSync(path.join(repo, 'collection'));
    await expect(resolveRepo(path.join(repo, 'collection'))).resolves.toEqual({ repoRoot: repo, scope: 'collection' });
  });

  test('withRepoLock runs calls for the same repo in order', async () => {
    const order = [];
    const first = withRepoLock('/repo', async () => {
      order.push('1-start');
      await new Promise((resolve) => setTimeout(resolve, 50));
      order.push('1-end');
      throw new Error('first failed');
    });
    const second = withRepoLock('/repo', async () => {
      order.push('2-start');
      order.push('2-end');
      return 'second';
    });
    await expect(first).rejects.toThrow('first failed');
    await expect(second).resolves.toBe('second');
    expect(order).toEqual(['1-start', '1-end', '2-start', '2-end']);
  });

  test('getOperation reports a merge in progress', async () => {
    const repo = makeTmpDir('merge');
    git(repo, ['init']);
    git(repo, ['config', 'user.name', 'T']);
    git(repo, ['config', 'user.email', 't@t']);
    git(repo, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
    writeFile(repo, 'f.txt', 'base\n');
    commitAll(repo, 'base');
    git(repo, ['checkout', '-b', 'other']);
    writeFile(repo, 'f.txt', 'other\n');
    commitAll(repo, 'other');
    git(repo, ['checkout', 'main']);
    writeFile(repo, 'f.txt', 'main\n');
    commitAll(repo, 'main');

    await expect(getOperation(repo)).resolves.toBeNull();
    expect(() => git(repo, ['merge', 'other'])).toThrow();
    await expect(getOperation(repo)).resolves.toBe('merge');
  });

  test('assertBranchName accepts valid names and rejects the rest', async () => {
    const { a } = repos.clones;
    await expect(assertBranchName(a, 'feature/x')).resolves.toBeUndefined();
    for (const bad of ['-x', 'a..b', 'feature/ok~', '']) {
      await expect(assertBranchName(a, bad)).rejects.toThrow();
    }
  });
});

describe('git-panel auth helpers', () => {
  test('scrubSecrets removes tokens and url passwords', () => {
    const scrubbed = scrubSecrets('fatal: https://bob:s3cr3t@host/x and s3cr3t', ['s3cr3t']);
    expect(scrubbed).not.toContain('s3cr3t');
    expect(scrubbed).not.toContain('bob:s');
  });

  test('redactUrl keeps the username but hides the password', () => {
    expect(redactUrl('https://bob:s3cr3t@host/x.git')).toBe('https://bob:***@host/x.git');
    expect(redactUrl('git@github.com:a/b.git')).toBe('git@github.com:a/b.git');
  });

  test('hostFromRemoteUrl handles https hosts and ignores ssh remotes', () => {
    expect(hostFromRemoteUrl('https://GitHub.com/a/b.git')).toBe('github.com');
    expect(hostFromRemoteUrl('https://h:8443/x')).toBe('h:8443');
    expect(hostFromRemoteUrl('git@github.com:a/b.git')).toBeNull();
    expect(hostFromRemoteUrl('/tmp/remote.git')).toBeNull();
    expect(hostFromRemoteUrl('http://git.internal/a.git')).toBeNull();
    expect(hostFromRemoteUrl('http://127.0.0.1:3000/a.git')).toBe('127.0.0.1:3000');
  });

  test('credentialConfig resets user helpers and keys ours to the remote host', () => {
    const config = credentialConfig('https://GitLab.example.com:8443/team/repo.git');
    expect(config[0]).toBe('credential.helper=');
    expect(config[1]).toMatch(/^credential\.https:\/\/gitlab\.example\.com:8443\.helper=!f\(\)/);
    expect(config.join(' ')).not.toMatch(/tok|password=[^$]/);
  });
});

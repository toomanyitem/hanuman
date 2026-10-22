const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const git = (cwd, args, env = {}) =>
  execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } }).toString().trim();

const makeTmpDir = (tag = 'git-panel') => fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), `${tag}-`)));

const configureIdentity = (clone) => {
  git(clone, ['config', 'user.name', 'Hanuman Test']);
  git(clone, ['config', 'user.email', 'test@hanuman.local']);
  git(clone, ['config', 'commit.gpgsign', 'false']);
};

const PING_BRU = (url) => `meta {
  name: ping
  type: http
  seq: 1
}

get {
  url: ${url}
  body: none
  auth: none
}
`;

const writeFile = (root, relativePath, content) => {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
};

const commitAll = (clone, message) => {
  git(clone, ['add', '-A']);
  git(clone, ['commit', '-m', message]);
};

// A bare remote on `main` plus clones that share one commit holding collection/{bruno.json,ping.bru}.
const createRemoteAndClones = (names = ['a', 'b']) => {
  const root = makeTmpDir();
  const remote = path.join(root, 'remote.git');
  git(root, ['init', '--bare', remote]);
  git(remote, ['symbolic-ref', 'HEAD', 'refs/heads/main']);

  const clones = {};
  names.forEach((name, index) => {
    const clone = path.join(root, name);
    git(root, ['clone', remote, clone]);
    configureIdentity(clone);
    if (index === 0) {
      git(clone, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
      writeFile(clone, 'collection/bruno.json', JSON.stringify({ version: '1', name: 'Git Panel Collection', type: 'collection' }));
      writeFile(clone, 'collection/ping.bru', PING_BRU('https://example.com/ping'));
      writeFile(clone, 'README.md', 'outside the collection\n');
      commitAll(clone, 'initial');
      git(clone, ['push', '-u', 'origin', 'main']);
    }
    clones[name] = clone;
  });
  return { root, remote, clones };
};

module.exports = { git, makeTmpDir, configureIdentity, createRemoteAndClones, writeFile, commitAll, PING_BRU };

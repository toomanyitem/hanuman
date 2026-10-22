import fs from 'node:fs';
import path from 'node:path';
import { test } from '../../playwright';
import { hasGitInstalled, runGit } from '../collection/git/helpers';

export const pingBru = (url: string) => `meta {
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

// CI must not go green by skipping: a runner without git fails the suite instead.
export const requireGit = () => {
  if (hasGitInstalled()) return;
  if (process.env.CI) throw new Error('git is required for the Git panel e2e tests');
  test.skip(true, 'git is not installed');
};

export const writeFile = (root: string, relativePath: string, content: string) => {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
};

export const commitAll = (clone: string, message: string) => {
  runGit(clone, ['add', '-A']);
  runGit(clone, ['commit', '-m', message]);
};

/**
 * A bare remote on `main` and two clones A and B. A holds the first commit with a one-request
 * collection named `collectionName` under `collection/`; B is cloned after it was pushed.
 */
export const setupRepos = (tmpDir: string, collectionName: string) => {
  const remote = path.join(tmpDir, 'remote.git');
  const a = path.join(tmpDir, 'a');
  const b = path.join(tmpDir, 'b');

  runGit(tmpDir, ['init', '--bare', remote]);
  runGit(remote, ['symbolic-ref', 'HEAD', 'refs/heads/main']);

  const configure = (clone: string) => {
    runGit(clone, ['config', 'user.name', 'Hanuman E2E']);
    runGit(clone, ['config', 'user.email', 'e2e@hanuman.local']);
    runGit(clone, ['config', 'commit.gpgsign', 'false']);
  };

  runGit(tmpDir, ['clone', remote, a]);
  configure(a);
  runGit(a, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
  writeFile(a, 'collection/bruno.json', JSON.stringify({ version: '1', name: collectionName, type: 'collection' }, null, 2));
  writeFile(a, 'collection/ping.bru', pingBru('https://example.com/ping'));
  commitAll(a, 'initial collection');
  runGit(a, ['push', '-u', 'origin', 'main']);

  runGit(tmpDir, ['clone', remote, b]);
  configure(b);

  return { remote, a, b, collectionA: path.join(a, 'collection'), collectionB: path.join(b, 'collection') };
};

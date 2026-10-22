import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../playwright';
import {
  buildCommonLocators,
  closeAllCollections,
  commitStaged,
  fetchRemote,
  fillRequestUrl,
  openCollection,
  openCollectionFromDialog,
  openGitPanel,
  openRequest,
  pullBranch,
  pushBranch,
  removeCollection,
  saveRequest,
  stageFile
} from '../utils/page';
import { runGit } from '../collection/git/helpers';
import { requireGit, setupRepos } from './helpers';

const COLLECTION = 'Git Panel Push Pull';

test.describe('Git panel: commit, push and pull', () => {
  test.afterEach(async ({ page }) => {
    await closeAllCollections(page);
  });

  test('a commit pushed from clone A reaches clone B through pull', async ({ page, electronApp, createTmpDir }) => {
    requireGit();
    const repos = setupRepos(await createTmpDir('git-panel-push-pull'), COLLECTION);
    const locators = buildCommonLocators(page);

    await test.step('clone A: edit the request, commit and push', async () => {
      await openCollectionFromDialog(page, electronApp, repos.collectionA);
      await expect(locators.sidebar.collection(COLLECTION)).toBeVisible({ timeout: 30000 });
      await openCollection(page, COLLECTION);
      await openRequest(page, COLLECTION, 'ping');
      await fillRequestUrl(page, 'https://example.com/from-a');
      await saveRequest(page);

      await openGitPanel(page, COLLECTION);
      await stageFile(page, 'collection/ping.bru');
      await commitStaged(page, 'change url from A');
      await expect(locators.gitPanel.ahead()).toHaveAttribute('data-count', '1');
      await pushBranch(page);

      // the commit really reached the bare remote, not only the panel's counters
      expect(runGit(repos.remote, ['log', '-1', '--format=%s', 'main'])).toBe('change url from A');
      await removeCollection(page, COLLECTION);
    });

    await test.step('clone B: fetch shows it behind, pull brings the change', async () => {
      await openCollectionFromDialog(page, electronApp, repos.collectionB);
      await expect(locators.sidebar.collection(COLLECTION)).toBeVisible({ timeout: 30000 });
      await openCollection(page, COLLECTION);
      await openGitPanel(page, COLLECTION);

      await fetchRemote(page);
      await expect(locators.gitPanel.behind()).toHaveAttribute('data-count', '1');
      await pullBranch(page, 'merge');
      await expect(locators.gitPanel.behind()).toHaveAttribute('data-count', '0');

      expect(fs.readFileSync(path.join(repos.collectionB, 'ping.bru'), 'utf8')).toContain('https://example.com/from-a');
      await openRequest(page, COLLECTION, 'ping');
      await expect(locators.request.urlLine()).toContainText('https://example.com/from-a');
    });
  });
});

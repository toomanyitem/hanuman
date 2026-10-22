import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../playwright';
import {
  buildCommonLocators,
  closeAllCollections,
  commitStaged,
  fillRequestUrl,
  openCollection,
  openCollectionFromDialog,
  openGitPanel,
  openRequest,
  pullBranch,
  saveRequest,
  stageFile
} from '../utils/page';
import { runGit } from '../collection/git/helpers';
import { commitAll, pingBru, requireGit, setupRepos, writeFile } from './helpers';

const COLLECTION = 'Git Panel Conflict';

test.describe('Git panel: merge conflicts', () => {
  test.afterEach(async ({ page }) => {
    await closeAllCollections(page);
  });

  test('a conflicting pull is resolved in the app and the merge completes', async ({ page, electronApp, createTmpDir }) => {
    requireGit();
    const repos = setupRepos(await createTmpDir('git-panel-conflict'), COLLECTION);
    const locators = buildCommonLocators(page);

    // clone A changes the same line first and pushes
    writeFile(repos.a, 'collection/ping.bru', pingBru('https://example.com/from-a'));
    commitAll(repos.a, 'url from A');
    runGit(repos.a, ['push']);

    await openCollectionFromDialog(page, electronApp, repos.collectionB);
    await expect(locators.sidebar.collection(COLLECTION)).toBeVisible({ timeout: 30000 });
    await openCollection(page, COLLECTION);
    await openRequest(page, COLLECTION, 'ping');
    await fillRequestUrl(page, 'https://example.com/from-b');
    await saveRequest(page);

    await openGitPanel(page, COLLECTION);
    await stageFile(page, 'collection/ping.bru');
    await commitStaged(page, 'url from B');
    await pullBranch(page, 'merge');

    await test.step('the conflict is reported, not swallowed', async () => {
      await expect(locators.gitPanel.error()).toContainText('CONFLICT');
      await expect(locators.gitPanel.operationBanner()).toHaveAttribute('data-operation', 'merge');
      await expect(locators.gitPanel.button('git-continue')).toBeDisabled();
    });

    await test.step('take the incoming side and commit the merge', async () => {
      await locators.gitPanel.fileRow('conflicts', 'collection/ping.bru').click();
      await expect(locators.gitPanel.conflict()).toBeVisible();
      await locators.gitPanel.button('git-use-incoming').click();
      await expect(locators.gitPanel.fileRow('conflicts', 'collection/ping.bru')).toHaveCount(0);
      await locators.gitPanel.button('git-continue').click();
      await expect(locators.gitPanel.operationBanner()).toHaveCount(0);
    });

    expect(runGit(repos.b, ['rev-list', '--merges', '-1', 'HEAD'])).not.toBe('');
    expect(fs.readFileSync(path.join(repos.collectionB, 'ping.bru'), 'utf8')).toContain('https://example.com/from-a');
    await expect(locators.gitPanel.ahead()).toHaveAttribute('data-count', '2');
  });
});

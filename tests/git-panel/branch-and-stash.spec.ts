import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../playwright';
import {
  buildCommonLocators,
  closeAllCollections,
  createBranch,
  fillRequestUrl,
  openCollection,
  openCollectionFromDialog,
  openGitPanel,
  openRequest,
  popLatestStash,
  requestBranchSwitch,
  saveRequest,
  stashChanges
} from '../utils/page';
import { currentGitBranch } from '../collection/git/helpers';
import { requireGit, setupRepos } from './helpers';

const readPing = (collectionPath: string) => fs.readFileSync(path.join(collectionPath, 'ping.bru'), 'utf8');

test.describe('Git panel: branches and stash', () => {
  test.afterEach(async ({ page }) => {
    await closeAllCollections(page);
  });

  test('create and switch branches, stashing uncommitted work on the way', async ({ page, electronApp, createTmpDir }) => {
    requireGit();
    const collection = 'Git Panel Branches';
    const repos = setupRepos(await createTmpDir('git-panel-branches'), collection);
    const locators = buildCommonLocators(page);

    await openCollectionFromDialog(page, electronApp, repos.collectionA);
    await expect(locators.sidebar.collection(collection)).toBeVisible({ timeout: 30000 });
    await openCollection(page, collection);
    await openGitPanel(page, collection);

    await createBranch(page, 'feature/x');
    expect(currentGitBranch(repos.a)).toBe('feature/x');

    await openRequest(page, collection, 'ping');
    await fillRequestUrl(page, 'https://example.com/on-feature');
    await saveRequest(page);
    await openGitPanel(page, collection);

    await requestBranchSwitch(page, 'main');
    await locators.gitPanel.button('git-stash-and-switch-submit-btn').click();
    await expect(locators.gitPanel.currentBranch()).toHaveText('main');
    expect(currentGitBranch(repos.a)).toBe('main');
    await expect(locators.gitPanel.stashItems()).toHaveCount(1);
    expect(readPing(repos.collectionA)).toContain('https://example.com/ping');

    await requestBranchSwitch(page, 'feature/x');
    await expect(locators.gitPanel.currentBranch()).toHaveText('feature/x');
    await popLatestStash(page);
    await expect(locators.gitPanel.stashItems()).toHaveCount(0);
    expect(readPing(repos.collectionA)).toContain('https://example.com/on-feature');
  });

  test('stash changes and pop them back', async ({ page, electronApp, createTmpDir }) => {
    requireGit();
    const collection = 'Git Panel Stash';
    const repos = setupRepos(await createTmpDir('git-panel-stash'), collection);
    const locators = buildCommonLocators(page);

    await openCollectionFromDialog(page, electronApp, repos.collectionA);
    await expect(locators.sidebar.collection(collection)).toBeVisible({ timeout: 30000 });
    await openCollection(page, collection);
    await openRequest(page, collection, 'ping');
    await fillRequestUrl(page, 'https://example.com/stashed');
    await saveRequest(page);

    await openGitPanel(page, collection);
    await expect(locators.gitPanel.fileRow('changes', 'collection/ping.bru')).toBeVisible();
    await stashChanges(page, 'half-done url change');
    await expect(locators.gitPanel.stashItems()).toHaveCount(1);
    await expect(locators.gitPanel.stashItems().first()).toContainText('half-done url change');
    await expect(locators.gitPanel.noChanges()).toBeVisible();
    expect(readPing(repos.collectionA)).toContain('https://example.com/ping');

    await popLatestStash(page);
    await expect(locators.gitPanel.stashItems()).toHaveCount(0);
    await expect(locators.gitPanel.fileRow('changes', 'collection/ping.bru')).toBeVisible();
    expect(readPing(repos.collectionA)).toContain('https://example.com/stashed');
  });
});

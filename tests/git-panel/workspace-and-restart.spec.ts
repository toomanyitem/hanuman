import fs from 'node:fs';
import path from 'node:path';
import { test, expect, closeElectronApp } from '../../playwright';
import {
  buildCommonLocators,
  openCollection,
  openCollectionFromDialog,
  openGitPanel,
  openWorkspaceGitPanel,
  switchWorkspace,
  waitForReadyPage
} from '../utils/page';
import { runGit } from '../collection/git/helpers';
import { requireGit, setupRepos } from './helpers';

const workspaceFixture = path.join(__dirname, '../collection/git/fixtures/clone-workspace');
const workspaceUserData = path.join(__dirname, '../collection/git/init-user-data');

test.describe('Git panel: workspace and restart', () => {
  test('the workspace Git tab shows the workspace repository', async ({ launchElectronApp, createTmpDir }) => {
    requireGit();
    const workspacePath = await createTmpDir('git-panel-workspace');
    await fs.promises.cp(workspaceFixture, workspacePath, { recursive: true });
    runGit(workspacePath, ['init']);
    runGit(workspacePath, ['symbolic-ref', 'HEAD', 'refs/heads/main']);

    const app = await launchElectronApp({ initUserDataPath: workspaceUserData, templateVars: { workspacePath } });
    try {
      const page = await waitForReadyPage(app);
      const { gitPanel } = buildCommonLocators(page);
      await switchWorkspace(page, 'Clone WS');
      await openWorkspaceGitPanel(page);
      await expect(gitPanel.currentBranch()).toHaveText('main');
      await expect(gitPanel.fileRow('changes', 'workspace.yml')).toBeVisible();
      await expect(gitPanel.error()).toHaveCount(0);
    } finally {
      await closeElectronApp(app);
    }
  });

  test('a Git tab restored after a restart reads the repository', async ({ launchElectronApp, createTmpDir }) => {
    requireGit();
    const collection = 'Git Panel Restart';
    const repos = setupRepos(await createTmpDir('git-panel-restart'), collection);
    const userDataPath = await createTmpDir('git-panel-restart-userdata');

    const first = await launchElectronApp({ userDataPath });
    try {
      const page = await waitForReadyPage(first);
      await openCollectionFromDialog(page, first, repos.collectionA);
      await expect(buildCommonLocators(page).sidebar.collection(collection)).toBeVisible({ timeout: 30000 });
      await openGitPanel(page, collection);
      await expect(buildCommonLocators(page).gitPanel.currentBranch()).toHaveText('main');
      // let the debounced snapshot persist the open tabs before quitting
      await page.waitForTimeout(2500);
    } finally {
      await closeElectronApp(first);
    }

    const second = await launchElectronApp({ userDataPath });
    try {
      const page = await waitForReadyPage(second);
      const { gitPanel } = buildCommonLocators(page);
      await openCollection(page, collection);
      await gitPanel.tab().click();
      await expect(gitPanel.currentBranch()).toHaveText('main');
      await expect(gitPanel.error()).toHaveCount(0);
    } finally {
      await closeElectronApp(second);
    }
  });
});

import { Locator, Page, expect, test } from '../../../../playwright';

// Locators and actions for the Git panel tab (components/GitPanel)
export const buildGitPanelLocators = (page: Page) => {
  const panel = (): Locator => page.getByTestId('git-panel');
  const fileRow = (area: 'staged' | 'changes' | 'conflicts', filePath: string): Locator =>
    panel().locator(`[data-testid="git-file-row"][data-area="${area}"][data-path="${filePath}"]`);

  return {
    panel,
    fileRow,
    currentBranch: (): Locator => panel().getByTestId('git-current-branch'),
    ahead: (): Locator => panel().getByTestId('git-ahead'),
    behind: (): Locator => panel().getByTestId('git-behind'),
    error: (): Locator => panel().getByTestId('git-error'),
    operationBanner: (): Locator => panel().getByTestId('git-operation-banner'),
    noChanges: (): Locator => panel().getByTestId('git-no-changes'),
    stashItems: (): Locator => panel().getByTestId('git-stash-item'),
    diff: (): Locator => panel().getByTestId('git-diff'),
    conflict: (): Locator => panel().getByTestId('git-conflict'),
    button: (testId: string): Locator => page.getByTestId(testId),
    branchesModal: (): Locator => page.locator('.bruno-modal-card').filter({ has: page.locator('.bruno-modal-header-title', { hasText: 'Branches' }) }),
    branchRow: (name: string): Locator => page.locator(`[data-testid="git-branch-item"][data-branch="${name}"]`),
    tab: (): Locator => page.locator('.request-tab').filter({ hasText: 'Git' })
  };
};

export const openGitPanel = async (page: Page, collectionName: string) => {
  await test.step(`Open the Git panel of "${collectionName}"`, async () => {
    const collectionRow = page.locator('.collection-name').filter({
      has: page.locator('#sidebar-collection-name', { hasText: collectionName })
    });
    await collectionRow.hover();
    await collectionRow.locator('.collection-actions .icon').click();
    await page.getByTestId('collection-actions-git').click();
    await expect(buildGitPanelLocators(page).panel()).toBeVisible();
  });
};

export const openWorkspaceGitPanel = async (page: Page) => {
  await test.step('Open the workspace Git panel', async () => {
    await page.getByTestId('collections-header-actions-menu').click();
    await page.getByTestId('collections-header-actions-menu-workspace-git').click();
    await expect(buildGitPanelLocators(page).panel()).toBeVisible();
  });
};

export const stageFile = async (page: Page, filePath: string) => {
  await test.step(`Stage ${filePath}`, async () => {
    const { fileRow } = buildGitPanelLocators(page);
    const row = fileRow('changes', filePath);
    await row.hover();
    await row.getByTestId('git-stage').click();
    await expect(fileRow('staged', filePath)).toBeVisible();
  });
};

export const commitStaged = async (page: Page, message: string) => {
  await test.step(`Commit "${message}"`, async () => {
    const { panel } = buildGitPanelLocators(page);
    await panel().getByTestId('git-commit-message').fill(message);
    await panel().getByTestId('git-commit').click();
    await expect(panel().getByTestId('git-commit-message')).toHaveValue('');
  });
};

export const pushBranch = async (page: Page) => {
  await test.step('Push', async () => {
    const { panel, ahead } = buildGitPanelLocators(page);
    await panel().getByTestId('git-push').click();
    await expect(ahead()).toHaveAttribute('data-count', '0');
  });
};

export const fetchRemote = async (page: Page) => {
  await test.step('Fetch', async () => {
    await buildGitPanelLocators(page).panel().getByTestId('git-fetch').click();
  });
};

export const pullBranch = async (page: Page, mode: 'merge' | 'rebase') => {
  await test.step(`Pull (${mode})`, async () => {
    await buildGitPanelLocators(page).panel().getByTestId('git-pull').click();
    await page.getByTestId(`git-pull-menu-pull-${mode}`).click();
  });
};

export const openBranches = async (page: Page) => {
  await test.step('Open the branches dialog', async () => {
    const locators = buildGitPanelLocators(page);
    await locators.panel().getByTestId('git-branch-button').click();
    await expect(locators.branchesModal()).toBeVisible();
  });
};

export const createBranch = async (page: Page, name: string) => {
  await test.step(`Create branch ${name}`, async () => {
    await openBranches(page);
    const { branchesModal, currentBranch } = buildGitPanelLocators(page);
    await branchesModal().getByTestId('git-new-branch-name').fill(name);
    await branchesModal().getByTestId('git-create-branch-confirm').click();
    await expect(currentBranch()).toHaveText(name);
  });
};

export const requestBranchSwitch = async (page: Page, name: string) => {
  await test.step(`Switch to branch ${name}`, async () => {
    await openBranches(page);
    await buildGitPanelLocators(page).branchRow(name).getByTestId('git-branch-switch').click();
  });
};

export const stashChanges = async (page: Page, message: string) => {
  await test.step(`Stash "${message}"`, async () => {
    const { panel } = buildGitPanelLocators(page);
    await panel().getByTestId('git-stash-message').fill(message);
    await panel().getByTestId('git-stash-push').click();
  });
};

export const popLatestStash = async (page: Page) => {
  await test.step('Pop the latest stash', async () => {
    await buildGitPanelLocators(page).stashItems().first().getByTestId('git-stash-pop').click();
  });
};

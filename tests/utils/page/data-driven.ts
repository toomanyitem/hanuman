import fs from 'node:fs';
import { ElectronApplication, Locator, Page, expect, test } from '../../../playwright';

// Locators and actions for the runner's data file, iteration and run-history controls
export const buildDataDrivenLocators = (page: Page) => ({
  selectFile: (): Locator => page.getByTestId('iteration-data-select'),
  fileName: (): Locator => page.getByTestId('iteration-data-file'),
  summary: (): Locator => page.getByTestId('iteration-data-summary'),
  error: (): Locator => page.getByTestId('iteration-data-error'),
  clearFile: (): Locator => page.getByTestId('iteration-data-clear'),
  iterationCountInput: (): Locator => page.getByTestId('iteration-count-input'),
  iterationBadges: (): Locator => page.getByTestId('runner-result-iteration'),
  iterationProgress: (): Locator => page.getByTestId('runner-iteration-progress'),
  historyToggle: (): Locator => page.getByTestId('run-history-toggle'),
  historyRows: (): Locator => page.getByTestId('run-history-row'),
  historyExport: (format: 'html' | 'junit' | 'json'): Locator => page.getByTestId(`run-history-export-${format}`)
});

export const chooseIterationDataFile = async (page: Page, electronApp: ElectronApplication, filePath: string) => {
  await test.step(`Choose data file "${filePath}"`, async () => {
    await electronApp.evaluate(({ dialog }, file) => {
      const original = dialog.showOpenDialog;
      dialog.showOpenDialog = async () => {
        dialog.showOpenDialog = original;
        return { canceled: false, filePaths: [file] };
      };
    }, filePath);
    const locators = buildDataDrivenLocators(page);
    await locators.selectFile().click();
    await expect(locators.summary()).toBeVisible();
  });
};

// Exports the newest run in the history panel and returns the written file's content.
export const exportLatestRun = async (page: Page, electronApp: ElectronApplication, format: 'html' | 'junit' | 'json', filePath: string) =>
  test.step(`Export the latest run as ${format}`, async () => {
    await electronApp.evaluate(({ dialog }, file) => {
      const original = dialog.showSaveDialog;
      dialog.showSaveDialog = async () => {
        dialog.showSaveDialog = original;
        return { canceled: false, filePath: file };
      };
    }, filePath);
    const locators = buildDataDrivenLocators(page);
    if (!(await locators.historyRows().first().isVisible())) {
      await locators.historyToggle().first().click();
    }
    await locators.historyRows().first().waitFor({ state: 'visible' });
    await locators.historyRows().first().getByTestId(`run-history-export-${format}`).click();
    await expect.poll(() => fs.existsSync(filePath), { timeout: 10000 }).toBe(true);
    return fs.readFileSync(filePath, 'utf8');
  });

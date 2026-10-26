import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../playwright';
import {
  buildCommonLocators,
  buildDataDrivenLocators,
  buildRunnerLocators,
  chooseIterationDataFile,
  closeAllCollections,
  exportLatestRun,
  importCollection,
  openCollectionFromDialog,
  openRunnerTab
} from '../utils/page';
import { cliOutput, runCLIAsync } from '../utils/cli';

const COLLECTION = 'Data Driven';
const USERS_CSV = path.join(__dirname, 'fixtures', 'users.csv');
const NAMES = ['สมชาย', 'alice', 'bob'];

const waitForRequestsSelected = async (page) => {
  const locators = buildRunnerLocators(page);
  await expect(async () => {
    const match = (await locators.configCounter().innerText()).match(/(\d+) of (\d+) selected/);
    expect(Number(match?.[1])).toBeGreaterThan(0);
  }).toPass({ timeout: 30000 });
};

const decodeReportPayload = (html: string) => {
  const encoded = html.match(/<script id="report-data" type="application\/octet-stream">([^<]+)<\/script>/)?.[1];
  return JSON.parse(Buffer.from(encoded!, 'base64').toString('utf8'));
};

// The fields both reports must agree on; timings, timestamps and hostnames differ by nature.
const comparable = (results) =>
  results.map((r) => ({
    iterationIndex: r.iterationIndex,
    name: r.name,
    method: r.request.method,
    url: r.request.url,
    status: r.response.status,
    tests: r.testResults.map((t) => `${t.status}:${t.description}`)
  }));

test.describe('Data-driven runs', () => {
  test.afterEach(async ({ page }) => {
    await closeAllCollections(page);
  });

  test('a CSV with 3 rows runs 3 iterations with each row, and the app and CLI reports agree', async ({ page, electronApp, collectionFixturePath, createTmpDir }) => {
    const locators = buildCommonLocators(page);
    const runner = buildRunnerLocators(page);
    const dataDriven = buildDataDrivenLocators(page);

    await openCollectionFromDialog(page, electronApp, collectionFixturePath!);
    await expect(locators.sidebar.collection(COLLECTION)).toBeVisible({ timeout: 30000 });
    await openRunnerTab(page, COLLECTION);
    await waitForRequestsSelected(page);

    await chooseIterationDataFile(page, electronApp, USERS_CSV);
    await expect(dataDriven.fileName()).toHaveText('users.csv');
    await expect(dataDriven.summary()).toContainText('3 rows · columns: name, email');

    await test.step('run and check every iteration passed', async () => {
      await runner.runCollectionButton().click();
      await runner.runAgainButton().waitFor({ timeout: 60000 });
      await expect(runner.resultItems()).toHaveCount(3);
      await expect(dataDriven.iterationBadges()).toHaveText(['#1', '#2', '#3']);
      await expect(runner.passedTestRows()).toHaveCount(3);
      await expect(runner.failedTestRows()).toHaveCount(0);
    });

    const outputDir = await createTmpDir('data-driven-reports');
    const appJson = JSON.parse(await exportLatestRun(page, electronApp, 'json', path.join(outputDir, 'app.json')));
    const appHtml = await exportLatestRun(page, electronApp, 'html', path.join(outputDir, 'app.html'));

    await test.step('the app report carries each row', async () => {
      expect(appJson.results.map((r) => new URL(r.request.url).searchParams.get('name'))).toEqual(NAMES);
      expect(appJson.summary.totalRequests).toBe(3);
    });

    await test.step('bru run with the same file produces the same report data', async () => {
      const cliJsonPath = path.join(outputDir, 'cli.json');
      const cliHtmlPath = path.join(outputDir, 'cli.html');
      const result = await runCLIAsync(collectionFixturePath!, `run --iteration-data "${USERS_CSV}" --reporter-json "${cliJsonPath}" --reporter-html "${cliHtmlPath}"`);
      expect(result.code, cliOutput(result)).toBe(0);

      const cliJson = JSON.parse(fs.readFileSync(cliJsonPath, 'utf8'));
      expect(comparable(appJson.results)).toEqual(comparable(cliJson.results));

      const appReport = decodeReportPayload(appHtml);
      const cliReport = decodeReportPayload(fs.readFileSync(cliHtmlPath, 'utf8'));
      expect(appReport.results.map((iteration) => comparable(iteration.results))).toEqual(
        cliReport.results.map((iteration) => comparable(iteration.results))
      );
      expect(appReport.results).toHaveLength(3);
    });
  });

  test('the data file is remembered when the runner is opened again', async ({ page, electronApp, collectionFixturePath }) => {
    const locators = buildCommonLocators(page);
    const dataDriven = buildDataDrivenLocators(page);

    await openCollectionFromDialog(page, electronApp, collectionFixturePath!);
    await expect(locators.sidebar.collection(COLLECTION)).toBeVisible({ timeout: 30000 });
    await openRunnerTab(page, COLLECTION);
    await chooseIterationDataFile(page, electronApp, USERS_CSV);

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+w' : 'Control+w');
    await openRunnerTab(page, COLLECTION);
    await expect(dataDriven.fileName()).toHaveText('users.csv');
    await dataDriven.clearFile().click();
    await expect(dataDriven.fileName()).toHaveCount(0);
  });

  test('stopping during iteration 2 runs no iteration 3', async ({ page, electronApp, collectionFixturePath }) => {
    const locators = buildCommonLocators(page);
    const runner = buildRunnerLocators(page);
    const dataDriven = buildDataDrivenLocators(page);

    await openCollectionFromDialog(page, electronApp, collectionFixturePath!);
    await expect(locators.sidebar.collection(COLLECTION)).toBeVisible({ timeout: 30000 });
    await openRunnerTab(page, COLLECTION);
    await waitForRequestsSelected(page);
    await chooseIterationDataFile(page, electronApp, USERS_CSV);
    await runner.delayInput().fill('1500');

    await runner.runCollectionButton().click();
    await expect(dataDriven.iterationProgress()).toHaveText('Iteration 2/3', { timeout: 30000 });
    await runner.cancelExecutionButton().click();
    await runner.runAgainButton().waitFor({ timeout: 30000 });
    await expect(dataDriven.iterationBadges().filter({ hasText: '#3' })).toHaveCount(0);
  });

  test('an imported Postman collection that reads pm.iterationData passes with the CSV', async ({ page, electronApp, createTmpDir }) => {
    const runner = buildRunnerLocators(page);
    const importDir = await createTmpDir('postman-iteration-import');

    await importCollection(page, path.join(__dirname, 'fixtures', 'postman-iteration.json'), importDir, {
      expectedCollectionName: 'Postman Iteration Data'
    });
    await openRunnerTab(page, 'Postman Iteration Data');
    await waitForRequestsSelected(page);
    await chooseIterationDataFile(page, electronApp, USERS_CSV);

    await runner.runCollectionButton().click();
    await runner.runAgainButton().waitFor({ timeout: 60000 });
    await expect(runner.passedTestRows()).toHaveText(['row 1 of 3', 'row 2 of 3', 'row 3 of 3']);
    await expect(runner.failedTestRows()).toHaveCount(0);
  });
});

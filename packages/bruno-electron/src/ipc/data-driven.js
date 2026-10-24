const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { ipcMain, dialog, shell, app } = require('electron');
const collectionWatcher = require('../app/collection-watcher');
const { readRunnerExchange } = require('../services/runner-exchange');
const { iterationDataStore } = require('../store/iteration-data');
const { readIterationDataFile } = require('../utils/iteration-data');
const runHistory = require('../utils/run-history');

const describeDataFile = async (dataFilePath) => {
  try {
    const rows = await readIterationDataFile(dataFilePath);
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return { path: dataFilePath, rowCount: rows.length, columns };
  } catch (error) {
    return { path: dataFilePath, error: error.message };
  }
};

const createDataDrivenHandlers = ({ getWindow, getUserDataPath, getAppVersion, getOpenCollectionPaths, readExchange, store, dialog, shell }) => {
  // Only collections that are open in the app, so a stray renderer call can't read or write elsewhere.
  const assertOpenCollection = (collectionPathname) => {
    if (typeof collectionPathname !== 'string' || !path.isAbsolute(collectionPathname)) {
      throw new Error('collectionPathname must be an absolute path');
    }
    const key = runHistory.toCollectionKey(collectionPathname);
    if (!getOpenCollectionPaths().some((openPath) => runHistory.toCollectionKey(openPath) === key)) {
      throw new Error('Data-driven runs are only available for open collections');
    }
  };

  const historyDir = (collectionPathname) => runHistory.getRunHistoryDir(getUserDataPath(), collectionPathname);

  return {
    'pick-file': async ({ collectionPathname }) => {
      assertOpenCollection(collectionPathname);
      const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
        title: 'Choose a data file',
        properties: ['openFile'],
        filters: [{ name: 'CSV or JSON', extensions: ['csv', 'json'] }]
      });
      if (canceled || !filePaths?.length) {
        return null;
      }
      store.set(collectionPathname, filePaths[0]);
      return describeDataFile(filePaths[0]);
    },

    'get-file': async ({ collectionPathname }) => {
      assertOpenCollection(collectionPathname);
      const dataFilePath = store.get(collectionPathname);
      return dataFilePath ? describeDataFile(dataFilePath) : null;
    },

    'clear-file': async ({ collectionPathname }) => {
      assertOpenCollection(collectionPathname);
      store.remove(collectionPathname);
      return null;
    },

    'save-run': async ({ collectionPathname, collectionName, environmentName, startedAt, endedAt, iterationCount, dataDriven, items }) => {
      assertOpenCollection(collectionPathname);
      if (!Array.isArray(items)) {
        throw new Error('items must be an array');
      }
      const results = await runHistory.toCliResults(items, readExchange, { dataDriven: dataDriven === true });
      return runHistory.saveRun(historyDir(collectionPathname), {
        collectionName,
        environmentName,
        startedAt,
        endedAt,
        iterationCount,
        results
      });
    },

    'list-runs': async ({ collectionPathname }) => {
      assertOpenCollection(collectionPathname);
      return runHistory.listRuns(historyDir(collectionPathname));
    },

    'export-run': async ({ collectionPathname, id, format }) => {
      assertOpenCollection(collectionPathname);
      const reportFormat = runHistory.REPORT_FORMATS[format];
      if (!reportFormat) {
        throw new Error(`Unknown report format: ${format}`);
      }
      const run = await runHistory.readRun(historyDir(collectionPathname), id);
      const { canceled, filePath } = await dialog.showSaveDialog(getWindow(), {
        title: `Export ${reportFormat.label} report`,
        defaultPath: `${run.collectionName || 'run'}-report.${reportFormat.extension}`,
        filters: [{ name: reportFormat.label, extensions: [reportFormat.extension] }]
      });
      if (canceled || !filePath) {
        return null;
      }
      await fs.writeFile(filePath, runHistory.buildRunReport(run, format, { version: `Hanuman v${getAppVersion()}` }));
      return filePath;
    },

    'open-run': async ({ collectionPathname, id }) => {
      assertOpenCollection(collectionPathname);
      const run = await runHistory.readRun(historyDir(collectionPathname), id);
      const reportPath = path.join(os.tmpdir(), `hanuman-report-${id}.html`);
      await fs.writeFile(reportPath, runHistory.buildRunReport(run, 'html', { version: `Hanuman v${getAppVersion()}` }));
      const error = await shell.openPath(reportPath);
      if (error) {
        throw new Error(error);
      }
      return reportPath;
    }
  };
};

const registerDataDrivenIpc = (mainWindow) => {
  const handlers = createDataDrivenHandlers({
    getWindow: () => mainWindow,
    getUserDataPath: () => app.getPath('userData'),
    getAppVersion: () => app.getVersion(),
    getOpenCollectionPaths: () => Object.keys(collectionWatcher.watchers || {}).filter((p) => collectionWatcher.watchers[p]),
    readExchange: readRunnerExchange,
    store: iterationDataStore,
    dialog,
    shell
  });
  Object.entries(handlers).forEach(([action, handler]) => {
    ipcMain.handle(`renderer:data-driven:${action}`, (event, args) => handler(args || {}));
  });
};

module.exports = registerDataDrivenIpc;
module.exports.createDataDrivenHandlers = createDataDrivenHandlers;

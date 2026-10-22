const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, dialog, ipcMain, net, shell } = require('electron');
const { checkForUpdates } = require('../utils/update-check');
const { selectMacAsset, resolveInstallTarget, downloadAsset, extractAndVerify, startSwapHelper } = require('../utils/update-install');
const { preferencesUtil } = require('../store/preferences');

// Leave the window time to restore collections before a dialog can appear.
const STARTUP_CHECK_DELAY_MS = 10 * 1000;

// Only macOS installs in place; elsewhere the user installs from the release page.
const canInstallInApp = () => process.platform === 'darwin';

let activeDownload = null;

const offerReleasePage = async (mainWindow, reason, releaseUrl) => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Update',
    message: 'Couldn\'t install the update',
    detail: `${reason}\n\nYou can download it from the releases page instead.`,
    buttons: ['Open Release Page', 'Close'],
    defaultId: 0,
    cancelId: 1
  });
  if (response === 0) {
    await shell.openExternal(releaseUrl);
  }
};

/**
 * Downloads the release zip for this Mac, checks it, and on the user's go-ahead
 * quits so a helper script can swap the app and reopen it. Anything that stops
 * the install falls back to the release page.
 */
const installUpdate = async (mainWindow, { release, releaseUrl }) => {
  if (activeDownload) {
    return;
  }

  let bundlePath;
  let asset;
  try {
    bundlePath = resolveInstallTarget({ exePath: app.getPath('exe'), isPackaged: app.isPackaged });
    asset = selectMacAsset(release, process.arch);
  } catch (error) {
    return offerReleasePage(mainWindow, error.message, releaseUrl);
  }

  activeDownload = new AbortController();
  let lastPercent;
  const reportProgress = (fraction) => {
    const percent = fraction === null ? null : Math.floor(fraction * 100);
    if (percent === lastPercent) {
      return;
    }
    lastPercent = percent;
    // 2 shows an indeterminate bar when the size is unknown.
    mainWindow.setProgressBar(fraction === null ? 2 : fraction);
    mainWindow.webContents.send('main:update-download-progress', { version: asset.version, percent });
  };
  const endProgress = () => {
    mainWindow.setProgressBar(-1);
    mainWindow.webContents.send('main:update-download-progress', { version: asset.version, done: true });
  };

  let workDir;
  const removeWorkDir = () => workDir && fs.promises.rm(workDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  try {
    reportProgress(0);
    workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hanuman-update-'));
    const zipPath = path.join(workDir, asset.name);
    await downloadAsset({ url: asset.url, sha256: asset.sha256, destPath: zipPath, fetch: net.fetch, signal: activeDownload.signal, onProgress: reportProgress });
    const newAppPath = await extractAndVerify({ zipPath, workDir, expectedVersion: asset.version, currentVersion: app.getVersion() });
    endProgress();

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update',
      message: `Hanuman ${asset.version} is ready to install`,
      detail: 'Hanuman will quit, replace itself with the new version and open again. The current version is moved to the Trash; your collections and settings are kept.',
      buttons: ['Restart Now', 'Cancel'],
      defaultId: 0,
      cancelId: 1
    });
    if (response !== 0) {
      await removeWorkDir();
      return;
    }
    startSwapHelper({ workDir, pid: process.pid, bundlePath, newAppPath });
    app.quit();
  } catch (error) {
    endProgress();
    await removeWorkDir();
    if (error.name === 'AbortError') {
      return;
    }
    console.error('Update install failed:', error);
    await offerReleasePage(mainWindow, error.message, releaseUrl);
  } finally {
    activeDownload = null;
  }
};

const cancelUpdateDownload = () => {
  if (activeDownload) {
    activeDownload.abort();
  }
};

const showUpdateAvailable = async (mainWindow, update) => {
  const { latestVersion, releaseUrl } = update;
  const inApp = canInstallInApp();
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update available',
    message: `Hanuman ${latestVersion} is available`,
    detail: inApp
      ? `You have version ${app.getVersion()}. Hanuman can download and install the new version for you; your collections and settings are kept.`
      : `You have version ${app.getVersion()}. Download the new version from the releases page and install it over this one; your collections and settings are kept.`,
    buttons: inApp ? ['Download and Install', 'Open Release Page', 'Later'] : ['Download', 'Later'],
    defaultId: 0,
    cancelId: inApp ? 2 : 1
  });
  if (inApp && response === 0) {
    await installUpdate(mainWindow, update);
  } else if (response === (inApp ? 1 : 0)) {
    await shell.openExternal(releaseUrl);
  }
};

/**
 * Checks for a newer release and tells the user the outcome. With `quiet`, only
 * an available update is shown (used for the automatic check at startup).
 */
const checkForUpdatesAndNotify = async (mainWindow, { quiet = false } = {}) => {
  let result;
  try {
    result = await checkForUpdates({ currentVersion: app.getVersion() });
  } catch (error) {
    console.error('Update check failed:', error);
    if (!quiet) {
      await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Check for updates',
        message: 'Couldn\'t check for updates',
        detail: `${error.message}\n\nCheck your internet connection and try again.`
      });
    }
    return { status: 'error', error: error.message };
  }

  if (result.status === 'available') {
    await showUpdateAvailable(mainWindow, result);
  } else if (!quiet) {
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Check for updates',
      message: 'Hanuman is up to date',
      detail: `You have the latest version (${app.getVersion()}).`
    });
  }
  const { release, ...summary } = result;
  return summary;
};

const registerUpdatesIpc = (mainWindow) => {
  ipcMain.on('main:check-for-updates', () => checkForUpdatesAndNotify(mainWindow));
  ipcMain.handle('renderer:check-for-updates', () => checkForUpdatesAndNotify(mainWindow));
  ipcMain.handle('renderer:cancel-update-download', cancelUpdateDownload);

  mainWindow.webContents.once('did-finish-load', () => {
    if (preferencesUtil.shouldCheckForUpdatesAutomatically()) {
      setTimeout(() => checkForUpdatesAndNotify(mainWindow, { quiet: true }), STARTUP_CHECK_DELAY_MS);
    }
  });
};

module.exports = registerUpdatesIpc;
module.exports.checkForUpdatesAndNotify = checkForUpdatesAndNotify;
module.exports.installUpdate = installUpdate;

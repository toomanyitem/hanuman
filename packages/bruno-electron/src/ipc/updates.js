const { app, dialog, ipcMain, shell } = require('electron');
const { checkForUpdates } = require('../utils/update-check');
const { preferencesUtil } = require('../store/preferences');

// Leave the window time to restore collections before a dialog can appear.
const STARTUP_CHECK_DELAY_MS = 10 * 1000;

const showUpdateAvailable = async (mainWindow, { latestVersion, releaseUrl }) => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update available',
    message: `Hanuman ${latestVersion} is available`,
    detail: `You have version ${app.getVersion()}. Download the new version from the releases page and install it over this one; your collections and settings are kept.`,
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1
  });
  if (response === 0) {
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
  return result;
};

const registerUpdatesIpc = (mainWindow) => {
  ipcMain.on('main:check-for-updates', () => checkForUpdatesAndNotify(mainWindow));
  ipcMain.handle('renderer:check-for-updates', () => checkForUpdatesAndNotify(mainWindow));

  mainWindow.webContents.once('did-finish-load', () => {
    if (preferencesUtil.shouldCheckForUpdatesAutomatically()) {
      setTimeout(() => checkForUpdatesAndNotify(mainWindow, { quiet: true }), STARTUP_CHECK_DELAY_MS);
    }
  });
};

module.exports = registerUpdatesIpc;
module.exports.checkForUpdatesAndNotify = checkForUpdatesAndNotify;

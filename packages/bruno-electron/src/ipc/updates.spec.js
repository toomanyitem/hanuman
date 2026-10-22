jest.mock('electron', () => ({
  app: { getPath: jest.fn(), getVersion: () => '0.2.0', isPackaged: true, quit: jest.fn() },
  dialog: { showMessageBox: jest.fn() },
  ipcMain: { on: jest.fn(), handle: jest.fn() },
  net: { fetch: jest.fn() },
  shell: { openExternal: jest.fn() }
}));
jest.mock('../store/preferences', () => ({ preferencesUtil: {} }));
jest.mock('original-fs', () => jest.requireActual('fs'), { virtual: true });

const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, dialog, net, shell } = require('electron');
const { installUpdate } = require('./updates');

const mainWindow = { setProgressBar: jest.fn(), webContents: { send: jest.fn() } };
const releaseUrl = 'https://github.com/toomanyitem/hanuman/releases/tag/v0.3.0';
const release = {
  tag_name: 'v0.3.0',
  assets: [{
    name: `hanuman_0.3.0_${process.arch}_mac.zip`,
    browser_download_url: 'https://example.test/zip',
    digest: `sha256:${'a'.repeat(64)}`
  }]
};

// The updater only runs on macOS; these use POSIX paths and permissions.
const describeOnPosix = process.platform === 'win32' ? describe.skip : describe;
const runsAsRoot = Boolean(process.getuid && process.getuid() === 0);

describeOnPosix('installUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    dialog.showMessageBox.mockResolvedValue({ response: 0 });
  });

  (runsAsRoot ? it.skip : it)('falls back to the release page when the app folder is not writable', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hanuman-updates-spec-'));
    const exe = path.join(dir, 'Hanuman.app', 'Contents', 'MacOS', 'Hanuman');
    fs.mkdirSync(path.dirname(exe), { recursive: true });
    fs.chmodSync(dir, 0o555);
    app.getPath.mockReturnValue(exe);

    try {
      await installUpdate(mainWindow, { release, releaseUrl });
    } finally {
      fs.chmodSync(dir, 0o755);
      fs.rmSync(dir, { recursive: true, force: true });
    }

    expect(dialog.showMessageBox.mock.calls[0][1].detail).toContain('can\'t write to');
    expect(shell.openExternal).toHaveBeenCalledWith(releaseUrl);
    expect(net.fetch).not.toHaveBeenCalled();
    expect(app.quit).not.toHaveBeenCalled();
  });

  it('falls back to the release page when the download does not match the digest', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hanuman-updates-spec-'));
    const exe = path.join(dir, 'Hanuman.app', 'Contents', 'MacOS', 'Hanuman');
    fs.mkdirSync(path.dirname(exe), { recursive: true });
    app.getPath.mockReturnValue(exe);
    net.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => '3' },
      body: (async function* () {
        yield Buffer.from('bad');
      })()
    });

    await installUpdate(mainWindow, { release, releaseUrl });
    fs.rmSync(dir, { recursive: true, force: true });

    expect(dialog.showMessageBox.mock.calls[0][1].detail).toContain('doesn\'t match the release');
    expect(shell.openExternal).toHaveBeenCalledWith(releaseUrl);
    expect(app.quit).not.toHaveBeenCalled();
    expect(mainWindow.webContents.send).toHaveBeenLastCalledWith('main:update-download-progress', { version: '0.3.0', done: true });
  });
});

describe('installUpdate cancelled after the download', () => {
  it('does not offer to restart when Cancel is pressed while the download is being checked', async () => {
    jest.clearAllMocks();
    dialog.showMessageBox.mockResolvedValue({ response: 0 });
    let installer;
    const startSwapHelper = jest.fn();
    jest.isolateModules(() => {
      jest.doMock('../utils/update-install', () => ({
        ...jest.requireActual('../utils/update-install'),
        resolveInstallTarget: () => '/Applications/Hanuman.app',
        downloadAsset: jest.fn().mockResolvedValue(),
        extractAndVerify: jest.fn(async () => {
          installer.cancelUpdateDownload();
          return '/tmp/Hanuman.app';
        }),
        startSwapHelper
      }));
      installer = require('./updates');
    });

    await installer.installUpdate(mainWindow, { release, releaseUrl });

    expect(dialog.showMessageBox).not.toHaveBeenCalled();
    expect(app.quit).not.toHaveBeenCalled();
    expect(startSwapHelper).not.toHaveBeenCalled();
  });
});

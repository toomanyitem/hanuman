const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }));

const mockStoreData = {};
jest.mock('electron-store', () =>
  jest.fn().mockImplementation(() => ({
    get: (key, defaultValue) => (key in mockStoreData ? mockStoreData[key] : defaultValue),
    set: (key, value) => {
      mockStoreData[key] = value;
    }
  }))
);
jest.mock('../utils/encryption', () => ({
  encryptString: (value) => `enc:${Buffer.from(value).toString('base64')}`,
  decryptString: (value) => Buffer.from(value.slice(4), 'base64').toString()
}));

const mockWatchers = {};
jest.mock('../app/collection-watcher', () => ({ watchers: mockWatchers }));
jest.mock('../store/last-opened-workspaces', () => jest.fn().mockImplementation(() => ({ getAll: () => [] })));

const { ipcMain } = require('electron');
const registerGitPanelIpc = require('./git-panel');
const { handleGitPanel, GIT_PANEL_ACTIONS } = require('./git-panel');

describe('git-panel IPC', () => {
  test('registers one renderer:git-panel channel per action', () => {
    registerGitPanelIpc();
    const channels = ipcMain.handle.mock.calls.map(([channel]) => channel);
    expect(channels).toEqual(GIT_PANEL_ACTIONS.map((action) => `renderer:git-panel:${action}`));
    expect(channels).toEqual(expect.arrayContaining(['renderer:git-panel:status', 'renderer:git-panel:resolve-conflict', 'renderer:git-panel:set-credential']));
  });

  test('rejects relative or missing target paths and unknown actions', async () => {
    await expect(handleGitPanel('status', { targetPath: 'relative/dir' })).rejects.toThrow('targetPath must be an absolute path');
    await expect(handleGitPanel('status', undefined)).rejects.toThrow('targetPath must be an absolute path');
    await expect(handleGitPanel('nope', {})).rejects.toThrow('Unknown Git action: nope');
  });

  test('runs only for open collections or workspaces', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-panel-ipc-'));
    await expect(handleGitPanel('status', { targetPath: dir })).rejects.toThrow('only available for open collections and workspaces');

    mockWatchers[dir] = {};
    await expect(handleGitPanel('status', { targetPath: dir })).resolves.toEqual({ isRepo: false });
    delete mockWatchers[dir];
  });

  test('credentials are stored encrypted and never returned', async () => {
    const list = await handleGitPanel('set-credential', { host: ' GitHub.com ', username: 'bob', token: 'ghp_secret' });
    expect(list).toEqual([{ host: 'github.com', username: 'bob' }]);
    expect(JSON.stringify(mockStoreData)).not.toContain('ghp_secret');
    expect(JSON.stringify(await handleGitPanel('credentials'))).not.toContain('ghp_secret');

    await expect(handleGitPanel('set-credential', { host: 'https://x', username: 'a', token: 'b' })).rejects.toThrow('Host must look like');
    await expect(handleGitPanel('set-credential', { host: 'x.com', username: '', token: 'b' })).rejects.toThrow('Username is required');
    await expect(handleGitPanel('remove-credential', { host: 'github.com' })).resolves.toEqual([]);
  });
});

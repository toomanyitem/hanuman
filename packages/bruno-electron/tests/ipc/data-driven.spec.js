const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() }, dialog: {}, shell: {}, app: {} }));
jest.mock('electron-store', () => jest.fn().mockImplementation(() => ({ get: jest.fn(), set: jest.fn() })));
jest.mock('../../src/app/collection-watcher', () => ({ watchers: {} }));
jest.mock('../../src/services/runner-exchange', () => ({ readRunnerExchange: jest.fn() }));

const { createDataDrivenHandlers } = require('../../src/ipc/data-driven');

describe('data-driven IPC', () => {
  let dir;
  let collectionPath;
  let handlers;
  let remembered;
  let dialog;

  beforeEach(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hanuman-data-driven-')));
    collectionPath = path.join(dir, 'collection');
    fs.mkdirSync(collectionPath);
    fs.writeFileSync(path.join(dir, 'users.csv'), 'name,email\na,a@x\nb,b@x\n');
    remembered = {};
    dialog = {
      showOpenDialog: jest.fn(async () => ({ canceled: false, filePaths: [path.join(dir, 'users.csv')] })),
      showSaveDialog: jest.fn(async () => ({ canceled: false, filePath: path.join(dir, 'report.json') }))
    };
    handlers = createDataDrivenHandlers({
      getWindow: () => null,
      getUserDataPath: () => path.join(dir, 'userData'),
      getAppVersion: () => '0.0.0',
      getOpenCollectionPaths: () => [collectionPath],
      readExchange: async () => ({ requestSent: { method: 'GET', url: 'http://x/' }, responseReceived: { status: 200, data: {} } }),
      store: {
        get: (p) => remembered[p] || null,
        set: (p, v) => { remembered[p] = v; },
        remove: (p) => { delete remembered[p]; }
      },
      dialog,
      shell: { openPath: jest.fn(async () => '') }
    });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects collections that are not open', async () => {
    await expect(handlers['list-runs']({ collectionPathname: dir })).rejects.toThrow(/only available for open collections/);
    await expect(handlers['get-file']({ collectionPathname: 'relative' })).rejects.toThrow(/absolute/);
  });

  it('picks, remembers, describes and clears the data file', async () => {
    const picked = await handlers['pick-file']({ collectionPathname: collectionPath });
    expect(picked).toEqual({ path: path.join(dir, 'users.csv'), rowCount: 2, columns: ['name', 'email'] });
    expect(await handlers['get-file']({ collectionPathname: collectionPath })).toEqual(picked);

    fs.rmSync(path.join(dir, 'users.csv'));
    expect((await handlers['get-file']({ collectionPathname: collectionPath })).error).toMatch(/not found/);

    await handlers['clear-file']({ collectionPathname: collectionPath });
    expect(await handlers['get-file']({ collectionPathname: collectionPath })).toBeNull();
  });

  it('saves, lists and exports a run', async () => {
    const { id } = await handlers['save-run']({
      collectionPathname: collectionPath,
      collectionName: 'c',
      endedAt: 'e',
      iterationCount: 1,
      items: [{ requestUid: 'r1', name: 'a', relativePath: 'a.bru', status: 'completed', testResults: [] }]
    });
    const runs = await handlers['list-runs']({ collectionPathname: collectionPath });
    expect(runs.map((r) => r.id)).toEqual([id]);
    expect(runs[0].summary.totalRequests).toBe(1);

    const saved = await handlers['export-run']({ collectionPathname: collectionPath, id, format: 'json' });
    expect(JSON.parse(fs.readFileSync(saved, 'utf8')).results[0].name).toBe('a');
    await expect(handlers['export-run']({ collectionPathname: collectionPath, id, format: 'pdf' })).rejects.toThrow(/Unknown report format/);
  });
});

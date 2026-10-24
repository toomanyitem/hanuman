const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadIterationPlan } = require('../src/utils/iteration-data');

describe('loadIterationPlan', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hanuman-iteration-data-'));
    fs.writeFileSync(path.join(dir, 'users.csv'), 'name\na\nb\nc\n');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('is one empty iteration without options', async () => {
    await expect(loadIterationPlan(undefined)).resolves.toEqual({ rows: [], count: 1 });
    await expect(loadIterationPlan({ iterationCount: 3 })).resolves.toEqual({ rows: [], count: 3 });
  });

  it('reads the rows and defaults the count to the row count', async () => {
    const plan = await loadIterationPlan({ dataFilePath: path.join(dir, 'users.csv') }, path.join(dir, 'users.csv'));
    expect(plan).toEqual({ rows: [{ name: 'a' }, { name: 'b' }, { name: 'c' }], count: 3 });
    expect((await loadIterationPlan({ dataFilePath: path.join(dir, 'users.csv'), iterationCount: 5 }, path.join(dir, 'users.csv'))).count).toBe(5);
  });

  it('rejects missing files, directories, relative paths and other extensions', async () => {
    const load = (dataFilePath) => loadIterationPlan({ dataFilePath }, dataFilePath);
    await expect(load(path.join(dir, 'missing.csv'))).rejects.toThrow(/not found/);
    await expect(load(dir)).rejects.toThrow(/not a file/);
    await expect(load('users.csv')).rejects.toThrow(/absolute/);
    fs.writeFileSync(path.join(dir, 'users.txt'), 'name\na\n');
    await expect(load(path.join(dir, 'users.txt'))).rejects.toThrow(/\.csv or \.json/);
  });

  it('reads only the data file chosen for the collection', async () => {
    await expect(loadIterationPlan({ dataFilePath: path.join(dir, 'users.csv') }, null)).rejects.toThrow(/Choose the data file/);
    await expect(loadIterationPlan({ dataFilePath: path.join(dir, 'users.csv') }, path.join(dir, 'other.csv'))).rejects.toThrow(/Choose the data file/);
  });

  it('rejects a bad count', async () => {
    await expect(loadIterationPlan({ iterationCount: 0 })).rejects.toThrow(/positive whole number/);
  });
});

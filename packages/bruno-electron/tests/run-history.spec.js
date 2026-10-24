const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const xmlbuilder = require('xmlbuilder');
const { generateOfflineHtmlReport, buildJUnitReport, groupResultsByIteration, getRunnerSummary } = require('@usebruno/common/runner');
const runHistory = require('../src/utils/run-history');

const exchange = (overrides = {}) => ({
  requestSent: { method: 'GET', url: 'http://localhost/users?n=a', headers: { accept: '*/*' }, data: null },
  responseReceived: { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }, data: { n: 'a' }, size: 9, responseTime: 12, duration: 12, ...overrides }
});

const item = (overrides = {}) => ({
  requestUid: 'r1',
  iterationIndex: 0,
  name: 'Get users',
  relativePath: 'users/Get users.bru',
  status: 'completed',
  testResults: [{ description: 'ok', status: 'pass' }],
  assertionResults: [],
  ...overrides
});

describe('run-history', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hanuman-run-history-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('builds the same result shape as bru run', async () => {
    const [result] = await runHistory.toCliResults([item()], async () => exchange(), { dataDriven: false });
    expect(result).toEqual({
      test: { filename: 'users/Get users.bru' },
      request: { method: 'GET', url: 'http://localhost/users?n=a', headers: { accept: '*/*' }, data: null },
      response: {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { n: 'a' },
        url: 'http://localhost/users?n=a',
        responseTime: 12,
        duration: 12,
        size: 9
      },
      error: null,
      status: 'pass',
      assertionResults: [],
      testResults: [{ description: 'ok', status: 'pass' }],
      preRequestTestResults: [],
      postResponseTestResults: [],
      runDuration: 0.012,
      suitename: 'users/Get users',
      name: 'Get users',
      path: 'users/Get users.bru'
    });
  });

  it('tags data-driven results with their iteration and maps skips and errors', async () => {
    const results = await runHistory.toCliResults(
      [item({ iterationIndex: 1 }), item({ requestUid: null, status: 'skipped' }), item({ requestUid: 'r3', status: 'error', error: 'ECONNREFUSED' })],
      async (uid) => (uid === 'r3' ? { requestSent: {}, responseReceived: null } : exchange()),
      { dataDriven: true }
    );
    expect(results.map((r) => [r.iterationIndex, r.status, r.skipped || false])).toEqual([
      [1, 'pass', false],
      [0, 'skipped', true],
      [0, 'error', false]
    ]);
    expect(results[2].response.status).toBe('error');
    expect(results[2].error).toBe('ECONNREFUSED');
  });

  it('caps bodies and prunes to 50 runs', async () => {
    const [big] = await runHistory.toCliResults([item()], async () => exchange({ size: 5 * 1024 * 1024 }), { dataDriven: false });
    expect(big.response.data).toBe('[body not stored: 5242880 bytes]');

    const ids = [];
    for (let i = 0; i < 52; i++) {
      ids.push((await runHistory.saveRun(dir, { collectionName: 'c', endedAt: 'e', iterationCount: 1, results: [big] })).id);
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    const runs = await runHistory.listRuns(dir);
    expect(runs).toHaveLength(50);
    expect(runs[0].id).toBe(ids[51]);
    expect(runs.map((r) => r.id)).not.toContain(ids[0]);
    expect(runs.map((r) => r.id)).not.toContain(ids[1]);
    expect(fs.readdirSync(dir)).toHaveLength(100);
  });

  it('redacts credential headers before they are stored', async () => {
    const [result] = await runHistory.toCliResults(
      [item()],
      async () => ({
        requestSent: { method: 'GET', url: 'http://x/', headers: { 'Authorization': 'Bearer abc', 'X-Api-Key': 'k', 'x-auth-token': 't', 'accept': '*/*' } },
        responseReceived: { status: 200, headers: { 'Set-Cookie': 'sid=1', 'content-type': 'text/plain' }, data: 'ok', size: 2 }
      }),
      { dataDriven: false }
    );
    expect(result.request.headers).toEqual({ 'Authorization': '[redacted]', 'X-Api-Key': '[redacted]', 'x-auth-token': '[redacted]', 'accept': '*/*' });
    expect(result.response.headers).toEqual({ 'Set-Cookie': '[redacted]', 'content-type': 'text/plain' });
  });

  it('masks secret environment values in URLs and bodies', async () => {
    const results = await runHistory.toCliResults(
      [item()],
      async () => ({
        requestSent: { method: 'POST', url: 'http://x/?key=s3cr3t', headers: {}, data: { password: 'p"w' } },
        responseReceived: { status: 200, headers: {}, data: 'token s3cr3t', size: 12 }
      }),
      { dataDriven: false }
    );
    const { id } = await runHistory.saveRun(dir, { collectionName: 'c', endedAt: 'e', iterationCount: 1, results, secretValues: ['s3cr3t', 'p"w'] });
    const stored = fs.readFileSync(path.join(dir, `${id}.json`), 'utf8');
    expect(stored).not.toContain('s3cr3t');
    const run = await runHistory.readRun(dir, id);
    expect(run.results[0].request.url).toBe('http://x/?key=[redacted]');
    expect(run.results[0].request.data).toEqual({ password: '[redacted]' });
  });

  it('clears the history of a collection', async () => {
    await runHistory.saveRun(dir, { collectionName: 'c', endedAt: 'e', iterationCount: 1, results: [] });
    await runHistory.clearRuns(dir);
    expect(await runHistory.listRuns(dir)).toEqual([]);
  });

  it('rejects run ids that are not ours', async () => {
    await expect(runHistory.readRun(dir, '../x')).rejects.toThrow(/Invalid run id/);
  });

  it('exports with the same builders as bru run', async () => {
    const results = await runHistory.toCliResults([item(), item({ iterationIndex: 1 })], async () => exchange(), { dataDriven: true });
    const { id } = await runHistory.saveRun(dir, { collectionName: 'c', environmentName: 'local', endedAt: '2026-10-24T00:00:00.000Z', iterationCount: 2, results });
    const run = await runHistory.readRun(dir, id);

    const summary = getRunnerSummary(results);
    expect(runHistory.buildRunReport(run, 'html', { version: 'v' })).toBe(
      generateOfflineHtmlReport({ runnerResults: groupResultsByIteration(results, summary), version: 'v', environment: 'local', runCompletionTime: '2026-10-24T00:00:00.000Z' })
    );
    const junit = runHistory.buildRunReport(run, 'junit', { version: 'v' });
    expect(junit.replace(/timestamp="[^"]+"/g, '')).toBe(
      xmlbuilder.create(buildJUnitReport(results, { hostname: os.hostname() })).end({ pretty: true }).replace(/timestamp="[^"]+"/g, '')
    );
    expect(junit).toContain('Get users (iteration 2)');
    expect(JSON.parse(runHistory.buildRunReport(run, 'json', { version: 'v' }))).toEqual({ summary, results });
  });

  it('keys a collection by its resolved path', () => {
    expect(runHistory.getRunHistoryDir('/u', '/a/b/../c')).toBe(runHistory.getRunHistoryDir('/u', '/a/c'));
  });
});

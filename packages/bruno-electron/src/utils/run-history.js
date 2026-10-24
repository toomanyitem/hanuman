const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const xmlbuilder = require('xmlbuilder');
const {
  getRunnerSummary,
  generateHtmlReport,
  buildJUnitReport,
  groupResultsByIteration
} = require('@usebruno/common/runner');

// Run history stays on this machine (userData), never in the collection.
const MAX_RUNS_PER_COLLECTION = 50;
const MAX_STORED_BODY_BYTES = 1024 * 1024;
const RUN_ID_PATTERN = /^\d{13}-[0-9a-f]{8}$/;

// Windows paths are case-insensitive, so one collection must map to one key there.
const toCollectionKey = (collectionPathname) => {
  const resolved = path.resolve(collectionPathname);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

const getRunHistoryDir = (userDataPath, collectionPathname) =>
  path.join(userDataPath, 'run-history', crypto.createHash('sha1').update(toCollectionKey(collectionPathname)).digest('hex'));

const stripExtension = (filename = '') => filename.replace(/\.[^/.]+$/, '');

const getBodySize = (response) => {
  if (Number.isFinite(response.size)) return response.size;
  return response.dataBuffer ? Buffer.byteLength(response.dataBuffer, 'base64') : 0;
};

const getStoredBody = (response) => {
  const size = getBodySize(response);
  return size > MAX_STORED_BODY_BYTES ? `[body not stored: ${size} bytes]` : response.data ?? null;
};

// Same shape as a `bru run` result (bruno-cli runSingleRequest + commands/run.js), so the
// shared report builders give the app and the CLI the same report.
const toCliResult = (item, exchange, { dataDriven }) => {
  const sent = exchange?.requestSent || {};
  const received = exchange?.responseReceived || {};
  const skipped = item.status === 'skipped';
  const responseTime = received.responseTime ?? received.duration ?? 0;

  return {
    test: { filename: item.relativePath },
    request: {
      method: sent.method ?? null,
      url: sent.url ?? null,
      headers: sent.headers ?? null,
      data: sent.data ?? null
    },
    response: skipped
      ? { status: 'skipped', statusText: null, data: null, responseTime: 0 }
      : {
          status: received.status ?? (item.status === 'error' ? 'error' : null),
          statusText: received.statusText ?? null,
          headers: received.headers ?? null,
          data: getStoredBody(received),
          url: received.url ?? sent.url ?? null,
          responseTime,
          duration: responseTime,
          size: getBodySize(received)
        },
    error: item.error ?? null,
    status: skipped ? 'skipped' : item.status === 'error' ? 'error' : 'pass',
    ...(skipped && { skipped: true }),
    assertionResults: item.assertionResults || [],
    testResults: item.testResults || [],
    preRequestTestResults: item.preRequestTestResults || [],
    postResponseTestResults: item.postResponseTestResults || [],
    runDuration: responseTime / 1000,
    suitename: stripExtension(item.relativePath),
    name: item.name,
    path: item.relativePath,
    ...(dataDriven && { iterationIndex: item.iterationIndex ?? 0 })
  };
};

const toCliResults = async (items, readExchange, { dataDriven }) => {
  const results = [];
  for (const item of items) {
    const exchange = item.requestUid ? await readExchange(item.requestUid) : null;
    results.push(toCliResult(item, exchange, { dataDriven }));
  }
  return results;
};

const assertRunId = (id) => {
  if (typeof id !== 'string' || !RUN_ID_PATTERN.test(id)) {
    throw new Error('Invalid run id');
  }
};

const runFile = (dir, id) => path.join(dir, `${id}.json`);
const metaFile = (dir, id) => path.join(dir, `${id}.meta.json`);

const listRunIds = async (dir) => {
  let files;
  try {
    files = await fs.readdir(dir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return files
    .filter((file) => file.endsWith('.meta.json'))
    .map((file) => file.slice(0, -'.meta.json'.length))
    .filter((id) => RUN_ID_PATTERN.test(id))
    .sort()
    .reverse();
};

const pruneRuns = async (dir, keep = MAX_RUNS_PER_COLLECTION) => {
  const stale = (await listRunIds(dir)).slice(keep);
  const removeOptions = { force: true, maxRetries: 3, retryDelay: 100 };
  await Promise.all(stale.flatMap((id) => [fs.rm(runFile(dir, id), removeOptions), fs.rm(metaFile(dir, id), removeOptions)]));
};

const saveRun = async (dir, { collectionName, environmentName = null, startedAt, endedAt, iterationCount, results }) => {
  const id = `${String(Date.now()).padStart(13, '0')}-${crypto.randomBytes(4).toString('hex')}`;
  const summary = getRunnerSummary(results);
  const meta = { id, collectionName, environmentName, startedAt, endedAt, iterationCount, summary };

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(runFile(dir, id), JSON.stringify({ ...meta, results }));
  await fs.writeFile(metaFile(dir, id), JSON.stringify(meta));
  await pruneRuns(dir);
  return { id };
};

const listRuns = async (dir) => {
  const runs = [];
  for (const id of await listRunIds(dir)) {
    try {
      runs.push(JSON.parse(await fs.readFile(metaFile(dir, id), 'utf8')));
    } catch (error) {
      console.error(`[run-history] skipping unreadable run ${id}:`, error.message);
    }
  }
  return runs;
};

const readRun = async (dir, id) => {
  assertRunId(id);
  return JSON.parse(await fs.readFile(runFile(dir, id), 'utf8'));
};

const REPORT_FORMATS = {
  html: { extension: 'html', label: 'HTML' },
  junit: { extension: 'xml', label: 'JUnit XML' },
  json: { extension: 'json', label: 'JSON' }
};

const buildRunReport = (run, format, { version }) => {
  const summary = run.summary || getRunnerSummary(run.results);
  if (format === 'json') {
    return JSON.stringify({ summary, results: run.results }, null, 2);
  }
  if (format === 'junit') {
    return xmlbuilder.create(buildJUnitReport(run.results, { hostname: os.hostname() })).end({ pretty: true });
  }
  if (format === 'html') {
    return generateHtmlReport({
      runnerResults: groupResultsByIteration(run.results, summary),
      version,
      environment: run.environmentName ?? null,
      runCompletionTime: run.endedAt
    });
  }
  throw new Error(`Unknown report format: ${format}`);
};

module.exports = {
  MAX_RUNS_PER_COLLECTION,
  MAX_STORED_BODY_BYTES,
  REPORT_FORMATS,
  toCollectionKey,
  getRunHistoryDir,
  toCliResults,
  saveRun,
  listRuns,
  readRun,
  pruneRuns,
  buildRunReport
};

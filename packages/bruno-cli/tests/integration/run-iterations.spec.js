const { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { runCli } = require('./helpers/run-cli');

jest.setTimeout(30000);

const write = (filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
};

const request = ({ name, seq, port, script = '', tests = '' }) => `meta {
  name: ${name}
  type: http
  seq: ${seq}
}

get {
  url: http://127.0.0.1:${port}/echo?n={{name}}&req=${name}
  body: none
  auth: none
}
${script ? `\nscript:pre-request {\n  ${script}\n}\n` : ''}${tests ? `\ntests {\n  ${tests}\n}\n` : ''}`;

describe('CLI run — data-driven iterations', () => {
  let server;
  let port;
  let tmpDir;
  let received;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
      received.push(query);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(query));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bru-cli-iterations-'));
    received = [];
    write(path.join(tmpDir, 'bruno.json'), JSON.stringify({ version: '1', name: 'iterations', type: 'collection' }));
    write(path.join(tmpDir, 'users.csv'), 'name\na\nb\nc\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const run = (args) => runCli(['run', '--noproxy', '--reporter-json', 'report.json', ...args], tmpDir);
  const readReport = () => JSON.parse(fs.readFileSync(path.join(tmpDir, 'report.json'), 'utf8'));

  it('runs once per CSV row with the row values as variables and in bru.runner', async () => {
    write(
      path.join(tmpDir, 'first.bru'),
      request({
        name: 'first',
        seq: 1,
        port,
        tests: `test('row', () => {
    expect(res.body.n).to.equal(bru.runner.iterationData.get('name'));
    expect(bru.runner.iterationCount).to.equal(3);
  });`
      })
    );

    const { code, stdout } = await run(['--iteration-data', 'users.csv']);
    expect(code).toBe(0);
    expect(received.map((q) => q.n)).toEqual(['a', 'b', 'c']);
    expect(stdout).toContain('Iteration 3/3');

    const report = readReport();
    expect(report.results.map((r) => r.iterationIndex)).toEqual([0, 1, 2]);
    expect(report.results.every((r) => r.testResults[0].status === 'pass')).toBe(true);
    expect(report.summary.totalRequests).toBe(3);
  });

  it('reuses the last row when --iteration-count is larger than the file', async () => {
    write(path.join(tmpDir, 'first.bru'), request({ name: 'first', seq: 1, port }));

    const { code } = await run(['--iteration-data', 'users.csv', '--iteration-count', '5']);
    expect(code).toBe(0);
    expect(received.map((q) => q.n)).toEqual(['a', 'b', 'c', 'c', 'c']);
  });

  it('repeats the run with --iteration-count and no data file', async () => {
    write(path.join(tmpDir, 'first.bru'), request({ name: 'first', seq: 1, port }));

    const { code } = await run(['--iteration-count', '2']);
    expect(code).toBe(0);
    expect(received).toHaveLength(2);
  });

  it('ends only the current iteration on setNextRequest(null)', async () => {
    write(path.join(tmpDir, 'first.bru'), request({ name: 'first', seq: 1, port, script: 'bru.runner.setNextRequest(null);' }));
    write(path.join(tmpDir, 'second.bru'), request({ name: 'second', seq: 2, port }));

    const { code } = await run(['--iteration-data', 'users.csv']);
    expect(code).toBe(0);
    expect(received.map((q) => `${q.req}:${q.n}`)).toEqual(['first:a', 'first:b', 'first:c']);
  });

  it('stops every iteration on --bail', async () => {
    write(path.join(tmpDir, 'first.bru'), request({ name: 'first', seq: 1, port, tests: `test('fails', () => expect(1).to.equal(2));` }));
    write(path.join(tmpDir, 'second.bru'), request({ name: 'second', seq: 2, port }));

    const { code } = await run(['--iteration-data', 'users.csv', '--bail']);
    expect(code).toBe(1);
    expect(received).toHaveLength(1);
    const report = readReport();
    expect(report.results.map((r) => [r.name, r.iterationIndex, r.skipped || false])).toEqual([
      ['first', 0, false],
      ['second', 0, true]
    ]);
  });

  it('keeps the report shape of a run without iteration flags', async () => {
    write(path.join(tmpDir, 'first.bru'), request({ name: 'first', seq: 1, port }));

    const { code } = await run([]);
    expect(code).toBe(0);
    const report = readReport();
    expect(Object.keys(report)).toEqual(['summary', 'results']);
    expect(report.results[0]).not.toHaveProperty('iterationIndex');
  });

  it('rejects a data file that cannot be parsed', async () => {
    write(path.join(tmpDir, 'first.bru'), request({ name: 'first', seq: 1, port }));
    write(path.join(tmpDir, 'bad.json'), '{"name":"a"}');

    const { code, stderr } = await run(['--iteration-data', 'bad.json']);
    expect(code).toBe(10);
    expect(stderr).toContain('must be an array of objects');
    expect(received).toHaveLength(0);
  });

  it('rejects a missing data file and a bad count', async () => {
    write(path.join(tmpDir, 'first.bru'), request({ name: 'first', seq: 1, port }));

    expect((await run(['--iteration-data', 'missing.csv'])).code).toBe(5);
    expect((await run(['--iteration-count', '0'])).code).toBe(255);
    expect(received).toHaveLength(0);
  });
});

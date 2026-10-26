const { describe, it, expect, beforeAll } = require('@jest/globals');
const ScriptRuntime = require('../src/runtime/script-runtime');
const TestRuntime = require('../src/runtime/test-runtime');
const AssertRuntime = require('../src/runtime/assert-runtime');
const Bru = require('../src/bru');
const { loader: quickJsLoader } = require('../src/sandbox/quickjs');

// QuickJS needs a console sink; it throws "'console' is not defined" without one.
const noopLog = () => {};

const readIterationScript = `
  bru.setVar('out', [
    bru.runner.iterationData.get('name'),
    bru.runner.iterationData.has('x'),
    bru.runner.iteration,
    bru.runner.iterationCount,
    bru.runner.iterationData.toObject().name
  ].join('|'));
`;

describe('iteration data', () => {
  beforeAll(async () => {
    await quickJsLoader();
  });

  describe.each(['nodevm', 'quickjs'])('bru.runner in %s', (runtimeName) => {
    it('reads the current row, index and count', async () => {
      const runtime = new ScriptRuntime({ runtime: runtimeName });
      const request = { url: 'http://localhost/', iteration: { index: 1, count: 3, data: { name: 'b' } } };
      const result = await runtime.runRequestScript(readIterationScript, request, {}, {}, '.', noopLog, {});
      expect(result.runtimeVariables.out).toBe('b|false|1|3|b');
    });

    it('is empty outside a data-driven run', async () => {
      const runtime = new ScriptRuntime({ runtime: runtimeName });
      const result = await runtime.runRequestScript(readIterationScript, { url: 'http://localhost/' }, {}, {}, '.', noopLog, {});
      expect(result.runtimeVariables.out).toBe('|false|0|1|');
    });

    it('is available in tests', async () => {
      const runtime = new TestRuntime({ runtime: runtimeName });
      const request = { url: 'http://localhost/', iteration: { index: 0, count: 1, data: { id: 7 } } };
      const result = await runtime.runTests(
        `test('row', () => expect(bru.runner.iterationData.get('id')).to.equal(7));`,
        request,
        { status: 200, data: {} },
        {},
        {},
        '.',
        noopLog,
        {}
      );
      expect(result.results.map((r) => r.status)).toEqual(['pass']);
    });
  });

  it('toObject returns a copy', () => {
    const data = { a: 1 };
    const bru = new Bru({ runtime: 'nodevm', iteration: { index: 0, count: 1, data } });
    bru.runner.iterationData.toObject().a = 2;
    expect(data.a).toBe(1);
  });

  it('interpolates row values above environment and below folder variables', () => {
    const bru = new Bru({
      runtime: 'nodevm',
      envVariables: { user: 'env', id: 'env' },
      folderVariables: { id: 'folder' },
      iteration: { index: 0, count: 1, data: { user: 'row', id: 'row' } }
    });
    expect(bru.interpolate('{{user}}/{{id}}')).toBe('row/folder');
  });

  it('interpolates row values in assertions', () => {
    const runtime = new AssertRuntime({ runtime: 'nodevm' });
    const request = { url: 'http://localhost/', iteration: { index: 0, count: 1, data: { expected: 201 } } };
    const results = runtime.runAssertions(
      [{ name: 'res.status', value: 'eq {{expected}}', enabled: true }],
      request,
      { status: 201, data: {} },
      { expected: 500 },
      {},
      {}
    );
    expect(results.map((r) => r.status)).toEqual(['pass']);
  });
});

import { describe, it, expect } from '@jest/globals';
import { buildJUnitReport } from './index';

const result = (iterationIndex?: number) => ({
  name: 'Get user',
  path: 'users/Get user.bru',
  test: { filename: 'users/Get user.bru' },
  runDuration: 0.5,
  iterationIndex,
  testResults: [{ description: 'ok', status: 'pass' }]
});

describe('buildJUnitReport', () => {
  it('keeps suite names unchanged without iterations', () => {
    const report = buildJUnitReport([result(), result()], { hostname: 'host' });
    expect(report.testsuites.testsuite.map((s) => s['@name'])).toEqual(['Get user', 'Get user']);
    expect(report.testsuites.testsuite[0]['@hostname']).toBe('host');
  });

  it('suffixes suite names with the iteration when there are several', () => {
    const report = buildJUnitReport([result(0), result(1)], { hostname: 'host' });
    expect(report.testsuites.testsuite.map((s) => s['@name'])).toEqual(['Get user (iteration 1)', 'Get user (iteration 2)']);
  });
});

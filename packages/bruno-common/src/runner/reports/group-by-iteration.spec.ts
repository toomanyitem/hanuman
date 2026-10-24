import { describe, it, expect } from '@jest/globals';
import { groupResultsByIteration } from './group-by-iteration';

describe('groupResultsByIteration', () => {
  it('groups by iteration in order, with a summary per iteration', () => {
    const results = [
      { name: 'a', iterationIndex: 1, status: 'pass', testResults: [{ status: 'pass' }] },
      { name: 'a', iterationIndex: 0, status: 'pass', testResults: [{ status: 'fail' }] }
    ];
    const groups = groupResultsByIteration(results);
    expect(groups.map((g) => g.iterationIndex)).toEqual([0, 1]);
    expect(groups[0].summary.failedTests).toBe(1);
    expect(groups[1].summary.passedTests).toBe(1);
  });

  it('treats results without iterationIndex as one iteration with the run summary', () => {
    const runSummary = { totalRequests: 2 };
    const groups = groupResultsByIteration([{ name: 'a' }, { name: 'b' }], runSummary);
    expect(groups).toEqual([{ iterationIndex: 0, results: [{ name: 'a' }, { name: 'b' }], summary: runSummary }]);
  });

  it('keeps an empty run as one empty iteration', () => {
    expect(groupResultsByIteration([])).toHaveLength(1);
  });
});

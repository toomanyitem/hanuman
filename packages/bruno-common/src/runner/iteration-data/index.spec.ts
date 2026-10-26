import { describe, it, expect } from '@jest/globals';
import { parseIterationData, getIterationRow, resolveIterationCount, nextRunnerPosition } from './index';

describe('parseIterationData', () => {
  it('parses an Excel CSV with BOM, CRLF and Thai text', () => {
    const csv = '﻿name,city\r\nสมชาย,"Bangkok, TH"\r\n"say ""hi""",x\r\n\r\n';
    expect(parseIterationData(csv, 'users.csv')).toEqual([
      { name: 'สมชาย', city: 'Bangkok, TH' },
      { name: 'say "hi"', city: 'x' }
    ]);
  });

  it('casts unquoted numbers that round-trip', () => {
    expect(parseIterationData('a,b,c,d,e,f\n1,2.5,007,"3",1.50,-4', 'x.CSV')).toEqual([
      { a: 1, b: 2.5, c: '007', d: '3', e: '1.50', f: -4 }
    ]);
  });

  it('trims around delimiters and tolerates ragged rows', () => {
    expect(parseIterationData('a , b\n 1 ,2,3\n4', 'x.csv')).toEqual([
      { a: 1, b: 2 },
      { a: 4, b: '' }
    ]);
  });

  it('keeps newlines and spaces inside quoted cells', () => {
    expect(parseIterationData('a\n" x\ny "', 'x.csv')).toEqual([{ a: ' x\ny ' }]);
  });

  it('handles lone CR line endings', () => {
    expect(parseIterationData('a\r1\r2', 'x.csv')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('parses a JSON array of objects', () => {
    expect(parseIterationData(' [{"id":1},{"id":2}] ', 'data.json')).toEqual([{ id: 1 }, { id: 2 }]);
    expect(parseIterationData('﻿[{"id":1}]', 'data.json')).toEqual([{ id: 1 }]);
  });

  it('rejects JSON that is not an array of objects', () => {
    expect(() => parseIterationData('{"id":1}', 'data.json')).toThrow(/must be an array of objects/);
    expect(() => parseIterationData('[{"id":1}, 3]', 'data.json')).toThrow(/row 2/);
    expect(() => parseIterationData('[{"id":1}, [1]]', 'data.json')).toThrow(/row 2/);
    expect(() => parseIterationData('[', 'data.json')).toThrow(/not valid JSON/);
  });

  it('rejects files with no rows, unknown extensions and duplicate columns', () => {
    expect(() => parseIterationData('a\n', 'x.csv')).toThrow(/no data rows/);
    expect(() => parseIterationData('', 'x.csv')).toThrow(/no data rows/);
    expect(() => parseIterationData('[]', 'x.json')).toThrow(/no data rows/);
    expect(() => parseIterationData('x', 'x.txt')).toThrow(/\.csv or \.json/);
    expect(() => parseIterationData('a,a\n1,2', 'x.csv')).toThrow(/duplicate column "a"/);
    expect(() => parseIterationData('a,\n1,2', 'x.csv')).toThrow(/empty column name/);
    expect(() => parseIterationData('a\n"x', 'x.csv')).toThrow(/unclosed quote/);
  });
});

describe('getIterationRow', () => {
  it('uses the last row when the index is past the end, like Postman', () => {
    expect(getIterationRow([{ a: 1 }, { a: 2 }], 0)).toEqual({ a: 1 });
    expect(getIterationRow([{ a: 1 }, { a: 2 }], 5)).toEqual({ a: 2 });
    expect(getIterationRow([], 0)).toEqual({});
  });
});

describe('resolveIterationCount', () => {
  it('defaults to the row count, or 1 without rows', () => {
    expect(resolveIterationCount([{}, {}, {}], null)).toBe(3);
    expect(resolveIterationCount([], undefined)).toBe(1);
    expect(resolveIterationCount([{}], 5)).toBe(5);
  });

  it('rejects counts that are not positive integers', () => {
    expect(() => resolveIterationCount([{}], 0)).toThrow(/positive whole number/);
    expect(() => resolveIterationCount([{}], -1)).toThrow(/positive whole number/);
    expect(() => resolveIterationCount([{}], 1.5)).toThrow(/positive whole number/);
    expect(() => resolveIterationCount([{}], NaN)).toThrow(/positive whole number/);
  });
});

describe('nextRunnerPosition', () => {
  const base = { requestCount: 3, iterationCount: 2 };

  it('moves to the next request, then to the next iteration, then ends the run', () => {
    expect(nextRunnerPosition({ ...base, requestIndex: 0, iterationIndex: 0 })).toEqual({ requestIndex: 1, iterationIndex: 0 });
    expect(nextRunnerPosition({ ...base, requestIndex: 2, iterationIndex: 0 })).toEqual({ requestIndex: 0, iterationIndex: 1 });
    expect(nextRunnerPosition({ ...base, requestIndex: 2, iterationIndex: 1 })).toEqual({ requestIndex: 3, iterationIndex: 1 });
  });

  it('jumps within the iteration', () => {
    expect(nextRunnerPosition({ ...base, requestIndex: 2, iterationIndex: 0, nextRequestIndex: 0 })).toEqual({ requestIndex: 0, iterationIndex: 0 });
  });

  it('ends only the current iteration on a null jump', () => {
    expect(nextRunnerPosition({ ...base, requestIndex: 0, iterationIndex: 0, nextRequestIndex: null })).toEqual({ requestIndex: 0, iterationIndex: 1 });
    expect(nextRunnerPosition({ ...base, requestIndex: 0, iterationIndex: 1, nextRequestIndex: null })).toEqual({ requestIndex: 3, iterationIndex: 1 });
  });

  it('ends a single-iteration run on a null jump, as before', () => {
    expect(nextRunnerPosition({ requestCount: 3, iterationCount: 1, requestIndex: 0, iterationIndex: 0, nextRequestIndex: null })).toEqual({ requestIndex: 3, iterationIndex: 0 });
  });
});

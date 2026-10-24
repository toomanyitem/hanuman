const { describe, it, expect } = require('@jest/globals');
const fs = require('fs');

const mockGenerateOfflineHtmlReport = jest.fn(() => '<html>Mock HTML</html>');

jest.mock('@usebruno/common/runner', () => ({
  ...jest.requireActual('@usebruno/common/runner'),
  generateOfflineHtmlReport: mockGenerateOfflineHtmlReport
}));

const makeHtmlOutput = require('../../src/reporters/html');

describe('makeHtmlOutput', () => {
  let writeFileSyncSpy;

  beforeEach(() => {
    mockGenerateOfflineHtmlReport.mockClear();
    writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should pass environment parameter to generateOfflineHtmlReport when provided', async () => {
    const mockResults = {
      results: [],
      summary: {
        totalRequests: 0,
        passedRequests: 0,
        failedRequests: 0,
        errorRequests: 0,
        skippedRequests: 0,
        totalAssertions: 0,
        passedAssertions: 0,
        failedAssertions: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0
      }
    };

    await makeHtmlOutput(mockResults, '/tmp/test.html', '2024-01-15T14:30:45.123Z', 'production');

    expect(mockGenerateOfflineHtmlReport).toHaveBeenCalledWith(expect.objectContaining({
      environment: 'production'
    }));
  });

  it('should pass null environment when not provided', async () => {
    const mockResults = {
      results: [],
      summary: {
        totalRequests: 0,
        passedRequests: 0,
        failedRequests: 0,
        errorRequests: 0,
        skippedRequests: 0,
        totalAssertions: 0,
        passedAssertions: 0,
        failedAssertions: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0
      }
    };

    await makeHtmlOutput(mockResults, '/tmp/test.html', '2024-01-15T14:30:45.123Z');

    expect(mockGenerateOfflineHtmlReport).toHaveBeenCalledWith(expect.objectContaining({
      environment: null
    }));
  });
});

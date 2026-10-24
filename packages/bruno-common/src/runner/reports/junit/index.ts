// The xmlbuilder object for a JUnit report, shared by `bru run --reporter-junit`
// and the app's report export so both serialize the same XML.

type T_TestResult = { description?: string; status: string; error?: string };
type T_AssertionResult = { lhsExpr: string; rhsExpr: string; status: string; error?: string };

export type T_JUnitInputResult = {
  name: string;
  path?: string;
  test: { filename: string };
  runDuration: number;
  iterationIndex?: number;
  skipped?: boolean;
  skipReason?: string;
  error?: unknown;
  assertionResults?: T_AssertionResult[];
  preRequestTestResults?: T_TestResult[];
  testResults?: T_TestResult[];
  postResponseTestResults?: T_TestResult[];
};

const stripExtension = (filename = ''): string => filename.replace(/\.[^/.]+$/, '');

export const buildJUnitReport = (results: T_JUnitInputResult[], { hostname }: { hostname: string }) => {
  const output = {
    testsuites: {
      testsuite: [] as Record<string, unknown>[]
    }
  };
  const hasIterations = new Set(results.map((result) => result.iterationIndex ?? 0)).size > 1;

  results.forEach((result) => {
    const assertionTestCount = result.assertionResults ? result.assertionResults.length : 0;
    const preRequestTestCount = result.preRequestTestResults ? result.preRequestTestResults.length : 0;
    const testCount = result.testResults ? result.testResults.length : 0;
    const postResponseTestCount = result.postResponseTestResults ? result.postResponseTestResults.length : 0;
    const totalTests = assertionTestCount + preRequestTestCount + testCount + postResponseTestCount;
    const classname = stripExtension(result.path);
    const testcaseTime = (result.runDuration / totalTests).toFixed(3);

    const suite: Record<string, any> = {
      '@name': hasIterations ? `${result.name} (iteration ${(result.iterationIndex ?? 0) + 1})` : result.name,
      '@file': result.test.filename,
      '@errors': 0,
      '@failures': 0,
      '@skipped': 0,
      '@tests': totalTests,
      '@timestamp': new Date().toISOString().split('Z')[0],
      '@hostname': hostname,
      '@time': result.runDuration.toFixed(3),
      'testcase': []
    };

    const addTestcase = (name: string | undefined, status: string, error: string | undefined) => {
      const testcase: Record<string, unknown> = {
        '@name': name,
        '@status': status,
        '@classname': classname,
        '@time': testcaseTime
      };

      if (status === 'fail') {
        suite['@failures']++;

        testcase.failure = [{ '@type': 'failure', '@message': error }];
      }

      suite.testcase.push(testcase);
    };

    result.assertionResults?.forEach((assertion) => addTestcase(`${assertion.lhsExpr} ${assertion.rhsExpr}`, assertion.status, assertion.error));
    result.preRequestTestResults?.forEach((test) => addTestcase(test.description, test.status, test.error));
    result.testResults?.forEach((test) => addTestcase(test.description, test.status, test.error));
    result.postResponseTestResults?.forEach((test) => addTestcase(test.description, test.status, test.error));

    if (result?.skipped) {
      suite['@skipped'] = 1;
      suite.skipped = [{ '@message': result.skipReason === 'bail' ? 'Request skipped due to bail' : 'Request Skipped' }];
    } else if (result.error) {
      suite['@errors'] = 1;
      suite['@tests'] = 1;
      suite.testcase = [
        {
          '@name': 'Test suite has no errors',
          '@status': 'fail',
          '@classname': classname,
          '@time': result.runDuration.toFixed(3),
          'error': [{ '@type': 'error', '@message': result.error }]
        }
      ];
    }

    output.testsuites.testsuite.push(suite);
  });

  return output;
};

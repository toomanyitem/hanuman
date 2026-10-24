import { T_RunnerResults } from '../../types';
import { encodeBase64, getContentType, redactImageData } from '../../utils';

// A single-file report that opens offline: no external scripts or styles, and a CSP that
// blocks every network request. Response values are rendered as text only (textContent),
// so an HTML or script body from a server is shown, never run.
const CONTENT_SECURITY_POLICY = 'default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'';

const styles = `
  :root { color-scheme: light dark; --pass: #1a7f37; --fail: #cf222e; --skip: #8c959f; --border: #d0d7de; --muted: #57606a; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  .meta, .summary { color: var(--muted); }
  .toolbar { margin: 12px 0; }
  details.request { border: 1px solid var(--border); border-left-width: 4px; border-radius: 4px; margin: 6px 0; }
  details.request > summary { cursor: pointer; padding: 6px 10px; display: flex; gap: 12px; align-items: baseline; }
  details.request.pass { border-left-color: var(--pass); }
  details.request.fail, details.request.error { border-left-color: var(--fail); }
  details.request.skipped { border-left-color: var(--skip); }
  .state { font-weight: 600; min-width: 56px; }
  .pass .state, li.pass { color: var(--pass); }
  .fail .state, .error .state, li.fail { color: var(--fail); }
  .skipped .state { color: var(--skip); }
  .name { font-weight: 600; }
  .url { color: var(--muted); word-break: break-all; }
  .body { padding: 0 12px 12px; }
  .body h3 { font-size: 13px; margin: 12px 0 4px; }
  pre { background: rgba(127, 127, 127, 0.1); padding: 8px; overflow: auto; max-height: 400px; white-space: pre-wrap; word-break: break-all; }
  table { border-collapse: collapse; }
  td { border: 1px solid var(--border); padding: 2px 8px; vertical-align: top; word-break: break-all; }
  body.failed-only details.request.pass, body.failed-only details.request.skipped { display: none; }
`;

// Runs in the report page. Uses only DOM APIs and textContent.
const script = `
(function () {
  var encoded = document.getElementById('report-data').textContent.trim();
  var bytes = Uint8Array.from(atob(encoded), function (c) { return c.charCodeAt(0); });
  var data = JSON.parse(new TextDecoder().decode(bytes));

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'text') node.textContent = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function testsOf(result) {
    var tests = [];
    (result.preRequestTestResults || []).forEach(function (t) { tests.push({ label: t.description, status: t.status, error: t.error }); });
    (result.testResults || []).forEach(function (t) { tests.push({ label: t.description, status: t.status, error: t.error }); });
    (result.postResponseTestResults || []).forEach(function (t) { tests.push({ label: t.description, status: t.status, error: t.error }); });
    (result.assertionResults || []).forEach(function (a) { tests.push({ label: a.lhsExpr + ': ' + a.rhsExpr, status: a.status, error: a.error }); });
    return tests;
  }

  function stateOf(result) {
    if (result.status === 'skipped' || result.skipped) return 'skipped';
    if (result.status === 'error' || result.error) return 'error';
    return testsOf(result).some(function (t) { return t.status !== 'pass'; }) ? 'fail' : 'pass';
  }

  function format(value) {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }

  function headersTable(headers) {
    var rows = Object.keys(headers || {}).map(function (name) {
      return el('tr', {}, [el('td', { text: name }), el('td', { text: format(headers[name]) })]);
    });
    return rows.length ? el('table', {}, rows) : el('div', { class: 'meta', text: 'none' });
  }

  function summaryText(s) {
    return s.totalRequests + ' requests: ' + s.passedRequests + ' passed, ' + s.failedRequests + ' failed, '
      + s.errorRequests + ' errors, ' + s.skippedRequests + ' skipped · tests '
      + (s.passedTests + s.passedPreRequestTests + s.passedPostResponseTests) + '/'
      + (s.totalTests + s.totalPreRequestTests + s.totalPostResponseTests)
      + ' · assertions ' + s.passedAssertions + '/' + s.totalAssertions;
  }

  function renderResult(result) {
    var state = stateOf(result);
    var request = result.request || {};
    var response = result.response || {};
    var tests = testsOf(result);
    var time = response.responseTime !== undefined ? response.responseTime + ' ms' : '';
    return el('details', { class: 'request ' + state, 'data-testid': 'report-request' }, [
      el('summary', {}, [
        el('span', { class: 'state', text: state.toUpperCase() }),
        el('span', { class: 'name', text: result.name || result.path || '' }),
        el('span', { class: 'url', text: [request.method, request.url].filter(Boolean).join(' ') }),
        el('span', { text: [response.status, response.statusText].filter(function (v) { return v !== null && v !== undefined; }).join(' ') }),
        el('span', { class: 'meta', text: time })
      ]),
      el('div', { class: 'body' }, [
        result.error ? el('pre', { text: format(result.error) }) : null,
        tests.length ? el('h3', { text: 'Tests' }) : null,
        tests.length ? el('ul', {}, tests.map(function (t) {
          return el('li', { class: t.status === 'pass' ? 'pass' : 'fail', text: (t.status === 'pass' ? '✓ ' : '✗ ') + t.label + (t.error ? ' — ' + t.error : '') });
        })) : null,
        el('h3', { text: 'Request headers' }), headersTable(request.headers),
        request.data !== null && request.data !== undefined ? el('h3', { text: 'Request body' }) : null,
        request.data !== null && request.data !== undefined ? el('pre', { text: format(request.data) }) : null,
        el('h3', { text: 'Response headers' }), headersTable(response.headers),
        response.data !== null && response.data !== undefined ? el('h3', { text: 'Response body' }) : null,
        response.data !== null && response.data !== undefined ? el('pre', { text: format(response.data) }) : null
      ])
    ]);
  }

  var meta = [data.version, data.environment ? 'Environment: ' + data.environment : '', data.runCompletionTime].filter(Boolean).join(' · ');
  document.getElementById('meta').textContent = meta;
  var report = document.getElementById('report');
  var several = data.results.length > 1;
  data.results.forEach(function (iteration) {
    report.appendChild(el('section', { 'data-testid': 'report-iteration' }, [
      el('h2', { text: several ? 'Iteration ' + (iteration.iterationIndex + 1) : 'Results' }),
      el('div', { class: 'summary', text: summaryText(iteration.summary) })
    ].concat(iteration.results.map(renderResult))));
  });
  document.getElementById('failed-only').addEventListener('change', function (event) {
    document.body.classList.toggle('failed-only', event.target.checked);
  });
})();
`;

export const generateOfflineHtmlReport = ({
  runnerResults,
  version = '',
  environment = null,
  runCompletionTime = ''
}: {
  runnerResults: T_RunnerResults[];
  version?: string;
  environment?: string | null;
  runCompletionTime?: string;
}): string => {
  const results = runnerResults.map(({ iterationIndex, results, summary }) => ({
    iterationIndex,
    summary,
    results: results.map((result) => {
      const { request, response } = result || {};
      const requestContentType = request?.headers ? getContentType(request.headers) : '';
      const responseContentType = response?.headers ? getContentType(response.headers) : '';
      return {
        ...result,
        request: { ...request, data: request?.data ? redactImageData(request.data, requestContentType) : request?.data },
        response: { ...response, data: response?.data ? redactImageData(response.data, responseContentType) : response?.data }
      };
    })
  }));
  // Base64 keeps the payload free of "</script>" and other markup.
  const payload = encodeBase64(JSON.stringify({ results, version, environment, runCompletionTime }));

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hanuman run report</title>
    <style>${styles}</style>
  </head>
  <body>
    <h1>Run report</h1>
    <div class="meta" id="meta"></div>
    <div class="toolbar"><label><input type="checkbox" id="failed-only" data-testid="report-failed-only" /> Failed only</label></div>
    <main id="report"></main>
    <script id="report-data" type="application/octet-stream">${payload}</script>
    <script>${script}</script>
  </body>
</html>
`;
};

import { describe, it, expect } from '@jest/globals';
import { TextDecoder } from 'node:util';
import { JSDOM } from 'jsdom';
import { generateOfflineHtmlReport } from './offline-report';
import { decodeBase64 } from '../../utils';
import { groupResultsByIteration } from '../group-by-iteration';

const hostileBody = '</script><script>window.pwned = true</script><img src="https://example.com/x.png"> สวัสดี';

const result = (overrides: Record<string, unknown> = {}) => ({
  name: 'Get user',
  path: 'Get user.bru',
  request: { method: 'GET', url: 'http://localhost/users', headers: { accept: '*/*' }, data: null },
  response: { status: 200, statusText: 'OK', headers: { 'content-type': 'text/html' }, data: hostileBody, responseTime: 12 },
  status: 'pass',
  error: null,
  testResults: [{ description: 'is ok', status: 'pass' }],
  assertionResults: [],
  runDuration: 0.01,
  ...overrides
});

// jsdom 20 has no TextDecoder; every browser the report opens in does.
const render = (html: string) =>
  new JSDOM(html, { runScripts: 'dangerously', beforeParse: (window: any) => { window.TextDecoder = TextDecoder; } }).window;

describe('generateOfflineHtmlReport', () => {
  const html = generateOfflineHtmlReport({
    runnerResults: groupResultsByIteration([
      result({ iterationIndex: 0 }),
      result({ iterationIndex: 1, testResults: [{ description: 'is ok', status: 'fail', error: 'expected 1' }] })
    ]) as any,
    version: 'Hanuman v1',
    environment: 'local',
    runCompletionTime: '2026-10-24T00:00:00.000Z'
  });

  it('loads nothing from the network and blocks it with a CSP', () => {
    expect(html).not.toMatch(/(src|href)\s*=\s*["']?https?:/i);
    expect(html).toContain('<meta http-equiv="Content-Security-Policy" content="default-src \'none\';');
    expect(html).toContain('<title>Hanuman run report</title>');
  });

  it('keeps a hostile body and Thai text intact inside the base64 payload', () => {
    const encoded = html.match(/<script id="report-data" type="application\/octet-stream">([^<]+)<\/script>/)![1];
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(JSON.parse(decodeBase64(encoded)).results[0].results[0].response.data).toBe(hostileBody);
  });

  it('renders iterations, statuses and tests, and shows bodies as text', () => {
    const window = render(html);
    const { document } = window;
    expect([...document.querySelectorAll('[data-testid="report-iteration"] h2')].map((h) => h.textContent)).toEqual(['Iteration 1', 'Iteration 2']);
    const requests = [...document.querySelectorAll('[data-testid="report-request"]')];
    expect(requests.map((r) => r.className)).toEqual(['request pass', 'request fail']);
    expect(requests[1].textContent).toContain('is ok — expected 1');
    expect(requests[0].querySelector('pre')!.textContent).toBe(hostileBody);
    expect(document.querySelectorAll('img')).toHaveLength(0);
    expect((window as any).pwned).toBeUndefined();
    expect(document.getElementById('meta')!.textContent).toBe('Hanuman v1 · Environment: local · 2026-10-24T00:00:00.000Z');
  });

  it('hides passing requests with the failed-only toggle', () => {
    const { document, Event } = render(html);
    const toggle = document.getElementById('failed-only') as any;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    expect(document.body.classList.contains('failed-only')).toBe(true);
  });

  it('titles a single iteration as results', () => {
    const single = generateOfflineHtmlReport({ runnerResults: groupResultsByIteration([result()]) as any });
    expect(render(single).document.querySelector('h2')!.textContent).toBe('Results');
  });
});

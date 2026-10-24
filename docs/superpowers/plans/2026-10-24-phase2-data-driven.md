# Phase 2 — Data-driven Testing and Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a collection or folder once per row of a CSV or JSON file, in the app and in `bru run`. Each row's values are `{{column}}` variables and are readable from scripts (Postman `pm.iterationData` compatible). Results are shown and reported per iteration, exported as HTML, JUnit and JSON with the same builders the CLI uses, and kept as local run history.

**Architecture:** One parser in `@usebruno/common` turns a data file into rows. Both runners (electron `renderer:run-collection-folder`, CLI `commands/run.js`) loop over iterations around their existing request loop. Each request carries `request.iteration = { index, count, data }`, the same way `oauth2CredentialVariables` rides on the request today, so every interpolation site and every `new Bru(...)` picks it up without signature changes. Report builders (iteration grouping, JUnit object, HTML) live in `@usebruno/common/runner` and are called by both the CLI reporters and the electron export. The app saves each finished run to `userData/run-history/` by joining the renderer's results with the request/response bodies already stored in sqlite (`services/runner-exchange`).

**Tech Stack:** `@usebruno/common` (TypeScript, rollup), bruno-js (node-vm + QuickJS shim), electron-store, xmlbuilder 15 (already in the lockfile), React + styled-components, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-hanuman-design.md` §6 "เฟส 2", §5.4, §9 items 6, 9.

## Global Constraints

- Never copy or decompile code from Bruno's paid edition. Postman behaviour comes from the public `postman-runtime` and `newman` sources and docs.
- No telemetry. No network call that the user did not start. History and remembered paths stay on the machine, never in the collection or Git.
- Old Bruno collections keep opening. Nothing here changes `.bru`/`.yml` grammar or writes collection files.
- New code goes in new files. Upstream edits are plug-in points only, each one listed in `docs/UPSTREAM-SYNC.md` (phase 2 section).
- App and CLI behave the same (`.claude/rules/feature-parity.md`): every runner option has a `bru run` flag, every `bru.*` addition is bridged in the QuickJS shim.
- A CLI run **without** `--iteration-data`/`--iteration-count` produces the same JSON and JUnit structure as before this phase (people's CI parses them).
- Follow `.claude/rules/` (`renderer:*` channels, exported testable handler functions, inputs validated in the handler, `data-testid` for Playwright, `path` APIs for cross-platform paths).
- HTTP and GraphQL only, like the existing runner. gRPC and WebSocket items stay skipped in runs.

## Postman behaviour this plan follows (checked in source)

| Behaviour | Source | Hanuman |
|---|---|---|
| Iteration count larger than row count | `postman-runtime lib/runner/util.js getIterationData`: uses the **last row** | same |
| No data file, count `n` | newman runs `n` iterations with empty data | same |
| `setNextRequest(null)` | `util.js processExecutionResult`: seeks the end of the **current iteration**, run continues with the next one | same (today Bruno ends the whole run; with one iteration the result is unchanged) |
| `setNextRequest('missing name')` | Postman stops the iteration | keep Bruno's current behaviour (log and go to the next request) to avoid changing upstream semantics |
| CSV cells | newman `csv-parse` with `columns, trim, bom, relax_column_count`; unquoted ints/floats become numbers, quoted cells stay strings | same, except an unquoted number is cast only if `String(Number(cell)) === cell`, so `007` and `1.50` stay strings (newman turns them into 7 and 1.5, which loses data) |
| JSON file | array of objects | must be an array of plain objects, otherwise an error naming the bad index |
| Variable precedence | global < collection < environment < **data** < local | data sits between environment and folder variables |
| `pm.iterationData` outside a run | exists, empty | `bru.runner.iterationData` exists on single sends, empty; `iteration` 0, `iterationCount` 1 |

## Decisions (Friday's calls, for Arm to check)

1. Script API names: `bru.runner.iterationData.get(key)`, `.has(key)`, `.toObject()`, `bru.runner.iteration` (0-based), `bru.runner.iterationCount`. They map one-to-one from `pm.iterationData.*`, `pm.info.iteration`, `pm.info.iterationCount`.
2. **Known gap:** Postman's `pm.variables.get('col')` also reads data columns. The converter maps it to `bru.getVar`, which reads runtime variables only, so a converted script that reads a column through `pm.variables.get` gets `undefined`. `{{col}}` in requests and `pm.iterationData.get` work. Changing `bru.getVar` would change upstream semantics, so it stays a documented gap.
3. Data file is chosen in the runner panel. The path is remembered per collection in `userData` (electron-store `iteration-data`), and the file is read by the main process at run start, so edits to the CSV are picked up without re-selecting.
4. Iteration count input: empty means "number of rows" (or 1 without a file). The delay input that already exists is the delay between requests.
5. History: the last **50 runs per collection** (§9.6) in `userData/run-history/<sha1 of collection path>/`, with a Clear history button. A response body over **1 MB** is stored as `[body not stored: N bytes]`. History outlives the app session (the sqlite exchange store is wiped at every start), so `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` and header names matching token/secret/api-key/password are stored as `[redacted]`, and values of environment variables marked secret (collection and global) are replaced in URLs and bodies. **Known gap for Arm:** secrets that are not marked secret, inside URLs or bodies, are still stored. Exports come from history, so they carry the same redaction.
6. Past runs open as the HTML report in the system browser (a temp file, `shell.openPath`), plus Export. There is no separate in-app viewer for old runs; the live run uses the existing runner results view.
7. Iterations in the live view: an "Iteration 2/3" counter while running and an `#n` badge on each result row when there is more than one iteration. The existing All/Passed/Failed/Skipped filter stays as is.
8. One rule on both sides: results carry `iterationIndex` only when a run has **more than one iteration**; top-level `summary` stays overall. JUnit suite names get ` (iteration n)` under the same rule.
9. The JUnit object builder moves to `@usebruno/common/runner` (`buildJUnitReport`), and the CLI's `reporters/junit.js` calls it. Both sides serialize with xmlbuilder, so the XML is identical. `bruno-electron` gets `xmlbuilder` as a dependency.
10. `tests/data-driven` runs on every PR as a step of the existing `git-panel-e2e` job.
11. **HTML report:** upstream's template loads Vue and naive-ui from unpkg.com, so it cannot open offline (spec requirement) and renders response HTML in iframes. A new single-file report `generateOfflineHtmlReport` (no external resources, CSP `default-src 'none'`, all values rendered as text) replaces it for **both** `bru run --reporter-html` and the app export. Upstream's `template.ts`/`generate-report.ts` stay untouched.
12. **Converter behaviour change:** imported `pm.setNextRequest(null)` / `pm.execution.setNextRequest(null)` now become `bru.runner.setNextRequest(null)` (ends the current iteration, as in Postman) instead of upstream's `bru.runner.stopExecution()` (which would stop every remaining iteration). Upstream tests `exec-flow.test.js` and `multiline-syntax.test.js` were edited to match.
13. When `--bail` or `stopExecution` halts a CLI run, skipped placeholder rows cover only the rest of that iteration, not later iterations (the app has never created skipped rows for a halt). The app runner only reads the data file the user chose for that collection (main checks it against the remembered path).
14. Left alone on purpose (parity rule): electron/CLI `interpolate-string.js` (proxy, certs, gRPC OAuth2 token URLs) and the gRPC script runtime get no row values, because gRPC and WebSocket items are skipped in collection runs.

## Review Focus

1. **Excel CSV**: UTF-8 BOM, CRLF, Thai text, trailing empty line, a quoted cell with a comma and a doubled quote. Expect clean column names and exact values. Test: Task 1 `parses an Excel CSV with BOM, CRLF and Thai text`.
2. **Stop mid-run**: Stop clicked during iteration 2 of 3. Expect no iteration 3 request and exactly one `testrun-ended`. Test: Task 5 `stop ends all iterations and ends the run once`.
3. **`setNextRequest(null)` with 3 rows**: expect it to skip the rest of that iteration only, 3 iterations still run. Tests: Task 4 (CLI) and Task 5 (`nextRunnerPosition`).
4. **Bad data file**: missing file, `.txt`, JSON object instead of array, CSV with only a header. Expect the run not to start and the user to see the parser's message. Tests: Task 1 error specs, Task 5 `loadIterationPlan rejects`.
5. **Large responses in history**: a 5 MB response in a run saved to history. Expect the history file to hold the marker, not the body, and the prune to keep 50 files. Test: Task 6 `run-history caps bodies and prunes to 50`.

## File Structure

New files:

| File | Responsibility |
|---|---|
| `packages/bruno-common/src/runner/iteration-data/index.ts` | `parseIterationData`, `getIterationRow`, `resolveIterationCount`, `nextRunnerPosition` (loop control shared by both runners) |
| `packages/bruno-common/src/runner/reports/html/offline-report.ts` | `generateOfflineHtmlReport` (decision 11) |
| `packages/bruno-common/src/runner/reports/junit/index.ts` | `buildJUnitReport(results)` → xmlbuilder object (moved from CLI) |
| `packages/bruno-common/src/runner/reports/group-by-iteration.ts` | `groupResultsByIteration(results)` → `T_RunnerResults[]` |
| `packages/bruno-js/src/iteration-data.js` | `createIterationApi(iteration)` → `{ iterationData, iteration, iterationCount }` |
| `packages/bruno-electron/src/utils/iteration-data.js` | `loadIterationPlan({ dataFilePath, iterationCount })` (reads + validates the file) |
| `packages/bruno-electron/src/utils/run-history.js` | build CLI-shape results from renderer items + sqlite, save, list, prune, read |
| `packages/bruno-electron/src/store/iteration-data.js` | last data file path per collection |
| `packages/bruno-electron/src/ipc/data-driven.js` | `renderer:data-driven:*` handlers |
| `packages/bruno-app/src/components/RunnerResults/IterationDataControls/` | file pick, row count, iteration count input |
| `packages/bruno-app/src/components/RunnerResults/RunHistory/` | history list, open, export |
| `packages/bruno-app/src/hooks/useRunHistorySaver/`, `hooks/useIterationDataFile/` | saves a run when its status turns `ended`; the remembered data file |
| `tests/data-driven/*`, `tests/utils/page/data-driven.ts` | e2e |

Upstream files touched (plug-in points):

| File | Change |
|---|---|
| `bruno-common/src/runner/index.ts` | export the new modules |
| `bruno-js/src/bru.js` | `this.runner` gets the iteration API; `interpolate` adds the data layer |
| `bruno-js/src/sandbox/quickjs/shims/bru.js` | bridge `iterationData`, `iteration`, `iterationCount` |
| `bruno-js/src/interpolate-string.js`, `runtime/vars-runtime.js`, `runtime/assert-runtime.js`, `runtime/script-runtime.js`, `runtime/test-runtime.js` | add the data layer / pass `request.iteration` to `Bru` |
| `bruno-electron/src/ipc/network/index.js` | options arg, iteration loop control, `iterationIndex` in events |
| `bruno-electron/src/ipc/network/interpolate-vars.js` | data layer |
| `bruno-electron/src/index.js`, `package.json` | `registerDataDrivenIpc`, `xmlbuilder` dep |
| `bruno-common/package.json` | `jsdom` devDependency (report rendering test) |
| `bruno-cli/src/commands/run.js` | flags, iteration loop |
| `bruno-cli/src/runner/interpolate-vars.js`, `run-single-request.js` | data layer |
| `bruno-cli/src/reporters/junit.js`, `html.js` | call the shared builders |
| `bruno-converters/src/utils/postman-to-bruno-translator.js`, `bruno-to-postman-translator.js`, `src/postman/postman-translations.js` | `pm.iterationData`, `pm.info.iteration*` |
| `bruno-app/.../slices/collections/actions.js` | `runCollectionFolder(..., iterationOptions)` |
| `bruno-app/.../slices/collections/index.js` | `iterationIndex` on queued items, `iterationCount` in info |
| `bruno-app/src/components/RunnerResults/index.jsx` (+ result row) | render the two new components, pass options, `#n` badge |
| `bruno-app/src/providers/App/index.js` | call `useRunHistorySaver()` |
| `tests/utils/page/index.ts`, `.github/workflows/tests-linux.yml` | e2e wiring, CI step |

---

### Task 1: Iteration data parser in `@usebruno/common`

**Files:**
- Create: `packages/bruno-common/src/runner/iteration-data/index.ts`, `index.spec.ts`
- Modify: `packages/bruno-common/src/runner/index.ts`

**Interfaces:**
- Produces: `parseIterationData(text: string, fileName: string): Record<string, unknown>[]` (format by extension `.csv` / `.json`, case-insensitive; throws `Error` with a readable message); `getIterationRow(rows, index): Record<string, unknown>` (last row when `index >= rows.length`, `{}` when no rows); `resolveIterationCount(rows, requested?: number | null): number` (requested when it is a positive integer, else `rows.length || 1`; throws on 0, negative, non-integer).

- [ ] **Step 1: Write failing tests** in `index.spec.ts`:
  - `parses an Excel CSV with BOM, CRLF and Thai text`: input `'﻿name,city\r\nสมชาย,"Bangkok, TH"\r\n"say ""hi""",x\r\n\r\n'` → `[{ name: 'สมชาย', city: 'Bangkok, TH' }, { name: 'say "hi"', city: 'x' }]`.
  - `casts unquoted numbers that round-trip`: `'a,b,c,d\n1,2.5,007,"3"'` → `[{ a: 1, b: 2.5, c: '007', d: '3' }]`; `1.50` stays `'1.50'`.
  - `trims around delimiters and tolerates ragged rows`: `'a , b\n 1 ,2,3\n4'` → `[{ a: 1, b: 2 }, { a: 4, b: '' }]`.
  - `keeps newlines inside quoted cells`: `'a\n"x\ny"'` → `[{ a: 'x\ny' }]`.
  - JSON: `'[{"id":1},{"id":2}]'` → 2 rows; `'{"id":1}'` throws `/must be an array of objects/`; `'[{"id":1}, 3]'` throws `/row 2/`.
  - Errors: `parseIterationData('a\n', 'x.csv')` throws `/no data rows/`; `parseIterationData('x', 'x.txt')` throws `/\.csv or \.json/`; duplicate header `'a,a\n1,2'` throws `/duplicate column "a"/`.
  - `getIterationRow([{a:1},{a:2}], 5)` → `{a:2}`; `getIterationRow([], 0)` → `{}`.
  - `resolveIterationCount([{},{},{}], null)` → 3; `([], undefined)` → 1; `([{}], 5)` → 5; `([{}], 0)` throws.
- [ ] **Step 2: Run** `npm test --workspace=packages/bruno-common -- iteration-data` → FAIL (module missing).
- [ ] **Step 3: Implement** the three functions. CSV: a single-pass RFC 4180 state machine (quote, doubled quote, CR/LF/CRLF, BOM strip); track per cell whether it was quoted so only unquoted cells are cast; skip fully empty lines. No new dependency. Export them from `runner/index.ts`.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(common): parse CSV/JSON iteration data`.

### Task 2: Data variable layer and `bru.runner` iteration API

**Files:**
- Create: `packages/bruno-js/src/iteration-data.js`, `packages/bruno-js/tests/iteration-data.spec.js`
- Modify: `bruno-js/src/bru.js`, `bruno-js/src/sandbox/quickjs/shims/bru.js`, `bruno-js/src/interpolate-string.js`, `bruno-js/src/runtime/{script,test,vars,assert}-runtime.js`; `bruno-electron/src/ipc/network/interpolate-vars.js`, `interpolate-string.js`, `index.js:1359` (the merge used by the single-request path); `bruno-cli/src/runner/interpolate-vars.js`, `interpolate-string.js`, `run-single-request.js:67`
- Test: `bruno-electron/src/ipc/network/interpolate-vars.spec.js` (or the existing spec beside it), `bruno-cli/tests/runner/interpolate-vars.spec.js`

**Interfaces:**
- Consumes: nothing from Task 1 (rows are plain objects).
- Produces: the request property `request.iteration?: { index: number, count: number, data: Record<string, unknown> }`; `createIterationApi(iteration)` → `{ iterationData: { get(key), has(key), toObject() }, iteration: number, iterationCount: number }` with defaults `{}`/0/1 when `iteration` is undefined. `toObject()` returns a copy.

- [ ] **Step 1: Write failing tests.**
  - bruno-js `iteration-data.spec.js`: for both sandboxes (`runtime: 'nodevm'` and `'quickjs'`, using the harness in `tests/runtime.spec.js`), a pre-request script `bru.setVar('out', [bru.runner.iterationData.get('name'), bru.runner.iterationData.has('x'), bru.runner.iteration, bru.runner.iterationCount, bru.runner.iterationData.toObject().name].join('|'))` on a request with `iteration: { index: 1, count: 3, data: { name: 'b' } }` gives `'b|false|1|3|b'`; without `iteration` gives `'|false|0|1|'`.
  - electron and CLI interpolate-vars: env `{ user: 'env' }`, `request.iteration.data = { user: 'row', id: 7 }`, `request.folderVariables = { id: 'folder' }`, URL `{{user}}/{{id}}` → `row/folder` (data beats environment, loses to folder).
  - bruno-js `bru.interpolate('{{user}}')` with the same layers → `row`.
- [ ] **Step 2: Run** the three specs → FAIL.
- [ ] **Step 3: Implement.** `createIterationApi` in the new file. `Bru` constructor takes `iteration` as a new last argument and spreads `createIterationApi(iteration)` into `this.runner`. Each runtime passes `request?.iteration`. Every merge site adds `...(request?.iteration?.data || {})` right after the environment spread, with a `// hanuman: iteration data` comment. QuickJS: follow the `getCollectionName` pattern; set `iteration` and `iterationCount` as numbers on `bruRunnerObject`, and build `iterationData` as a VM object with `get`/`has`/`toObject` functions that call the host API and `marshallToVm` the result.
- [ ] **Step 4: Run** the specs plus `npm test --workspace=packages/bruno-js` → PASS.
- [ ] **Step 5: Commit** `feat(scripts): iteration data variables and bru.runner.iterationData`.

### Task 3: Postman converter mappings

**Files:**
- Modify: `bruno-converters/src/utils/postman-to-bruno-translator.js`, `src/postman/postman-translations.js`, `src/utils/bruno-to-postman-translator.js`
- Test: the existing translator specs beside each file

**Interfaces:**
- Consumes: Task 2 API names.

- [ ] **Step 1: Write failing tests**: `pm.iterationData.get("email")` → `bru.runner.iterationData.get("email")`; `pm.iterationData.has`, `pm.iterationData.toObject()` likewise; `pm.iterationData.toJSON()` → `bru.runner.iterationData.toObject()`; `pm.info.iteration` → `bru.runner.iteration`; `pm.info.iterationCount` → `bru.runner.iterationCount`. Both the AST translator and the regex fallback. Reverse direction maps back to `pm.*`. Plus a whole-collection test: a Postman v2.1 collection JSON fixture whose test script uses `pm.iterationData.get` imports with the translated script.
- [ ] **Step 2: Run** `npm test --workspace=packages/bruno-converters -- translat` → FAIL.
- [ ] **Step 3: Implement** the table entries (add `iterationData` to the known `pm.*` roots).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(converters): translate pm.iterationData and pm.info.iteration`.

### Task 4: CLI iterations and shared report builders

**Files:**
- Create: `bruno-common/src/runner/reports/junit/index.ts` (+ spec), `bruno-common/src/runner/reports/group-by-iteration.ts` (+ spec)
- Modify: `bruno-common/src/runner/index.ts`, `reports/html/generate-report.ts`; `bruno-cli/src/commands/run.js`, `src/reporters/junit.js`, `src/reporters/html.js`
- Test: `bruno-cli/tests/commands/run-iterations.spec.js` (new), existing `tests/reporters/junit.spec.js`, `html.spec.js`, `tests/runner/report-metadata.spec.js`

**Interfaces:**
- Consumes: Task 1 `parseIterationData`, `getIterationRow`, `resolveIterationCount`; Task 2 `request.iteration`.
- Produces: `buildJUnitReport(results: CliResult[]): object` (the exact object `junit.js` builds today; suite `@name` gets ` (iteration ${i + 1})` only when results carry more than one distinct `iterationIndex`); `groupResultsByIteration(results): T_RunnerResults[]` (results without `iterationIndex` count as iteration 0; each group has `summary` from `getRunnerSummary`). CLI result objects gain `iterationIndex` only when the run uses iterations.

- [ ] **Step 1: Golden test first.** Before touching `junit.js`, add a spec that feeds the existing fixture results to today's `makeJUnitOutput` and snapshots the XML with the timestamp and hostname replaced. The same snapshot must pass after the move.
- [ ] **Step 2: Write failing tests** in `run-iterations.spec.js`, using a temp collection with one GET request to a local `http.createServer` echo that returns the query string as JSON:
  - CSV `name\na\nb\nc`, request `/?n={{name}}`, test `test('n', () => expect(res.body.n).to.equal(bru.runner.iterationData.get('name')))` → 3 results, `iterationIndex` 0,1,2, echoed `a,b,c`, all pass.
  - `--iteration-count 5` with the same CSV → 5 results, the last two echo `c`.
  - `--iteration-count 2` and no data file → 2 results.
  - a pre-request `bru.runner.setNextRequest(null)` on request 1 of 2 → request 2 never runs, 3 iterations still run.
  - `--bail` with a failing test in iteration 1 → no iteration 2 results (skipped rows as today).
  - no iteration flags → JSON output has no `iterationIndex` key (deep-equal to the pre-change shape).
- [ ] **Step 3: Run** `npm test --workspace=packages/bruno-cli -- run-iterations junit html` → new specs FAIL, golden passes.
- [ ] **Step 4: Implement.** Flags `--iteration-data <file>` and `--iteration-count <n>` (yargs `number`, validated by `resolveIterationCount`; parse errors exit with code 1 and the message). Wrap the request loop (`run.js` request loop) in `for (iterationIndex …)`, reset the request index and jump counter per iteration, set `request.iteration` before `runSingleRequest`, make bail/`stopExecution` break both loops, and make `setNextRequest(null)` end only the current iteration. Move the JUnit object code to `buildJUnitReport`; `junit.js` keeps its file writing and calls it. `html.js` calls `groupResultsByIteration`. `generate-report.ts` keeps `iterationData` in its mapping.
- [ ] **Step 5: Run** `npm test --workspace=packages/bruno-common` and `npm test --workspace=packages/bruno-cli` → PASS.
- [ ] **Step 6: Commit** `feat(cli): --iteration-data and --iteration-count with per-iteration reports`.

### Task 5: Electron runner iterations

**Files:**
- Create: `bruno-electron/src/utils/iteration-data.js` (+ `tests/iteration-data.spec.js`); `nextRunnerPosition` lives in `@usebruno/common` (Task 4) and both runners call it
- Modify: `bruno-electron/src/ipc/network/index.js` (`renderer:run-collection-folder`)

**Interfaces:**
- Consumes: Task 1, Task 2.
- Produces: IPC arg 9 of `renderer:run-collection-folder`: `iterationOptions?: { dataFilePath?: string | null, iterationCount?: number | null }`. `loadIterationPlan(iterationOptions): Promise<{ rows, count }>` (no options → `{ rows: [], count: 1 }`). `nextRunnerPosition({ requestIndex, requestCount, iterationIndex, iterationCount, nextRequestIndex, endIteration, stop }): { requestIndex, iterationIndex, done }`. Events gain `iterationIndex` in `eventData` (and by hand in `assertion-results`); `testrun-started` gains `iterationCount`.

- [ ] **Step 1: Write failing tests.**
  - `loadIterationPlan`: CSV fixture with 3 rows → `{ rows.length: 3, count: 3 }`; `iterationCount: 5` → count 5; missing file rejects `/not found/`; `.txt` rejects `/\.csv or \.json/`; a directory rejects.
  - `nextRunnerPosition`: end of requests with iterations left → `{ requestIndex: 0, iterationIndex: +1, done: false }`; end of last iteration → `done: true`; `endIteration` (setNextRequest null) mid-iteration → next iteration; `stop` → `done: true`; a jump (`nextRequestIndex`) stays in the iteration.
  - `stop ends all iterations and ends the run once`: drive the handler's exported loop with a stubbed sender (if the handler cannot be exercised without Electron, cover this in Task 8's e2e and say so in the PR).
- [ ] **Step 2: Run** `npm test --workspace=packages/bruno-electron -- iteration` → FAIL.
- [ ] **Step 3: Implement.** In the handler: append the `iterationOptions` parameter, `const { rows, count } = await loadIterationPlan(iterationOptions)` before `testrun-started` (a load error sends `testrun-ended` with the error, like other failures), add `iterationCount` to `testrun-started`, add `iterationIndex` to `eventData`, set `request.iteration = { index, count, data: getIterationRow(rows, index) }` right after `prepareRequest`, and replace the end-of-loop index handling with `nextRunnerPosition`. Keep the existing `while` body unindented: the loop condition becomes `while (!position.done)`; no block is re-indented.
- [ ] **Step 4: Run** `npm test --workspace=packages/bruno-electron` → PASS.
- [ ] **Step 5: Commit** `feat(runner): iterate collection runs over data rows`.

### Task 6: Data file selection and run history in the main process

**Files:**
- Create: `bruno-electron/src/store/iteration-data.js`, `src/utils/run-history.js` (+ `tests/run-history.spec.js`), `src/ipc/data-driven.js` (+ spec)
- Modify: `bruno-electron/src/index.js` (register), `bruno-electron/package.json` (`xmlbuilder`)

**Interfaces:**
- Consumes: Task 4 builders, Task 5 `loadIterationPlan`, `readRunnerExchange` from `services/runner-exchange`.
- Produces channels (all validate `collectionPathname` is an opened collection, like `ipc/git-panel.js`):
  - `renderer:data-driven:pick-file({ collectionPathname })` → `{ path, rowCount, columns } | null` (open dialog, `.csv`/`.json`; remembers the path)
  - `renderer:data-driven:get-file({ collectionPathname })` → same shape for the remembered path, or `null`; a remembered file that no longer exists returns `{ path, error }`
  - `renderer:data-driven:clear-file({ collectionPathname })`
  - `renderer:data-driven:save-run({ collectionPathname, collectionName, startedAt, endedAt, iterationCount, items })` → `{ id }`; `items[i] = { requestUid, iterationIndex, name, relativePath, status, error, testResults, assertionResults, preRequestTestResults, postResponseTestResults, runDuration }`
  - `renderer:data-driven:list-runs({ collectionPathname })` → `[{ id, startedAt, endedAt, iterationCount, total, passed, failed, skipped }]`, newest first
  - `renderer:data-driven:export-run({ collectionPathname, id, format: 'html' | 'junit' | 'json' })` → saved path or `null` (save dialog)
  - `renderer:data-driven:open-run({ collectionPathname, id })` → writes the HTML to `os.tmpdir()` and `shell.openPath`
- `run-history.js`: `toCliResults(items, exchanges)`, `saveRun(dir, run)`, `listRuns(dir)`, `readRun(dir, id)`, `pruneRuns(dir, keep = 50)`, `MAX_STORED_BODY_BYTES = 1024 * 1024`. Run ids are `${startedAt-ms}-${random hex}`, validated by regex before any file access.

- [ ] **Step 1: Write failing tests** (`run-history.spec.js` with a temp dir and fake exchanges):
  - `toCliResults` produces the same shape as a CLI result for the same request (fixture taken from a Task 4 CLI run: compare keys and values except timings).
  - `run-history caps bodies and prunes to 50`: a 5 MB body is stored as `[body not stored: 5242880 bytes]`; saving 52 runs leaves 50, the two oldest gone.
  - `readRun` rejects an id like `../x`.
  - export: the HTML from `exportRun` for a saved run equals `generateHtmlReport(groupResultsByIteration(toCliResults(...)))` byte for byte; JUnit equals `xmlbuilder.create(buildJUnitReport(...)).end({ pretty: true })`.
  - IPC handlers reject a `collectionPathname` that is not open.
- [ ] **Step 2: Run** `npm test --workspace=packages/bruno-electron -- run-history data-driven` → FAIL.
- [ ] **Step 3: Implement** the store, the module and the handlers (exported named functions, thin `ipcMain.handle` lines). Register with `registerDataDrivenIpc(mainWindow)` after `registerGitPanelIpc`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(runner): local run history and report export`.

### Task 7: Runner UI

**Files:**
- Create: `bruno-app/src/components/RunnerResults/IterationDataControls/{index.js,StyledWrapper.js}`, `RunHistory/{index.js,StyledWrapper.js}`, `bruno-app/src/providers/App/useRunHistorySaver.js` (+ spec)
- Modify: `RunnerResults/index.jsx` and its result row component, `slices/collections/actions.js` (`runCollectionFolder`), `slices/collections/index.js` (`runFolderEvent`), `providers/App/index.js`

**Interfaces:**
- Consumes: Task 5 IPC arg and events, Task 6 channels.
- Produces: `runCollectionFolder(collectionUid, folderUid, recursive, delay, tags, selectedRequestUids, iterationOptions)`; runner items carry `iterationIndex`; `runnerResult.info.iterationCount`.

- [ ] **Step 1: Write failing tests.**
  - reducer: `request-queued` with `iterationIndex: 2` stores it on the item; `testrun-started` with `iterationCount: 3` stores it in `info` (default 1). The existing `findLast(uid)` matching stays correct because iterations run one after another; add a spec with two iterations of the same request that checks each `test-results` lands on its own iteration's item.
  - `useRunHistorySaver`: when a collection's `runnerResult.info.status` goes `started` → `ended`, it invokes `renderer:data-driven:save-run` once with items mapped to the Task 6 shape (name and relative path from the collection tree); not again on re-render.
- [ ] **Step 2: Run** `npm test --workspace=packages/bruno-app -- runFolderEvent useRunHistorySaver` → FAIL.
- [ ] **Step 3: Implement.**
  - `IterationDataControls` (testids `iteration-data-select`, `iteration-data-file`, `iteration-data-clear`, `iteration-count-input`): shows the file name, row count and columns, or the load error; count input placeholder is the row count.
  - `RunHistory` (testids `run-history-list`, `run-history-open`, `run-history-export-{html,junit,json}`): list from `list-runs`, refreshed when a run ends.
  - `RunnerResults` renders both near the existing delay input, passes `iterationOptions` to `runCollectionFolder` in Run and Run Again, shows `Iteration {current}/{count}` while running when count > 1, and an `#n` badge per row when count > 1.
  - Use existing `ui/*` components and theme tokens; follow `bruno-app-layout.md`.
- [ ] **Step 4: Run** `npm test --workspace=packages/bruno-app` → PASS.
- [ ] **Step 5: Commit** `feat(app): iteration data, iteration view and run history in the runner`.

### Task 8: End-to-end, docs and CI

**Files:**
- Create: `tests/data-driven/data-driven.spec.ts`, fixtures `tests/data-driven/fixtures/collection/` (bruno.json, one request to the e2e test server echoing a query param, a test using `bru.runner.iterationData.get`), `users.csv` (3 rows), `postman-iteration.json` (Postman collection using `pm.iterationData`), `tests/utils/page/data-driven.ts`
- Modify: `tests/utils/page/locators.ts`, `index.ts`, `.github/workflows/tests-linux.yml` (job `data-driven-e2e`), `docs/UPSTREAM-SYNC.md` (phase 2 section), spec §6 phase 2 (status + decisions above), `readme.md` feature list if it lists phases

- [ ] **Step 1: Write the e2e spec:**
  - `CSV with 3 rows runs 3 iterations with the right values`: stub `dialog.showOpenDialog` via `electronApp.evaluate` to return `users.csv`, run the collection, expect 3 rows with badges `#1..#3`, all passed, and each response showing that row's value.
  - `the remembered data file survives an app restart`.
  - `imported Postman collection with pm.iterationData passes`: import `postman-iteration.json`, run with `users.csv`, all tests pass.
  - `app and CLI HTML reports carry the same data`: export the app run as HTML and JSON (stub the save dialog), run `node packages/bruno-cli/bin/bru.js run --iteration-data users.csv --reporter-json --reporter-html` on the same fixture, and compare per iteration: request names, URLs, status codes, test names and test statuses, after removing timings, timestamps and uuids.
  - `stop during iteration 2 runs no iteration 3`.
- [ ] **Step 2: Run** `npx playwright test tests/data-driven` → PASS (fix the implementation, not the test, when it fails).
- [ ] **Step 3: Docs.** UPSTREAM-SYNC phase 2 section with the upstream-file table above; spec §6 phase 2 status and the decisions list; CI job.
- [ ] **Step 4: Full check:** `node scripts/hanuman/check-fork-invariants.js`, unit suites of common, js, converters, cli, electron, app, `npx playwright test tests/data-driven tests/git-panel`, `npm run lint` on changed files.
- [ ] **Step 5: Commit** `test(e2e): data-driven runs; docs: phase 2 sync points`, push, open the PR.

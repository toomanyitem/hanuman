# การดึงอัปเดตจาก Bruno (upstream sync)

Hanuman เป็น fork ระยะยาวของ [usebruno/bruno](https://github.com/usebruno/bruno) เราดึงอัปเดตด้วยการ **merge** (ไม่ rebase) ตามข้อ 5.4 ของ [เอกสารออกแบบ](superpowers/specs/2026-10-20-hanuman-design.md) และควร merge ทุกครั้งที่เริ่มเฟสใหม่

## ขั้นตอน

```bash
# ครั้งแรกครั้งเดียว
git remote add upstream https://github.com/usebruno/bruno.git

git fetch upstream main
git checkout -b chore/upstream-sync-$(date +%Y%m%d) origin/main
git merge upstream/main          # แก้ conflict ตามหัวข้อด้านล่าง

npm i --legacy-peer-deps         # อัปเดต package-lock.json ถ้า dependency เปลี่ยน
npm run setup
node scripts/hanuman/check-fork-invariants.js
npm test --workspace=packages/bruno-app
npm test --workspace=packages/bruno-electron
npm run dev                      # เปิดแอปดูหน้าแรก, About และ OAuth2 แบบ system browser
```

จากนั้นเปิด PR เข้า `main` แล้วให้ CI (lint + fork invariants + unit/CLI tests บน Linux) ผ่านก่อน merge

## หลักการแก้ conflict

- **ไฟล์ที่เราลบ** (upstream แก้แต่เราลบไปแล้ว) ให้ลบต่อ: `git rm <file>`
- **ไฟล์ที่เราแก้แค่ข้อความ** ให้รับของ upstream ก่อน แล้วค่อยใส่คำว่า Hanuman กลับในจุดเดิม
- **ไฟล์ที่ upstream เพิ่มใหม่** ให้ตรวจว่ามีข้อความที่ผู้ใช้เห็นว่า "Bruno" ในฐานะชื่อแอป, ลิงก์ไป `github.com/usebruno/bruno/issues` หรือการเรียก server ของ Bruno หรือไม่ ถ้ามีให้แก้ตามแนวเดียวกัน
- `check-fork-invariants.js` จะ fail ถ้า telemetry, ลิงก์ phone-home หรือชื่อแอปเดิมกลับมา

## สิ่งที่เราเปลี่ยนจาก upstream (เฟส 0)

### ไฟล์/โค้ดที่ลบ
| ไฟล์ | เหตุผล |
|---|---|
| `packages/bruno-app/src/components/Sidebar/GoldenEdition/` | popup ขายของ (upsell) + PostHog |
| `packages/bruno-app/src/providers/App/useTelemetry.js` | PostHog telemetry |
| `packages/bruno-app/src/providers/App/useChangelogOnUpdate.js` | เปิด changelog ของ Bruno ตอนเปิดแอป |
| `tests/changelog/` | e2e ของ changelog tab ข้างบน |
| dependency `posthog-node` และ `https://*.posthog.com` ใน CSP (`bruno-electron/src/index.js`) | telemetry |

### จุดที่แก้พฤติกรรม
| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `bruno-electron/src/ipc/notifications.js` | ดึงการแจ้งเตือนเฉพาะเมื่อตั้ง `HANUMAN_INFO_ENDPOINT` |
| `bruno-electron/src/utils/oauth2.js`, `ipc/network/authorize-user-in-system-browser.js` | callback เริ่มต้นเป็น loopback (`utils/oauth2-loopback-server.js` ไฟล์ใหม่) |
| `bruno-electron/src/utils/deeplink.js`, `src/index.js` | protocol `hanuman://` |
| `bruno-electron/src/utils/default-location.js` | โฟลเดอร์เริ่มต้น `~/Documents/hanuman` |
| `bruno-electron/electron-builder-config.js`, `notarize.js`, `package.json` | appId, productName, ชื่อ package, protocol, ไม่เซ็นโค้ดถ้าไม่มี identity, `afterPack: 'adhoc-sign.js'` (ไฟล์ใหม่ เซ็น ad-hoc ให้แอป mac เมื่อไม่มี Developer ID), `publish: null` (ไม่สร้าง `app-update.yml`), `author` เป็น toomanyitem (ชื่อผู้พัฒนาใน .exe และ Copyright ของแอป mac) |
| `bruno-cli/package.json` | เพิ่ม bin `hanuman` |
| `bruno-electron/src/ipc/updates.js`, `utils/update-check.js`, `utils/update-install.js` (ไฟล์ใหม่), `index.js`, `app/menu-template.js`, `store/preferences.js`, `bruno-app/.../Preferences/General`, `slices/app.js`, `bruno-app/src/providers/App/useIpcEvents.js` (toast `main:update-download-progress`) | แจ้งเวอร์ชันใหม่จาก release ของ `toomanyitem/hanuman` (preference `updates.checkAutomatically`) และบน macOS ดาวน์โหลด ตรวจ และติดตั้งทับในแอปได้ (`renderer:cancel-update-download`) |
| `scripts/build-electron.js` | รองรับ `ELECTRON_BUILDER_ARGS`, แก้บั๊ก `util.promisify(spawn)` ที่ทำให้สคริปต์จบด้วย exit 0 แม้ build ล้ม |
| `.github/workflows/*` | ปิด workflow ที่ใช้ self-hosted runner, เพิ่ม `release.yml` (กดรันเอง) และ fork-invariants ใน `lint-checks.yml` |
| ไฟล์ใหม่: `scripts/hanuman/*`, `docker/cli/`, `docker/release/` | build/release ในเครื่อง, ตั้งเวอร์ชัน, ตรวจ invariant, Docker image ของ CLI |

### แบรนด์
- ไอคอนแอปทั้งหมดใน `bruno-electron/resources/icons/`, `bruno-electron/src/about/256x256.png`, `bruno-app/public/favicon.ico`, `bruno-app/src/assets/hanuman-logo.png` และ `assets/images/hanuman-*.png` สร้างจาก `assets/brand/hanuman-logo-source.png` ด้วย `python3 scripts/hanuman/make-icons.py` (ถ้า upstream แก้ไอคอน ให้รันสคริปต์นี้ใหม่แทนการแก้ conflict ทีละไฟล์)
- `bruno-app/src/components/Bruno/index.js` re-export `components/HanumanLogo` (ถ้า upstream แก้โลโก้ ให้คงไฟล์ของเราไว้)
- `bruno-electron/src/app/about-bruno.js` (โลโก้ ชื่อ และเครดิต)
- ข้อความที่ผู้ใช้เห็นซึ่งพูดถึงตัวแอป เปลี่ยนเป็น Hanuman ราว 40 ไฟล์ใน `bruno-app/src` (ดู `git log --stat` ของ commit "rebrand app identity") ส่วนชื่อรูปแบบไฟล์ ("Bruno collection") ลิงก์ docs.usebruno.com และ API `bru.*` คงไว้ตามเดิม
- `readme.md` เป็นของ Hanuman ทั้งไฟล์ (ถ้า upstream แก้ readme ให้เก็บของเรา) ส่วน `docs/readme/*` เป็นของ upstream ไม่ได้แก้

### ไม่เปลี่ยน (ตั้งใจ)
ชื่อ package `@usebruno/*`, นามสกุล `.bru`, `bruno.json`/`opencollection.yml`, API สคริปต์ `bru.*`, ชื่อโฟลเดอร์ `packages/bruno-*` และชื่อตัวแปรภายใน เพื่อให้ merge ได้ง่าย

## สิ่งที่เปลี่ยนจาก upstream (เฟส 1 — Git UI)

โค้ดของแผง Git อยู่ในไฟล์ใหม่ทั้งหมด upstream ถูกแก้แค่จุดเสียบในตารางนี้ ถ้า merge แล้ว conflict ให้รับของ upstream ก่อน แล้วใส่บรรทัดของเรากลับในจุดเดิม

### ไฟล์ใหม่
- `bruno-electron/src/utils/git-panel/*` คำสั่ง git ของแผง (status, stage, commit, fetch/pull/push, branch, remote, stash, conflict) รันผ่าน `simple-git` ทีละคำสั่งต่อ repo
- `bruno-electron/src/ipc/git-panel.js` IPC `renderer:git-panel:*` (รับเฉพาะ path ของ collection หรือ workspace ที่เปิดอยู่)
- `bruno-electron/src/store/git-credentials.js` token ต่อ host เข้ารหัสด้วย `utils/encryption.js` (safeStorage ถ้ามี ถ้าไม่มี เช่น Linux ที่ไม่มี keyring จะใช้ AES แทน)
- `bruno-electron/tests/git-panel/*` เทสต์กับ repo จริงใน temp dir
- `bruno-app/src/components/GitPanel/*` UI ของแผง
- `tests/git-panel/*`, `tests/utils/page/git/git-panel.ts` e2e กับ bare repo ในเครื่อง

### จุดเสียบในไฟล์ upstream
| ไฟล์ | สิ่งที่เพิ่ม |
|---|---|
| `bruno-electron/src/index.js` | require และเรียก `registerGitPanelIpc()` ต่อจาก `registerGitIpc` |
| `bruno-app/src/components/RequestTabPanel/index.js` | import `GitPanel` และบล็อก `if (focusedTab.type === 'git')` |
| `bruno-app/src/components/RequestTabs/RequestTab/index.js` | `'git'` ใน `specialTabs` |
| `bruno-app/src/components/RequestTabs/RequestTab/SpecialTab.js` | `case 'git'` (ไอคอนและชื่อแท็บ) |
| `bruno-app/src/components/Sidebar/Collections/Collection/CollectionRow/index.jsx` | เมนู **Git** ในเมนู ⋯ ของ collection |
| `bruno-app/src/components/Sidebar/Sections/CollectionsSection/index.js` | เมนู **Git (workspace)** (ซ่อนใน workspace default) |
| `tests/utils/page/locators.ts`, `tests/utils/page/index.ts` | map `gitPanel` และ re-export page module |
| `.github/workflows/tests-linux.yml` | job `git-panel-e2e` รันบนทุก PR (e2e ชุดเต็มยังกดรันเอง) |
| `.gitignore` | `.omc/` (state ของเครื่องมือ AI ที่ใช้พัฒนา) |

### ถ้า upstream ปล่อย Git UI แบบ OSS
ตามข้อ 9 รายการ 9 ของเอกสารออกแบบ ให้เปลี่ยนไปใช้ของ upstream แล้วลบไฟล์ใหม่ข้างบนออก

## สิ่งที่เปลี่ยนจาก upstream (เฟส 2 — Data-driven testing และรายงาน)

โค้ดส่วนใหญ่อยู่ในไฟล์ใหม่ upstream ถูกแก้แค่จุดเสียบในตารางนี้ ถ้า merge แล้ว conflict ให้รับของ upstream ก่อน แล้วใส่บรรทัดของเรากลับในจุดเดิม

### ไฟล์ใหม่
- `bruno-common/src/runner/iteration-data/` อ่าน CSV/JSON (`parseIterationData`), แถวของแต่ละรอบ (`getIterationRow`), จำนวนรอบ (`resolveIterationCount`) และตัวคุมลำดับ request/รอบของ runner ทั้งสองฝั่ง (`nextRunnerPosition`)
- `bruno-common/src/runner/reports/junit/` ตัวสร้าง object ของ JUnit (ย้ายมาจาก `bruno-cli/src/reporters/junit.js`), `reports/group-by-iteration.ts`, `reports/html/offline-report.ts` รายงาน HTML ไฟล์เดียวที่เปิดออฟไลน์ได้ (ไม่มีไฟล์ภายนอก มี CSP `default-src 'none'`)
- `bruno-js/src/iteration-data.js` API `bru.runner.iterationData` / `iteration` / `iterationCount`
- `bruno-electron/src/utils/iteration-data.js`, `utils/run-history.js`, `store/iteration-data.js`, `ipc/data-driven.js` (`renderer:data-driven:*`)
- `bruno-app/src/components/RunnerResults/IterationDataControls/`, `RunnerResults/RunHistory/`, `hooks/useIterationDataFile/`, `hooks/useRunHistorySaver/`
- เทสต์: `bruno-cli/tests/integration/run-iterations.spec.js`, `tests/data-driven/*`, `tests/utils/page/data-driven.ts`

### จุดเสียบในไฟล์ upstream
| ไฟล์ | สิ่งที่เพิ่ม |
|---|---|
| `bruno-common/src/runner/index.ts` | export ฟังก์ชันใหม่ |
| `bruno-common/package.json` | devDependency `jsdom` (เทสต์รายงาน HTML) |
| `bruno-js/src/bru.js` | option `iteration`, `this.iterationVariables`, spread `createIterationApi` ใน `this.runner`, ชั้นตัวแปร iteration ใน `interpolate` |
| `bruno-js/src/sandbox/quickjs/shims/bru.js` | bridge `bru.runner.iterationData/iteration/iterationCount` |
| `bruno-js/src/interpolate-string.js`, `runtime/assert-runtime.js` | ชั้นตัวแปร `iterationVariables` |
| `bruno-js/src/runtime/{script,test,vars,assert}-runtime.js` | ส่ง `iteration: request?.iteration` ให้ `new Bru(...)` |
| `bruno-electron/src/ipc/network/index.js` | `renderer:run-collection-folder` รับ `iterationOptions`, `advanceRunner` ใช้ `nextRunnerPosition` (รวมทาง `continue` 3 จุด), `request.iteration`, `iterationIndex`/`iterationCount` ใน `eventData` และ `assertion-results`, `runRequest` ส่ง `item.iteration` ต่อ |
| `bruno-electron/src/ipc/network/interpolate-vars.js`, `bruno-cli/src/runner/interpolate-vars.js` | ชั้น `iterationVariables` ต่อจาก environment |
| `bruno-electron/src/index.js` | `registerDataDrivenIpc(mainWindow)` ต่อจาก `registerGitPanelIpc` |
| `bruno-electron/package.json` | dependency `xmlbuilder` (export JUnit) |
| `bruno-cli/src/commands/run.js` | `--iteration-data`, `--iteration-count`, loop ใช้ `nextRunnerPosition`, `iterationIndex` ในผล (เฉพาะเมื่อมีมากกว่า 1 รอบ) |
| `bruno-cli/src/runner/run-single-request.js` | `request.iteration = item.iteration` และชั้นตัวแปรใน prompt check |
| `bruno-cli/src/reporters/junit.js` | เรียก `buildJUnitReport` จาก common |
| `bruno-cli/src/reporters/html.js` | ใช้ `generateOfflineHtmlReport` + `groupResultsByIteration` แทน template ของ upstream |
| `bruno-cli/readme.md` | ตัวเลือกใหม่ในตาราง |
| `bruno-converters/src/utils/postman-to-bruno-translator.js`, `src/postman/postman-translations.js`, `src/utils/bruno-to-postman-translator.js` | แปลง `pm.iterationData.*`, `pm.info.iteration(Count)` ทั้งสองทาง และ `pm.setNextRequest(null)` → `bru.runner.setNextRequest(null)` (upstream แปลงเป็น `stopExecution()`) แก้เทสต์ upstream `exec-flow.test.js`, `multiline-syntax.test.js` ตาม |
| `bruno-app/.../slices/collections/actions.js` | `runCollectionFolder(..., iterationOptions)` และ toast แสดงข้อความจริงด้วย `formatIpcError` |
| `bruno-app/src/hooks/useClearStoredRunnerExchanges/index.js` | รอ `waitForRunHistorySave` ก่อนล้าง exchange ใน sqlite |
| `bruno-app/.../slices/collections/index.js` | `iterationIndex` บน runner item, `info.iterationCount` |
| `bruno-app/src/components/RunnerResults/index.jsx` | `IterationDataControls`, `RunHistory`, ตัวนับ `Iteration n/m`, badge `#n`, key ของรายการเป็น `requestUid` |
| `bruno-app/src/providers/App/index.js` | เรียก `useRunHistorySaver()` |
| `tests/utils/page/index.ts` | re-export `data-driven` |
| `.github/workflows/tests-linux.yml` | step `Run Data-driven E2E Tests` ใน job `git-panel-e2e` (รันบนทุก PR) |

### ไม่ได้แก้ (ตั้งใจ)
- `bruno-common/src/runner/reports/html/template.ts` และ `generate-report.ts` ของ upstream ยังอยู่ แต่ CLI และแอปไม่ใช้แล้ว (template นั้นโหลด Vue/naive-ui จาก unpkg.com)
- `interpolate-string.js` ฝั่ง electron/CLI (ใช้กับ proxy, cert, token URL ของ OAuth2 ใน gRPC) และ gRPC script runtime ไม่ได้รับค่าจาก CSV เพราะ gRPC/WebSocket ถูกข้ามใน collection run อยู่แล้ว

### ถ้า upstream ปล่อย data-driven แบบ OSS
ตามข้อ 9 รายการ 9 ของเอกสารออกแบบ ให้ใช้ `iterationData` ของ upstream (stub อยู่ใน `bruno-common/src/runner/types/index.ts`) แทนของเรา แล้วลบไฟล์ใหม่ข้างบนที่ซ้ำกัน

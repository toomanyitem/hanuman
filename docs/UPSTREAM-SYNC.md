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
| `bruno-electron/electron-builder-config.js`, `notarize.js`, `package.json` | appId, productName, ชื่อ package, protocol, ไม่เซ็นโค้ดถ้าไม่มี identity, `afterPack: 'adhoc-sign.js'` (ไฟล์ใหม่ เซ็น ad-hoc ให้แอป mac เมื่อไม่มี Developer ID) |
| `bruno-cli/package.json` | เพิ่ม bin `hanuman` |
| `scripts/build-electron.js` | รองรับ `ELECTRON_BUILDER_ARGS`, แก้บั๊ก `util.promisify(spawn)` ที่ทำให้สคริปต์จบด้วย exit 0 แม้ build ล้ม |
| `.github/workflows/*` | ปิด workflow ที่ใช้ self-hosted runner, เพิ่ม `release.yml` (กดรันเอง) และ fork-invariants ใน `lint-checks.yml` |
| ไฟล์ใหม่: `scripts/hanuman/*`, `docker/cli/`, `docker/release/` | build/release ในเครื่อง, ตั้งเวอร์ชัน, ตรวจ invariant, Docker image ของ CLI |

### แบรนด์
- ไอคอนแอปทั้งหมดใน `bruno-electron/resources/icons/`, `bruno-electron/src/about/256x256.png`, `bruno-app/public/favicon.ico` สร้างจาก `assets/brand/hanuman-icon.svg`
- `bruno-app/src/components/Bruno/index.js` re-export `components/HanumanLogo` (ถ้า upstream แก้โลโก้ ให้คงไฟล์ของเราไว้)
- `bruno-electron/src/app/about-bruno.js` (โลโก้ ชื่อ และเครดิต)
- ข้อความที่ผู้ใช้เห็นซึ่งพูดถึงตัวแอป เปลี่ยนเป็น Hanuman ราว 40 ไฟล์ใน `bruno-app/src` (ดู `git log --stat` ของ commit "rebrand app identity") ส่วนชื่อรูปแบบไฟล์ ("Bruno collection") ลิงก์ docs.usebruno.com และ API `bru.*` คงไว้ตามเดิม
- `readme.md` เป็นของ Hanuman ทั้งไฟล์ (ถ้า upstream แก้ readme ให้เก็บของเรา) ส่วน `docs/readme/*` เป็นของ upstream ไม่ได้แก้

### ไม่เปลี่ยน (ตั้งใจ)
ชื่อ package `@usebruno/*`, นามสกุล `.bru`, `bruno.json`/`opencollection.yml`, API สคริปต์ `bru.*`, ชื่อโฟลเดอร์ `packages/bruno-*` และชื่อตัวแปรภายใน เพื่อให้ merge ได้ง่าย

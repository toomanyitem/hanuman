# Hanuman — Design

> วันที่: 2026-10-20 · สถานะ: **อนุมัติแล้ว** ผู้ใช้สั่งให้ Friday ตัดสินใจเองและทำจนเสร็จ โดยต้องใช้ได้หลายแพลตฟอร์ม (mac/win/linux) แบบ Bruno
> ฐานโค้ด: Bruno OSS (`usebruno/bruno`, MIT) commit `dd0281d` (2026-10-19)
> ที่เก็บเอกสาร: ไฟล์นี้อยู่ที่ `~/hanuman-planning/` ชั่วคราว พอเฟส 0 สร้าง repo แล้ว ให้ย้ายไปไว้ที่ `docs/superpowers/specs/2026-10-20-hanuman-design.md` แล้ว commit *(Friday ตัดสินใจเอง)*

## 1. ที่มาและเหตุผล

ผู้ใช้ต้องการ API client ที่ใช้แทน Postman ได้ครบ เปิดให้ทั้งทีมใช้ได้ไม่จำกัดจำนวนคน ไม่จำกัด workspace และไม่ต้องจ่ายรายหัว จึงเลือกต่อยอดจาก Bruno ซึ่งเป็น open-source แบบ local-first เก็บ collection เป็นไฟล์ในเครื่อง

**ผลจากการตรวจโค้ด (สำคัญ):** repo MIT ของ Bruno **ไม่มี license check หรือ paywall ให้ปลด** ฟีเจอร์ของแพ็กเกจ Pro/Ultimate ไม่ได้อยู่ในโค้ด open-source แต่อยู่ในแอปปิดของ Bruno เอง ดังนั้นโปรเจกต์นี้คือ **การสร้างฟีเจอร์เหล่านั้นขึ้นใหม่** ใน fork ของเรา โดยมีหลักฐานดังนี้
- ไม่พบตัวจำกัดจำนวน workspace หรือจำนวนครั้ง OpenAPI sync ในโค้ด OSS
- ส่วนที่เกี่ยวกับการขายมีแค่ popup `packages/bruno-app/src/components/Sidebar/GoldenEdition/` กับ PostHog tracking
- dependency `@usebruno/*` ทุกตัวอยู่ใน `packages/` ครบ ยกเว้น `@usebruno/node-machine-id` ที่ดึงจาก npm ไม่มีโมดูลปิดถูกเสียบเข้ามา

**รูปแบบการแชร์ (ผู้ใช้เลือกแล้ว):** แชร์ผ่าน Git เท่านั้น ทุกคนเก็บ collection, environment และ workspace เป็นไฟล์ใน Git repo แล้ว push/pull กันเอง ไม่มี server กลาง ใช้กับ repo private ของเจ้าไหนก็ได้

## 2. เป้าหมาย

รอบแรกทำครบทุกเฟส 0–4 (ผู้ใช้เลือกแล้ว) และต่อด้วยเฟส 5–7 ที่ผู้ใช้สั่งเพิ่มเมื่อ 2026-10-21 โดยแต่ละเฟส ship แยกกันได้

| เฟส | สรุป |
|---|---|
| 0 | ตั้ง repo, เปลี่ยนชื่อเป็น Hanuman, ลบ upsell และ telemetry, build/release |
| 1 | Git UI แบบเต็มในแอป |
| 2 | Data-driven testing และรายงานผลในแอป |
| 3 | เชื่อมต่อ secret manager (Vault, AWS, Azure, GCP) |
| 4 | Socket.IO, MQTT และ load testing |
| 5 | Mock Server แบบเต็ม (ต่อยอดจาก beta ที่ upstream มีอยู่) |
| 6 | Monitor: รัน collection ตามเวลา แล้วแจ้งเตือน |
| 7 | API Docs แบบออฟไลน์ และเผยแพร่เป็นเว็บ static |

## 3. สิ่งที่ไม่ทำ (non-goals)

- SSO, SCIM, audit log, การจัดการผู้ใช้, license admin และ AI governance เพราะไม่มี server กลางให้ใช้
- cloud sync, การแก้ไขร่วมกันแบบ real-time, ระบบบัญชีผู้ใช้หรือ login
- Postman Flows, public API network และ marketplace
- ~~Monitor~~ ย้ายไปเป็นเฟส 6 แล้ว (ผู้ใช้สั่งเพิ่มเมื่อ 2026-10-21) แต่ยังไม่ทำ monitor แบบมี server กลางรันให้ตลอดเวลา (hosted) เหมือน Postman
- ไม่มีบริการ hosting เอกสาร API ของเราเอง ให้เผยแพร่ผ่าน static host ที่ทีมมีอยู่แล้ว (ดูเฟส 7)
- auto-update ภายในแอป: ไม่มีในรอบแรก ทีมโหลดเวอร์ชันใหม่จาก GitHub Releases เอง *(Friday ตัดสินใจเอง: repo เป็น private ระบบ update ต้องใช้ token จึงซับซ้อนเกินคุ้มสำหรับรอบแรก)*
- เซ็นโค้ด macOS/Windows: รอบแรกไม่เซ็น *(Friday ตัดสินใจเอง)* ผู้ใช้ mac ต้องคลิกขวาแล้วเลือก Open หรือรัน `xattr -dr com.apple.quarantine` ส่วน Windows จะขึ้นคำเตือน SmartScreen

## 4. สิ่งที่ห้ามเกิด (anti-goals)

ถ้าข้อใดข้อหนึ่งต่อไปนี้เกิดขึ้น ให้ถือว่างานล้มเหลวแม้ฟีเจอร์จะใช้งานได้
- **ห้ามคัดลอก แกะ หรือ decompile โค้ดจากแอปเสียเงินของ Bruno** ให้สร้างจากโค้ด OSS กับเอกสารสาธารณะเท่านั้น
- **ห้ามให้ secret จริงลง Git** ทั้ง token, password และ credential ของ secret manager ต้องเก็บไว้ในเครื่องของแต่ละคน
- **ห้ามส่งข้อมูลใด ๆ ออกนอกเครื่องโดยผู้ใช้ไม่ได้สั่ง** ต้องไม่มี telemetry และไม่มี analytics
- **ห้ามทำไฟล์ collection เดิมของ Bruno พัง** collection ที่สร้างด้วย Bruno ต้องเปิดใน Hanuman ได้ และ request ประเภทเดิม (HTTP, GraphQL, gRPC, WS) ที่บันทึกจาก Hanuman ต้องยังเปิดใน Bruno ได้ ส่วนประเภทใหม่ (Socket.IO, MQTT) เปิดใน Bruno ไม่ได้ ยอมรับข้อนี้ได้
- **ห้ามแก้โค้ด upstream จนดึงอัปเดตจาก Bruno ไม่ได้** ดูข้อ 5.4

## 5. ข้อจำกัดและการตัดสินใจหลัก

### 5.1 Repo และการแจกจ่าย (ผู้ใช้เลือกแล้ว)
- repo: `github.com/toomanyitem/hanuman` แบบ **private** สร้างเป็น repo ใหม่ ไม่ใช้ปุ่ม Fork ของ GitHub เพราะ fork ของ repo public ตั้งเป็น private ไม่ได้
- ตั้ง remote `upstream` ชี้ไปที่ `https://github.com/usebruno/bruno.git`
- ทีมงานต้องถูกเพิ่มเป็น collaborator ของ repo จึงจะโหลด Releases ได้ (บัญชี GitHub Free ให้ collaborator ของ repo private ได้ไม่จำกัด)

### 5.2 ชื่อและแบรนด์ (ผู้ใช้เลือกแล้ว: **Hanuman**)
- MIT ให้สิทธิ์แค่ตัวโค้ด ไม่รวมชื่อและโลโก้ Bruno จึงต้องเปลี่ยนชื่อทุกจุดที่ผู้ใช้มองเห็น ได้แก่ ชื่อแอป, `productName`, appId (`com.toomanyitem.hanuman`), ไอคอน, title bar, หน้า About, หน้า Welcome และเมนู
- ต้องเก็บไฟล์ `LICENSE` (MIT) ของ Bruno ไว้ และเพิ่ม `NOTICE` ที่ให้เครดิต Bruno
- โลโก้: ลิงขาวหรือหนุมานแบบเรียบ อ่านชัดที่ขนาด 16px *(Friday ตัดสินใจเอง เรื่องสไตล์ให้คนทำเลือก)*
- **ไม่เปลี่ยนชื่อภายใน** *(Friday ตัดสินใจเอง เพื่อให้ merge upstream ง่าย)* ได้แก่ ชื่อ package `@usebruno/*`, นามสกุลไฟล์ `.bru`, ไฟล์ `bruno.json`/`opencollection.yml` และ API สคริปต์ `bru.*`
- CLI: เพิ่มคำสั่ง `hanuman` และคง `bru` ไว้เป็น alias *(Friday ตัดสินใจเอง)* ไม่ publish ขึ้น npm สาธารณะ แต่แนบ tarball ไว้ใน Releases ให้ติดตั้งด้วย `npm i -g <file>.tgz`

### 5.3 สิ่งที่ลบ
- คอมโพเนนต์ `GoldenEdition` และทุกจุดที่เปิดมัน
- PostHog ทั้งหมด ได้แก่ `packages/bruno-app/src/providers/App/useTelemetry.js`, การใช้งานใน `GoldenEdition`, dependency `posthog-node` และ `connect-src https://*.posthog.com` ใน CSP ของ `packages/bruno-electron/src/index.js`
- ลิงก์ที่ชวนไปซื้อ (`usebruno.com/pricing`) ส่วนลิงก์ไปเอกสาร Bruno เก็บไว้ได้ เพราะยังใช้อ้างอิงได้จริง *(Friday ตัดสินใจเอง)*

### 5.4 การดึงอัปเดตจาก upstream
- ใช้วิธี **merge** `upstream/main` เข้า `main` ของเรา ไม่ rebase เพราะ fork นี้จะอยู่ยาว และ merge ไม่ต้องเขียนประวัติใหม่ *(Friday ตัดสินใจเอง)*
- โค้ดของฟีเจอร์ใหม่ให้อยู่ในไฟล์และโฟลเดอร์ใหม่มากที่สุด ส่วนการแก้ไฟล์เดิมให้เหลือแค่จุดเสียบ (เช่น ลงทะเบียน IPC handler, เพิ่ม tab หรือเพิ่ม request type) เพื่อให้ conflict น้อย
- เพิ่มเอกสาร `docs/UPSTREAM-SYNC.md` บอกขั้นตอน merge และรายการไฟล์ upstream ที่เราแก้
- upstream ขยับเร็ว (มี commit ทุกวัน) ควรวาง merge ไว้ทุกต้นเฟส

### 5.5 ข้อจำกัดทางเทคนิคที่มีอยู่แล้ว
- Electron ~37.6, electron-builder 24 (`packages/bruno-electron/electron-builder-config.js`), `simple-git` 3.32 (ใช้อยู่ใน `ipc/git.js`), `ws` 8.21, `@grpc/grpc-js` 1.14
- Request types ที่มีอยู่: `http-request`, `graphql-request`, `grpc-request`, `ws-request` มีโครงสร้างให้ดูเป็นตัวอย่างใน `packages/bruno-requests/src/ws`, `packages/bruno-electron/src/ipc/network/ws-event-handlers.js` และ `bruno-lang`/`bruno-filestore`/`bruno-schema`
- เทสต์: มี unit (jest) ต่อ package และ e2e ด้วย Playwright ที่ `tests/` และ `playwright.*.config.ts` ทุกฟีเจอร์ใหม่ต้องมีเทสต์ทั้งสองระดับตามแนวเดียวกัน
- เครื่องพัฒนาหลักเป็น Mac Apple Silicon
- **โควตา GitHub Actions ของ repo private มีจำกัด** และ runner macOS กับ Windows กินโควตาหลายเท่าของ Linux ให้ตรวจโควตาจริงของบัญชีก่อน แนวทางคือ CI ใช้ Linux เป็นหลัก ส่วน macOS/Windows build เฉพาะตอนออก release (tag) หรือ build mac บนเครื่องผู้ใช้เอง *(Friday ตัดสินใจเอง: รายละเอียดให้คนทำเลือกตามโควตาจริง)*

## 6. รายละเอียดแต่ละเฟส

### เฟส 0 — ตั้ง repo, rebrand และ release
- สร้าง repo ตามข้อ 5.1, push โค้ด upstream ณ commit ล่าสุด แล้วตั้ง remote `upstream`
- rebrand ตามข้อ 5.2 และลบของตามข้อ 5.3
- workflow ใหม่ `release.yml`: เมื่อ push tag `v*` ให้ build mac (arm64 และ x64), Windows (x64) และ Linux (AppImage, deb) แล้วสร้าง GitHub Release พร้อมแนบไฟล์และ CLI tarball
- workflow เทสต์เดิมของ upstream เก็บไว้ ปรับเฉพาะชื่อหรือ path ที่พังเพราะ rebrand
- README ของ Hanuman (ภาษาไทยกับอังกฤษ) อธิบายวิธีติดตั้ง วิธีเปิดแอปที่ยังไม่ได้เซ็น และวิธีแชร์ collection ผ่าน Git
- เวอร์ชันแรก `v0.1.0` *(Friday ตัดสินใจเอง)*
- **ถือว่าเสร็จเมื่อ:**
  - แอปเปิดได้บน mac, ไม่เหลือคำว่า "Bruno" ในจุดที่ผู้ใช้เห็น (ยกเว้นเครดิตใน About/NOTICE)
  - ดักจราจรเครือข่ายตอนเปิดแอปแล้ว ไม่มี request ออกไปที่ posthog หรือ analytics ใด ๆ
  - เทสต์เดิมผ่านเท่ากับ upstream ณ commit ฐาน
  - tag `v0.1.0` แล้วได้ Release ที่มีไฟล์ครบ

### เฟส 1 — Git UI แบบเต็ม
ของเดิมใน OSS มี clone, ดู URL ของ remote, list branch ของ remote, VisualDiffViewer (`packages/bruno-app/src/components/Git/VisualDiffViewer`) และหน้า connect/disconnect collection กับ Git ใน `ipc/workspace.js`

**แก้ข้อมูลจากรอบ builder check:** ใน `packages/bruno-electron/src/utils/git.js` (ประมาณ 1,860 บรรทัด) มีฟังก์ชันของ upstream เกือบครบแล้ว คือ stage/unstage/discard/commit, push/pull/fetch, ahead/behind, remote, `initGit`, stash, `abortConflictResolution`/`continueMerge` และ log/graph แต่ยังไม่ได้ลงทะเบียน IPC และยังไม่มี UI → **ให้ต่อยอดจากฟังก์ชันเหล่านี้** (ดูข้อ 9 รายการ 9)

ที่ต้องเพิ่ม (แผง Git ของแต่ละ collection หรือ workspace ที่อยู่ใน Git repo):
- **สถานะ:** รายการไฟล์ที่เปลี่ยน, ไฟล์ใหม่ และไฟล์ที่ถูกลบ เปิดดู diff ได้ โดยไฟล์ `.bru`/`.yml` ใช้ VisualDiffViewer ส่วนไฟล์อื่นใช้ text diff
- stage/unstage ทีละไฟล์หรือทั้งหมด แล้วใส่ข้อความ commit
- **pull, push และ fetch:** ตั้ง upstream branch ได้, แสดงจำนวน commit ที่ ahead/behind และเลือกได้ว่า pull แบบ merge หรือ rebase
- **branch:** ดูรายการ, สร้าง, สลับ (checkout) และลบ ถ้าสลับ branch ทั้งที่ยังมีงานค้าง ให้เตือนและเสนอ stash
- **ต่อ remote:** เพิ่ม remote หรือเปลี่ยน URL ของ origin รวมถึง `git init` ใน collection ที่ยังไม่มี Git
- **stash:** push (ใส่ข้อความได้), list, apply, pop และ drop
- **merge conflict:** แสดงรายการไฟล์ที่ชน แต่ละไฟล์ให้เลือก ours, theirs หรือแก้เองในตัวแก้ข้อความที่มีมาร์กเกอร์ conflict แล้วกด "mark resolved" ทำได้จนจบ merge หรือ rebase จากในแอป
- **สิทธิ์เข้าถึง repo private:** ใช้ git config, SSH agent และ credential helper ที่มีอยู่ในเครื่องเป็นหลัก และให้เพิ่ม Personal Access Token ต่อ host ในแอปได้ โดยเก็บผ่าน Electron `safeStorage` ไม่เขียนลงไฟล์ collection *(Friday ตัดสินใจเอง)*
- ต้องทำงานได้กับ GitHub, GitLab, Bitbucket, Gitea และ Git server ภายใน ใช้ `simple-git` ต่อจากที่มีอยู่
- ทุกคำสั่งต้องแสดง error ของ git ให้อ่านรู้เรื่อง ห้ามกลืน error เงียบ
- **ถือว่าเสร็จเมื่อ:** มี e2e ที่ใช้ bare repo ในเครื่องเป็น remote ครอบคลุม
  1. clone A แก้ request แล้ว commit และ push
  2. clone B pull แล้วเห็นการแก้นั้น
  3. A กับ B แก้จุดเดียวกัน ทำให้เกิด conflict แล้วแก้ใน UI จนจบ merge
  4. สร้างและสลับ branch
  5. stash แล้ว pop

### เฟส 2 — Data-driven testing และรายงาน
- ที่ collection runner (ทั้ง collection และ folder) เลือกไฟล์ข้อมูลได้ทั้ง CSV (มีหัวคอลัมน์) และ JSON (array ของ object) **หนึ่งแถวเท่ากับหนึ่ง iteration** โดยรันทุก request ที่เลือกครบหนึ่งรอบต่อแถว
- ตั้งค่าได้ว่าจะรันกี่ iteration (ค่าเริ่มต้นเท่ากับจำนวนแถว) และหน่วงเวลาระหว่าง request เท่าไร
- ค่าในแต่ละแถวใช้เป็นตัวแปร `{{column}}` ได้ใน request ของรอบนั้น
- ลำดับความสำคัญของตัวแปรและ API สคริปต์ (เช่น อ่านข้อมูลของ iteration ปัจจุบัน และหมายเลข iteration) **ให้ยึดพฤติกรรมของ Postman `pm.iterationData` เป็นหลัก** เพื่อให้สคริปต์ที่ import มาจาก Postman ทำงานได้ และต้องอัปเดต converter ใน `bruno-converters` ให้แปลง `pm.iterationData` ด้วย ชื่อ API ฝั่ง `bru.*` ให้คนทำตั้งเองตามแนวที่ `bruno-js` ใช้อยู่
- ไฟล์ข้อมูลอยู่ใน collection ได้ (commit ลง Git) หรืออยู่ที่ไหนในเครื่องก็ได้ ตอนเปิดแอปใหม่ ให้จำ path ล่าสุดที่ใช้ต่อ collection ไว้ในเครื่อง *(Friday ตัดสินใจเอง)*
- CLI: เพิ่ม `--iteration-data <file>` และ `--iteration-count <n>` ใน `bru run` แล้วต่อกับ reporter json, junit และ html เดิม ให้แยกผลตาม iteration
- **รายงานในแอป:**
  - หน้าผลรันแยกตาม iteration และตาม request แสดงสถานะ, เวลา, assertion และ test ที่ผ่านหรือไม่ผ่าน
  - กรองดูเฉพาะที่ fail ได้
  - export เป็น HTML (ไฟล์เดียวจบ เปิดได้แบบออฟไลน์), JUnit XML และ JSON โดยใช้ reporter ชุดเดียวกับ CLI ให้ได้ผลเหมือนกัน
- เก็บประวัติการรันไว้ในเครื่อง ไม่ลง Git เปิดดูรายงานย้อนหลังได้ จำกัดจำนวนที่เก็บ (ค่าเริ่มต้น 50 ครั้งต่อ collection) *(Friday ตัดสินใจเอง)*
- **ถือว่าเสร็จเมื่อ:**
  - CSV 3 แถวรันได้ 3 iteration ด้วยค่าที่ถูกต้อง ทั้งในแอปและ CLI
  - collection ของ Postman ที่ใช้ `pm.iterationData` import มาแล้วทำงานได้
  - รายงาน HTML จากแอปกับจาก CLI มีข้อมูลตรงกัน

### เฟส 3 — Secret managers
- ผู้ให้บริการที่รองรับ:
  - **HashiCorp Vault:** auth แบบ token และ AppRole, KV v1/v2 และ namespace ต่อยอดจาก `packages/bruno-requests/src/utils/node-vault.ts` ที่มีอยู่แต่ยังไม่มีใครเรียกใช้
  - **AWS Secrets Manager:** auth ผ่าน profile ใน `~/.aws` (รวม SSO), access key หรือ env และเลือก region ได้ รองรับ secret ที่เป็น JSON โดยดึงทีละ key
  - **Azure Key Vault:** auth ผ่าน az CLI หรือ service principal
  - **GCP Secret Manager:** auth ผ่าน ADC หรือ service account JSON และเลือก version ได้
- **รูปแบบไฟล์:** ใช้ `externalSecrets` ที่มีอยู่แล้วใน schema ของ environment (`{ type, variables: [{ name, ...providerKeys }] }`) เพื่อให้เข้ากับรูปแบบของ Bruno ใน env เก็บแค่ตัวอ้างอิง (path, ชื่อ secret หรือ key) ไม่เก็บค่าจริง
- credential สำหรับเข้า secret manager เป็นของแต่ละคน เก็บในเครื่องผ่าน `safeStorage` หรือดึงจาก CLI ของผู้ให้บริการ ห้ามลงไฟล์ collection
- ดึงค่าตอนเลือก environment หรือตอนส่ง request แคชไว้ใน memory พร้อม TTL ที่ตั้งได้ มีปุ่ม refresh และแสดงค่าแบบปิดบัง (mask)
- ถ้าดึงไม่ได้ ต้องแจ้ง error ชัดเจนว่า secret ไหนและผู้ให้บริการไหน แล้ว **ไม่ส่ง request ที่มีค่า secret ว่าง**
- CLI: รองรับผ่าน env var หรือ flag ของ credential ให้รันใน CI ได้
- **ถือว่าเสร็จเมื่อ:**
  - e2e กับ Vault dev server (Docker) ผ่าน
  - AWS ทดสอบกับ LocalStack
  - Azure และ GCP มี unit test ที่ mock SDK
  - ทดสอบกับบัญชีจริงตามที่ผู้ใช้มี (ผู้ใช้มี GCP อยู่แล้ว)
  - ตรวจว่าไม่มีค่า secret รั่วลงไฟล์ใน collection หรือลง log

### เฟส 4 — Socket.IO, MQTT และ load testing
- **Socket.IO** (request type ใหม่ `socketio-request` ใช้ `socket.io-client` v4)
  - ตั้งค่าได้: URL, namespace, path, header/auth และ transport (websocket หรือ polling)
  - emit event พร้อม argument แบบ JSON (หลายตัวได้) และรอ ack ได้
  - ฟัง event ที่กำหนดหรือทุก event
  - แสดง timeline ของข้อความเหมือน WS ที่มีอยู่ และรองรับตัวแปรกับ auth แบบเดียวกับ WS
- **MQTT** (request type ใหม่ `mqtt-request` ใช้ `mqtt` หรือ MQTT.js v5)
  - เชื่อมต่อได้ทั้ง `mqtt://`, `mqtts://`, `ws://` และ `wss://`
  - ตั้งค่าได้: client id, username/password, TLS (CA, cert, key), keepalive, clean session และ MQTT v3.1.1 หรือ v5
  - subscribe หลาย topic พร้อม QoS ได้ และ publish ได้ (กำหนด topic, payload, QoS และ retain)
  - แสดง timeline ของข้อความ
  - ต้องทดสอบกับ broker Aedes เพราะทีมใช้อยู่จริง
- request type ใหม่ทั้งสองต้องบันทึกลงไฟล์ได้ทั้งแบบ `.bru` และ `.yml`, ผ่าน schema และอยู่ใน sidebar, tab และ code generation เท่าที่ทำได้
- **Load testing**
  - เลือก collection หรือ folder ที่เป็น HTTP แล้วตั้งค่าได้: จำนวน virtual user, ระยะเวลาหรือจำนวน iteration และ ramp-up
  - มีตัวเลือก "ข้ามสคริปต์และเทสต์" เพื่อให้ยิงได้เร็วขึ้น
  - ใช้ไฟล์ข้อมูลจากเฟส 2 ได้
  - ตัวชี้วัด: RPS, latency (avg, p50, p90, p95, p99), error rate และจำนวนตาม status code โดยแสดงแยกตาม request และรวม
  - มีกราฟสดระหว่างรัน, export ผลเป็น HTML หรือ JSON และสั่งรันผ่าน CLI ได้
  - เป้าหมายคือทดสอบโหลดระดับทีม (หลักร้อย VU จากเครื่องเดียว) **ไม่ได้ตั้งใจแทน k6 หรือ JMeter** *(Friday ตัดสินใจเอง)*
  - ต้องมีปุ่มหยุดที่หยุดได้ทันที
- **ถือว่าเสร็จเมื่อ:**
  - e2e ของ Socket.IO กับ test server ใน `packages/bruno-tests` ผ่าน
  - e2e ของ MQTT กับ Aedes ผ่าน
  - load test 50 VU นาน 30 วินาทีกับ test server ได้ตัวเลขที่ตรวจสอบได้
  - กดหยุดแล้วไม่มี request ค้าง

### เฟส 5 — Mock Server แบบเต็ม
**ของที่ upstream มีอยู่แล้ว (สำรวจเมื่อ 2026-10-21):** Mock Server เป็นฟีเจอร์ beta (เปิดเป็นค่าเริ่มต้น) ผูกกับ workspace เก็บเป็นไฟล์ `<workspace>/mocks/*.yml` (`bruno-filestore/src/formats/yml/{parse,stringify}MockServer.ts`) ฝั่ง main อยู่ที่ `bruno-electron/src/app/mock-server/` และ `ipc/mock-server/` ฝั่ง UI อยู่ที่ `bruno-app/src/components/MockServer/`
- route สร้างได้จาก response example ของ collection, จาก OpenAPI (ใช้ faker สร้างครั้งเดียวตอน generate) หรือสร้างเอง
- จับคู่ route แบบตรงตัวและแบบ `:param` ได้, มี rule ตรวจ header/query/body (equals, not_equals, contains, regex, AND/OR)
- มี delay คงที่ต่อ server, request log ในหน่วยความจำ (500 รายการ) และ bind แค่ `127.0.0.1` พอร์ตเริ่มต้น 4000
- **ยังไม่มี:** response แบบ dynamic, wildcard, delay ต่อ route, fault injection, proxy/record, state, HTTPS และการรันจาก CLI

**ที่ต้องเพิ่ม** (ทุกฟิลด์ใหม่ในไฟล์ mock ต้องเป็น optional ตาม `.claude/rules/dsl-changes.md` เพื่อให้ Bruno ยังเปิดไฟล์ได้):
- **response แบบ dynamic:** ใช้ template ใน body/header ได้ เช่น `{{request.params.id}}`, `{{request.query.page}}`, `{{request.body.user.name}}`, `{{request.headers.x-id}}` และตัวแปรสุ่มต่อ request (`{{$randomUUID}}`, `{{$randomInt}}`, `{{$isoTimestamp}}` และ faker ที่ใช้อยู่แล้วใน `mock-example-generator.js`) โดยต่อยอด `interpolate` ของ `bruno-common`
- **การจับคู่ route:** เพิ่ม wildcard `*` และ `**` และให้ query string ใช้เป็นเงื่อนไขของ route ได้
- **ความหน่วงและความผิดพลาด:** delay ต่อ route พร้อม jitter (min–max), fault injection ต่อ route (อัตรา % ที่จะตอบ status ที่กำหนด, ตัดการเชื่อมต่อ หรือ timeout)
- **proxy และ record:** request ที่ไม่ตรง route ไหนให้ส่งต่อไป backend จริงได้ (passthrough) และมีโหมด record เก็บ response จริงเป็น mock route หรือเป็น example ของ collection
- **stateful CRUD (ตัวเลือก):** ประกาศ resource เช่น `/users` แล้วได้ GET list/GET by id/POST/PUT/PATCH/DELETE ที่จำข้อมูลในหน่วยความจำ มีปุ่ม reset และกำหนดข้อมูลตั้งต้นจากไฟล์ JSON ได้
- **network:** เลือก bind ที่ `0.0.0.0` ได้เพื่อแชร์ในวง LAN ของทีม (ต้องขึ้นคำเตือน), รองรับ HTTPS ด้วย cert ที่ผู้ใช้ให้มาหรือ self-signed ที่สร้างให้
- **request log:** export เป็น HAR หรือ JSON ได้ และสร้าง request ใน collection จาก log ได้
- **CLI:** `hanuman mock serve <ไฟล์ mock หรือโฟลเดอร์ workspace> [--port] [--host]` เพื่อใช้ใน CI หรือ docker-compose ของทีม frontend โดยใช้โค้ด server ร่วมกับแอป (ย้ายแกนที่ไม่ผูกกับ Electron ไปไว้ใน package ที่ CLI ใช้ได้ ตาม `.claude/rules/architecture.md`)
- ถอดออกจาก beta เมื่อครบเงื่อนไขด้านล่าง
- **ถือว่าเสร็จเมื่อ:**
  - unit test ของ template, wildcard, rule, fault injection และ CRUD ผ่าน
  - e2e: สร้าง mock จาก collection example แล้วเรียกผ่าน HTTP ได้ค่าตาม template, proxy ไป test server ใน `packages/bruno-tests` ได้ และ record แล้วได้ route ใหม่
  - `hanuman mock serve` ตอบเหมือนแอปทุกประการกับไฟล์ mock เดียวกัน
  - ไฟล์ mock ที่บันทึกจาก Hanuman ยังเปิดใน Bruno ได้ (ฟิลด์ใหม่ถูกข้ามไป ไม่ทำไฟล์พัง)

### เฟส 6 — Monitor
**ของที่ upstream มีอยู่แล้ว:** ไม่มี scheduler หรือการแจ้งเตือนใด ๆ มีแค่ `bru run` พร้อม reporter json/junit/html

**แนวคิด:** monitor คือ "การรัน collection ตามเวลา + เช็กผล + แจ้งเตือน" โดยไม่มี server กลางของเรา จึงรันได้ 3 ที่ ใช้นิยามไฟล์เดียวกัน
1. **ในแอป** ขณะแอปเปิดอยู่ (เหมาะกับการเฝ้าระหว่างพัฒนา)
2. **CLI** `hanuman monitor run <ไฟล์>` รันครั้งเดียวแล้วจบ ให้ cron ของเครื่อง, CI หรือ K8s เป็นตัวตั้งเวลา
3. **ส่งออก template** เป็น GitHub Actions (`schedule:`), GitLab CI schedule และ Kubernetes CronJob (image ที่มี CLI) ตามที่ทีมใช้อยู่จริง

- **ไฟล์นิยาม:** `<workspace>/monitors/<name>.yml` (ระดับ workspace แบบเดียวกับ `mocks/` และไม่อยู่ในโฟลเดอร์ collection เพื่อไม่ให้ collection watcher ของ Bruno เข้าใจผิดว่าเป็น request) ประกอบด้วย collection (path), folder หรือ tag ที่จะรัน, environment, cron expression พร้อม timezone, ไฟล์ข้อมูลจากเฟส 2, timeout, retry, และเงื่อนไขแจ้งเตือน (fail, กลับมาปกติ, ทุกครั้ง หรือ latency เกินเกณฑ์)
- **ช่องทางแจ้งเตือน:** Telegram, Slack, Discord, Microsoft Teams, LINE Messaging API (LINE Notify ปิดบริการไปแล้ว) และ webhook ทั่วไป (POST JSON) ข้อความมีชื่อ monitor, จำนวน request ที่ผ่าน/ไม่ผ่าน, request ที่ fail พร้อมเหตุผล และเวลา
- **secret:** token ของช่องทางแจ้งเตือนห้ามอยู่ในไฟล์ monitor ให้อ้างชื่อ env var (เช่น `HANUMAN_TELEGRAM_TOKEN`) หรือ secret profile จากเฟส 3 เท่านั้น
- **ผลรัน:** ใช้ reporter ชุดเดียวกับเฟส 2 เก็บประวัติในเครื่อง แสดงกราฟ uptime/ผ่าน-ไม่ผ่าน และ latency ตามเวลาในแอป ฝั่ง CLI เขียน JSON/JUnit/HTML ให้ CI เก็บเป็น artifact
- **ถือว่าเสร็จเมื่อ:**
  - unit test ของ cron parser, การตัดสินว่าจะแจ้งเตือนหรือไม่ และ payload ของแต่ละช่องทาง (mock HTTP)
  - e2e: monitor ในแอปรันตามเวลาจริงกับ test server แล้วส่ง webhook ไปยัง server ทดสอบในเครื่อง
  - `hanuman monitor run` ให้ผลตรงกับในแอป และ exit code ไม่เป็น 0 เมื่อ fail
  - template GitHub Actions ที่ส่งออกใช้รันได้จริงใน repo ทดสอบ

### เฟส 7 — API Docs
**ของที่ upstream มีอยู่แล้ว:** `generateApiDocsHtml` (`bruno-common/src/api-docs/index.ts`) สร้าง HTML ไฟล์เดียวที่ฝัง collection เป็น OpenCollection YAML แต่ตัว renderer **โหลดจาก `https://cdn.usebruno.com/api-docs/`** (ไม่มีโค้ดใน repo) จึงต้องต่อเน็ตและพึ่ง server ของ Bruno, ธีมล็อกเป็น light, ใช้ได้จากแอป (`GenerateDocumentation`) และ `bru docs generate` ส่วน package `bruno-docs` เป็นแค่ placeholder

**ที่ต้องเพิ่ม:**
- **renderer ของเราเอง ทำงานออฟไลน์:** package ใหม่ `packages/hanuman-docs` (React หรือ vanilla ที่ bundle เป็นไฟล์เดียว) แล้วให้ `generateApiDocsHtml` ใช้ option `rendererBaseUrl`/inline bundle ที่มีอยู่แล้ว ไม่ต้องแก้โค้ด upstream มาก **ห้ามดึงหรือคัดลอก bundle จาก CDN ของ Bruno** เพราะไม่ใช่โค้ด MIT ใน repo
- **เนื้อหา:** sidebar ตาม folder, ค้นหา (client-side), รายละเอียด request (method, URL, params, headers, body, auth แบบไม่โชว์ secret), docs markdown ของ collection/folder/request, response example, code snippet หลายภาษา และสลับ environment ได้ (ค่า secret ถูกปิดเสมอ)
- **รูปแบบผลลัพธ์:** HTML ไฟล์เดียว (ส่งต่อทางแชตหรืออีเมลได้) และ static site หลายหน้า (เหมาะกับ collection ใหญ่)
- **ธีมและแบรนด์:** light/dark/ตามระบบ, ใส่โลโก้ ชื่อ และสีหลักของทีมได้
- **OpenAPI:** ส่งออก OpenAPI 3.1 ได้ทั้งในแอปและ CLI (`hanuman docs openapi`) โดยย้าย exporter `bruno-app/src/utils/exporters/openapi-spec.js` ไปไว้ใน `bruno-converters` ให้ CLI ใช้ร่วมได้
- **เผยแพร่:** ไม่มี hosting ของเรา ให้มี template CI สำหรับ GitHub Pages, GitLab Pages และ static host ทั่วไป (S3/GCS/nginx) และให้ `hanuman docs generate --watch` ใช้ดูตัวอย่างในเครื่องได้
- **Try it (ตัวเลือก):** ส่ง request จากหน้าเอกสารได้ ปิดเป็นค่าเริ่มต้น และแจ้งเรื่อง CORS ให้ชัด
- **ถือว่าเสร็จเมื่อ:**
  - ไฟล์ HTML ที่สร้างได้เปิดแบบออฟไลน์ได้ครบ (ทดสอบด้วย Playwright โดยบล็อกเน็ตทั้งหมด)
  - ไม่มีค่า secret ของ environment หลุดไปในเอกสาร (มีเทสต์ตรวจ)
  - ผลจากแอปและจาก CLI เหมือนกัน
  - OpenAPI ที่ส่งออกผ่าน validator และ import กลับเข้ามาแล้วได้ request ครบ

## 7. ลำดับและวิธีส่งมอบ
- ลำดับคือ 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 แต่ละเฟสมีแผน, branch, PR, review และ verify ของตัวเอง
- เฟส 6 ต้องใช้ reporter และไฟล์ข้อมูลจากเฟส 2 และ secret profile จากเฟส 3 จึงต้องทำหลังสองเฟสนั้น ส่วนเฟส 5 และ 7 ไม่ขึ้นกับเฟสอื่น ถ้าทีมต้องใช้ก่อนสลับลำดับขึ้นมาได้
- จบแต่ละเฟสแล้วออก release (`v0.1`, `v0.2`, …) ให้ทีมเริ่มใช้ได้ทันที
- ต้นแต่ละเฟสให้ merge upstream ก่อน (ข้อ 5.4)

## 8. สิ่งที่ให้คนทำตัดสินใจเอง
- library ที่เอกสารนี้ไม่ได้ระบุ, โครงสร้างโมดูลภายใน และชื่อ API สคริปต์ (ตามข้อจำกัดในเฟส 2)
- หน้าตา UI ให้ทำตามแนวที่ Bruno มีอยู่ (คอมโพเนนต์, theme, StyledWrapper)
- รายละเอียดเทสต์และ fixture
- การจัด CI ให้พอดีกับโควตาจริง

## 9. สิ่งที่ Friday ตัดสินใจเอง (ให้ผู้ใช้ตรวจ)
1. ไม่เปลี่ยนชื่อภายใน (`@usebruno/*`, `.bru`, `bru.*`) เพื่อให้ merge upstream ง่าย
2. CLI ใช้ชื่อ `hanuman` และคง `bru` เป็น alias, แจกเป็น tarball ใน Releases
3. ไม่เซ็นโค้ด และไม่มี auto-update ในรอบแรก
4. ใช้ merge upstream ไม่ใช้ rebase
5. เก็บ token ของ Git และ credential ของ secret manager ผ่าน Electron `safeStorage`
6. เก็บประวัติรายงานในเครื่อง 50 ครั้งต่อ collection
7. load test เน้นระดับทีม ไม่แทน k6
8. เวอร์ชันแรก `v0.1.0`

**ตัดสินใจเพิ่มหลังรอบ builder check (2026-10-20):**

9. **ใช้ seam ที่ upstream มีอยู่แล้วก่อนเสมอ** ได้แก่ `utils/git.js`, stub `iterationData` ใน `packages/bruno-common/src/runner/types/index.ts` และ parse/stringify ของ `externalSecrets` ถ้าวันหนึ่ง upstream ปล่อยฟีเจอร์เดียวกันเป็น OSS ตอน merge ให้เปลี่ยนไปใช้ของ upstream แล้วลบของเราทิ้ง เพื่อไม่ให้ fork แยกทางไปไกล
10. **รูปแบบตัวอ้างอิง secret:**
    - `externalSecrets.type` คือชื่อ **provider profile** (เช่น `my-vault`) ไม่ใช่ชนิดผู้ให้บริการ
    - ตัวแปรแต่ละตัวเก็บ `name` คู่กับ `ref` เป็น string เดียวในรูปแบบ `<path หรือชื่อ secret>[#<json key>][@<version>]` ทั้งไฟล์ `.yml` และ `.bru` (`.bru` เก็บได้แค่ name: value อยู่แล้ว) จึงไม่ต้องแก้ grammar ของ `.bru`
    - ไม่ได้ตั้งใจให้เข้ากับรูปแบบของ Bruno รุ่นเสียเงิน เพราะรู้ได้ก็ต่อเมื่อไปแกะแอปเสียเงิน ซึ่งขัดกับ anti-goal
11. **หนึ่ง environment ใช้ได้หนึ่ง provider profile** ตาม schema
    - การตั้งค่าที่ไม่ลับ (address, namespace, mount, region, AWS profile, ชื่อ vault, GCP project) กับ credential เก็บไว้ใน **profile ในเครื่องของแต่ละคน** (Preferences)
    - export/import profile เป็นไฟล์ JSON ได้ โดยไม่รวม credential เพื่อให้แชร์ในทีมได้
    - CLI อ่าน profile ได้จาก `--secret-profiles <file>` หรือจาก env `HANUMAN_SECRET_<PROFILE>_<KEY>`
12. **Git panel ผูกกับ repo ที่ collection หรือ workspace อยู่**
    - ถ้า collection อยู่ในโฟลเดอร์ย่อยของ repo ใหญ่ (เช่น repo โค้ดของแอป) ให้คำสั่ง status, stage, discard, stash และรายการ conflict จำกัดอยู่ใน path ของ collection (pathspec)
    - branch, checkout, pull และ push เป็นคำสั่งระดับทั้ง repo โดยธรรมชาติ ให้ขึ้นคำเตือนว่ามีผลกับทั้ง repo
    - รองรับรูปแบบ workspace repo ที่มี collection เป็น repo แยก ตามที่ upstream มีอยู่ (`utils/workspace-config.js`)
13. **อยู่ร่วมกับ Bruno ได้**
    - Hanuman ลงทะเบียน protocol `hanuman://` แทน `bruno://` เพื่อไม่แย่ง handler จาก Bruno ที่ติดตั้งอยู่
    - user-data แยกเป็นของตัวเอง มีเมนู "นำเข้าการตั้งค่าจาก Bruno" (preferences และรายการ workspace/collection ที่เปิดล่าสุด) ทำแบบ best-effort
    - ไฟล์ Socket.IO/MQTT ต้องมี block ที่ Bruno ไม่รู้จัก เพื่อให้ Bruno ปฏิเสธการเปิดไฟล์ ไม่ใช่เปิดเป็น HTTP แล้วบันทึกทับจนข้อมูลหาย
14. **OAuth2 ผ่าน system browser:** เปลี่ยนค่าเริ่มต้นของ callback จาก `https://oauth.usebruno.com/callback` เป็น loopback ในเครื่อง (`http://127.0.0.1:<port>/callback` ตาม RFC 8252) และให้ผู้ใช้กำหนด URL เองได้ ส่วนโหมดหน้าต่างในแอป (ค่าเริ่มต้น) เหมือนเดิม
15. **Socket.IO รองรับ server v3/v4 เท่านั้น** (`socket.io-client` v4) ไม่รองรับ v2
16. **ต้องลบการเชื่อมต่อขาออกเพิ่ม:** `https://appinfo.usebruno.com` ที่เรียกทุกครั้งที่เปิดแอป (`ipc/notifications.js`), การเช็ก changelog/version จาก server ของ Bruno และ host ภายนอกอื่นที่ตรวจเจอ
17. **CI:**
    - workflow เทสต์ของ upstream ใช้ self-hosted runner ใน repo ใหม่จะค้างคิวตลอด จึงเปลี่ยนเป็น `workflow_dispatch` หรือย้ายไปใช้ `ubuntu-latest`
    - `npm-bru-cli.yml` (publish ขึ้น npm) กับ benchmarks ให้ปิด
    - baseline ของเทสต์วัดเองในเครื่องบน commit ฐานก่อนเริ่มแก้
18. **Build:**
    - mac (arm64 และ x64) build ในเครื่องนี้
    - Windows build บน CI (`windows-latest` เฉพาะตอน release)
    - Linux build บน CI (`ubuntu-latest`)
    - ไม่ทำ snap
    - ถ้าไม่มี env var สำหรับเซ็น ให้ `notarize.js` และการเซ็นข้ามไปเอง
    - `publish` ของ electron-builder ชี้ไปที่ `toomanyitem/hanuman`

**ตัดสินใจเพิ่มตอนลงมือเฟส 0 (2026-10-21):**

19. **OAuth2 loopback:** callback เริ่มต้นคือ `http://127.0.0.1:9876/callback` (พอร์ตคงที่ เพราะผู้ให้บริการหลายเจ้าต้องลงทะเบียน redirect URI แบบตรงตัว) listener เปิดเฉพาะตอนรอ callback แล้วปิดทันที flow แบบ implicit ใช้หน้าเว็บส่ง fragment กลับมาเป็น query ถ้าผู้ใช้ตั้ง callback ที่ไม่ใช่ loopback ให้ใช้ protocol handler (`hanuman://`) แบบเดิม
20. **โฟลเดอร์เริ่มต้น** ของ workspace/collection ใหม่คือ `~/Documents/hanuman` (Bruno ใช้ `~/Documents/bruno`)
21. **การแจ้งเตือนในแอป** (`ipc/notifications.js`) จะดึงก็ต่อเมื่อตั้ง `HANUMAN_INFO_ENDPOINT` ไว้เท่านั้น
22. **โลโก้:** หน้าหนุมานขนขาว สวมชฎาทองประดับทับทิม ลายหน้าสีแดง บนพื้นสีน้ำเงิน ไฟล์ต้นฉบับคือ `assets/brand/hanuman-logo-source.png` (สี่เหลี่ยมจัตุรัสเต็มกรอบ) ไอคอนและโลโก้ในแอปทุกจุดสร้างจากไฟล์นี้ด้วย `scripts/hanuman/make-icons.py` คอมโพเนนต์ `components/Bruno` เปลี่ยนเป็น re-export ของ `components/HanumanLogo` เพื่อไม่ต้องแก้จุดที่ upstream import
23. **ข้อความที่ยังคงคำว่า Bruno โดยตั้งใจ:** ชื่อรูปแบบไฟล์ ("Bruno collection", "Bruno's native file format"), ลิงก์ไปเอกสาร docs.usebruno.com, ค่า `exportedUsing` ในไฟล์ export, marker ใน `.gitignore` ที่ upstream จัดการ, prompt ของ AI ที่อธิบาย API `bru.*` และเครดิตใน About/NOTICE
24. **ไฟล์ติดตั้งและการแจ้งเวอร์ชันใหม่:** ไฟล์ติดตั้งเผยแพร่ใน repo public แยก `toomanyitem/hanuman-releases` ส่วนโค้ดยังเป็น private แอปเช็กเวอร์ชันใหม่จาก GitHub API ของ repo นั้น (ไม่ต้องฝัง token) เช็กเมื่อผู้ใช้สั่งผ่านเมนู/ปุ่ม หรือตอนเปิดแอปถ้าผู้ใช้เปิด `updates.checkAutomatically` เอง (ค่าเริ่มต้นปิด ตามหลักไม่ส่งข้อมูลออกโดยไม่สั่ง) แสดงแค่แจ้งเตือนและเปิดหน้าดาวน์โหลด ยังไม่ติดตั้งเอง เพราะ macOS ต้องเซ็นโค้ดก่อนถึงจะอัปเดตตัวเองได้


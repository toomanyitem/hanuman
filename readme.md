<br />
<img src="assets/images/hanuman-logo.png" width="96"/>

# Hanuman

API client แบบ open-source ที่ต่อยอดจาก [Bruno](https://github.com/usebruno/bruno) (MIT) เก็บ collection เป็นไฟล์ในเครื่อง แชร์งานกับทีมผ่าน Git ใช้ได้ไม่จำกัดจำนวนคนและไม่ต้องจ่ายรายหัว

An open-source API client built on [Bruno](https://github.com/usebruno/bruno) (MIT). Collections live as plain files on disk and are shared through Git, with no seat limits and no account.

[ภาษาไทย](#ภาษาไทย) · [English](#english)

---

## ภาษาไทย

### ทำอะไรได้บ้าง
- ใช้ได้ทุกอย่างที่ Bruno ทำได้: HTTP, GraphQL, gRPC, WebSocket, สคริปต์และเทสต์, environment, collection runner, CLI, Mock Server, สร้างเอกสาร API และ import จาก Postman, Insomnia, OpenAPI
- **ไม่มี telemetry และไม่มี analytics** แอปไม่ส่งข้อมูลออกนอกเครื่อง เว้นแต่คุณสั่ง (เช่น ส่ง request)
- OAuth2 ผ่าน system browser รับ callback ที่ `http://127.0.0.1:9876/callback` ในเครื่อง ไม่ผ่าน server ภายนอก
- ติดตั้งคู่กับ Bruno ได้ (ใช้ `hanuman://` และโฟลเดอร์ข้อมูลแยกกัน)
- ฟีเจอร์ที่จะเพิ่มต่อไปดูได้ใน [เอกสารออกแบบ](docs/superpowers/specs/2026-10-20-hanuman-design.md): Git UI แบบเต็ม, data-driven testing, secret manager, Socket.IO/MQTT, load test, Mock Server แบบเต็ม, Monitor และ API Docs แบบออฟไลน์

### ติดตั้ง
ดาวน์โหลดจากหน้า [Releases](https://github.com/toomanyitem/hanuman/releases) (ต้องเป็น collaborator ของ repo นี้)

| ระบบ | ไฟล์ |
|---|---|
| macOS (Apple Silicon) | `hanuman_<version>_arm64_mac.dmg` |
| macOS (Intel) | `hanuman_<version>_x64_mac.dmg` |
| Windows | `hanuman_<version>_x64_win.exe` |
| Linux | `.AppImage` หรือ `.deb` |

**แอปยังไม่ได้เซ็นโค้ด** จึงต้องทำเพิ่มครั้งแรก:
- **macOS:** คลิกขวาที่แอปแล้วเลือก **Open** หรือรัน `xattr -dr com.apple.quarantine /Applications/Hanuman.app`
- **Windows:** ถ้าขึ้น SmartScreen ให้กด **More info → Run anyway**
- **Linux (AppImage):** `chmod +x hanuman_*.AppImage` แล้วเปิดได้เลย

**CLI:** ดาวน์โหลดไฟล์ `.tgz` จาก Releases แล้วรัน `npm i -g ./usebruno-cli-*.tgz` จะได้คำสั่ง `hanuman` (และ `bru`)

### แชร์ collection กับทีมผ่าน Git
1. สร้าง workspace หรือ collection ในโฟลเดอร์ที่เป็น Git repo (หรือ `git init` ในโฟลเดอร์นั้น)
2. commit และ push ไฟล์ `.yml`/`.bru` ขึ้น repo ของทีม (GitHub, GitLab, Bitbucket, Gitea หรือ server ภายในก็ได้)
3. เพื่อนร่วมทีม clone repo แล้วเปิด collection ใน Hanuman
4. **อย่า commit secret** ให้เก็บค่าลับไว้ในไฟล์ `.env` ของ collection (ใส่ไว้ใน `.gitignore`) หรือตั้งเป็น secret variable ใน environment

### พัฒนาต่อ
```bash
nvm use                     # Node v22
npm i --legacy-peer-deps
npm run setup               # build shared packages
npm run dev                 # รันแอปแบบ dev
```
รายละเอียดเพิ่มเติม: [contributing.md](contributing.md), [CODING_STANDARDS.md](CODING_STANDARDS.md) และ [docs/UPSTREAM-SYNC.md](docs/UPSTREAM-SYNC.md) (วิธีดึงอัปเดตจาก Bruno)

### ออก release
1. push tag เช่น `git tag v0.1.0 && git push origin v0.1.0`
2. workflow [`release.yml`](.github/workflows/release.yml) จะ build ทั้ง macOS, Windows, Linux และ CLI แล้วสร้าง Release ให้อัตโนมัติ
3. runner macOS กินโควตา Actions ของ repo private มาก ถ้าจะ build mac เองในเครื่อง ให้ตั้ง repository variable `HANUMAN_SKIP_MAC_BUILD=true` แล้วรัน:
   ```bash
   node scripts/hanuman/set-version.js v0.1.0
   npm run build:web
   ELECTRON_BUILDER_ARGS="--mac dmg zip --x64 --arm64 --publish never" node scripts/build-electron.js
   gh release upload v0.1.0 packages/bruno-electron/out/*.dmg packages/bruno-electron/out/*.zip
   ```

---

## English

### What you get
- Everything Bruno does: HTTP, GraphQL, gRPC, WebSocket, scripts and tests, environments, the collection runner, the CLI, the mock server, API docs generation, and Postman/Insomnia/OpenAPI import.
- **No telemetry or analytics.** Nothing leaves your machine unless you ask (for example, by sending a request).
- System-browser OAuth2 uses a local loopback callback (`http://127.0.0.1:9876/callback`) instead of a vendor-hosted redirect.
- Installs side by side with Bruno (its own `hanuman://` protocol and data folder).
- Roadmap: see the [design spec](docs/superpowers/specs/2026-10-20-hanuman-design.md) — full Git UI, data-driven testing, secret managers, Socket.IO/MQTT, load testing, a full mock server, monitors, and offline API docs.

### Install
Download from [Releases](https://github.com/toomanyitem/hanuman/releases) (you must be a collaborator on this repository).

Builds are **unsigned**:
- **macOS:** right-click the app and choose **Open**, or run `xattr -dr com.apple.quarantine /Applications/Hanuman.app`.
- **Windows:** on the SmartScreen prompt choose **More info → Run anyway**.
- **Linux (AppImage):** `chmod +x hanuman_*.AppImage`.

**CLI:** download the `.tgz` from Releases and run `npm i -g ./usebruno-cli-*.tgz` to get the `hanuman` (and `bru`) command.

### Share collections through Git
Keep the workspace or collection in a Git repository, commit the `.yml`/`.bru` files and push to any Git host. Teammates clone and open the collection. Keep secrets in the collection's git-ignored `.env` file or in secret environment variables — never commit them.

### Development
```bash
nvm use && npm i --legacy-peer-deps && npm run setup && npm run dev
```
See [contributing.md](contributing.md), [CODING_STANDARDS.md](CODING_STANDARDS.md) and [docs/UPSTREAM-SYNC.md](docs/UPSTREAM-SYNC.md).

### Releasing
Push a `v*` tag; [`release.yml`](.github/workflows/release.yml) builds macOS, Windows, Linux and the CLI bundle and publishes a GitHub Release. Set the repository variable `HANUMAN_SKIP_MAC_BUILD=true` to build macOS locally instead (commands above).

---

## License & credits
Hanuman is a fork of [Bruno](https://github.com/usebruno/bruno) © Anoop M D, Anusree P S and contributors, under the [MIT License](license.md). See [NOTICE](NOTICE). Hanuman is not affiliated with or endorsed by Bruno Software Inc.

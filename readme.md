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
- แจ้งเมื่อมีเวอร์ชันใหม่: เมนู **Help → Check for Updates…** หรือ **Preferences → General → Updates** (เช็กอัตโนมัติตอนเปิดแอปต้องเปิดเอง ค่าเริ่มต้นปิด) แอปจะถาม GitHub ว่า release ล่าสุดคือเวอร์ชันอะไร ไม่ส่งข้อมูลอื่น
- ฟีเจอร์ที่จะเพิ่มต่อไปดูได้ใน [เอกสารออกแบบ](docs/superpowers/specs/2026-10-20-hanuman-design.md): Git UI แบบเต็ม, data-driven testing, secret manager, Socket.IO/MQTT, load test, Mock Server แบบเต็ม, Monitor และ API Docs แบบออฟไลน์

### ติดตั้ง
ดาวน์โหลดจากหน้า [Releases](https://github.com/toomanyitem/hanuman/releases) ของ repo นี้

| ระบบ | ชิป | ไฟล์ |
|---|---|---|
| macOS | Apple Silicon | `hanuman_<version>_arm64_mac.dmg` (หรือ `.pkg`, `.zip`) |
| macOS | Intel | `hanuman_<version>_x64_mac.dmg` (หรือ `.pkg`, `.zip`) |
| Windows | x64 และ ARM64 | `hanuman_<version>_win.exe` (ตัวเดียวเลือกชิปให้เอง) หรือ `_x64_win.exe` / `_arm64_win.exe` (ไฟล์เล็กกว่า) |

ตอนนี้ release มีเฉพาะ **macOS และ Windows** ส่วน Linux, snap และ CLI ยังไม่มีไฟล์ติดตั้ง ถ้าต้องใช้ให้ build เองจาก source (ดูหัวข้อ [ออก release](#ออก-release))

**แอปยังไม่ได้เซ็นโค้ด** จึงต้องทำเพิ่มครั้งแรก:
- **macOS:** ลาก Hanuman จาก dmg ไปไว้ที่ Applications แล้วรันคำสั่งนี้ใน Terminal ก่อนเปิดครั้งแรก ไม่อย่างนั้น macOS จะไม่ยอมเปิดแอปที่ไม่ได้เซ็นด้วย Apple Developer ID
  ```bash
  xattr -d com.apple.quarantine /Applications/Hanuman.app
  ```
- **Windows:** ถ้าขึ้น SmartScreen ให้กด **More info → Run anyway**

**CLI:** ยังไม่มีใน release build เองได้ด้วย `scripts/hanuman/release-local.sh <tag> cli` จะได้ `dist/release/<tag>/hanuman-cli_<version>.tgz` แล้วรัน `npm i -g ./dist/release/<tag>/hanuman-cli_<version>.tgz` จะได้คำสั่ง `hanuman` (และ `bru`) ใช้ได้ทุกระบบที่มี Node.js 22

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
**ทางหลัก: GitHub Actions** repo นี้เป็น public จึงใช้ runner ของ GitHub ได้ฟรีทุกระบบ

1. สร้าง tag ที่ commit ที่จะออก แล้ว push
   ```bash
   git tag v0.1.1 && git push origin v0.1.1
   ```
2. รัน workflow [`release.yml`](.github/workflows/release.yml) ที่แท็บ **Actions → Release → Run workflow** ใส่ tag แล้วเลือก `platforms`
   - `all`: macOS, Windows, Linux, snap, CLI tarball และ Docker image ของ CLI (`ghcr.io/toomanyitem/hanuman-cli`)
   - `macOS + Windows` หรือ `Windows`: เฉพาะที่เลือก

   หรือสั่งจาก terminal: `gh workflow run release.yml -f tag=v0.1.1 -f platforms='macOS + Windows'`
3. workflow สร้าง release ใน repo นี้แล้ว publish ทันที (ถ้ามี release ของ tag นั้นอยู่แล้วจะอัปโหลดไฟล์เพิ่มเข้าไป) แอปที่ติดตั้งไว้จะเห็นเวอร์ชันใหม่จาก release นี้

**build ในเครื่อง** ด้วย [`scripts/hanuman/release-local.sh`](scripts/hanuman/release-local.sh) (ต้อง `gh auth login` ไว้ก่อน)
```bash
npm i --legacy-peer-deps && npm run setup              # ครั้งแรกครั้งเดียว
scripts/hanuman/release-local.sh v0.1.1 mac --upload   # บน Mac: macOS (Intel + Apple Silicon)
```
บนเครื่อง Linux x86_64 build Linux + Windows + CLI ได้
```bash
sudo dpkg --add-architecture i386 && sudo apt-get update
sudo apt-get install rpm wine wine64 wine32:i386
scripts/hanuman/release-local.sh v0.1.1 linux win cli --upload
```
- `--upload` สร้าง release แบบ **draft** ใน repo นี้ถ้ายังไม่มี แล้วอัปโหลดไฟล์ (รันซ้ำได้ จะแทนที่ไฟล์เดิม) พอครบแล้วค่อยกด **Publish** บนหน้า GitHub แอปที่ติดตั้งไว้จะเห็นเวอร์ชันใหม่หลัง Publish เท่านั้น
- ไฟล์ที่ build ได้อยู่ที่ `dist/release/<tag>/` แอป mac ที่ไม่มี Developer ID จะถูกเซ็นแบบ ad-hoc ให้อัตโนมัติ เพื่อให้เปิดบน Apple Silicon ได้
- **Windows build ใน Docker บน Mac ชิป Apple ไม่ได้** ([`release-docker.sh`](scripts/hanuman/release-docker.sh)): ถ้าเปิด Rosetta ใน Docker Desktop wine จะรันตัวติดตั้งของ NSIS ไม่ได้ (`c0000018`) ถ้าปิด Rosetta (QEMU) ตัว `app-builder` ของ electron-builder จะ crash (`fatal error: lfstack.push`) ให้ใช้ GitHub Actions แทน

---

## English

### What you get
- Everything Bruno does: HTTP, GraphQL, gRPC, WebSocket, scripts and tests, environments, the collection runner, the CLI, the mock server, API docs generation, and Postman/Insomnia/OpenAPI import.
- **No telemetry or analytics.** Nothing leaves your machine unless you ask (for example, by sending a request).
- System-browser OAuth2 uses a local loopback callback (`http://127.0.0.1:9876/callback`) instead of a vendor-hosted redirect.
- Installs side by side with Bruno (its own `hanuman://` protocol and data folder).
- Update notices: **Help → Check for Updates…** or **Preferences → General → Updates** (the check at startup is opt-in). The app only asks GitHub for the latest release of `toomanyitem/hanuman`.
- Roadmap: see the [design spec](docs/superpowers/specs/2026-10-20-hanuman-design.md) — full Git UI, data-driven testing, secret managers, Socket.IO/MQTT, load testing, a full mock server, monitors, and offline API docs.

### Install
Download from this repository's [Releases](https://github.com/toomanyitem/hanuman/releases).

Releases currently ship **macOS and Windows**: macOS Intel and Apple Silicon (`hanuman_<version>_x64_mac.dmg` / `_arm64_mac.dmg`, or `.pkg`, `.zip`), and Windows as one installer for x64 and ARM64 (`hanuman_<version>_win.exe`) or a smaller one per architecture (`_x64_win.exe`, `_arm64_win.exe`). There are no Linux, snap or CLI downloads yet; build them from source (see [Releasing](#releasing)).

Builds are **unsigned**:
- **macOS:** drag Hanuman from the dmg to Applications, then run this once in Terminal before the first launch; otherwise macOS refuses to open an app that is not signed with an Apple Developer ID:
  ```bash
  xattr -d com.apple.quarantine /Applications/Hanuman.app
  ```
- **Windows:** on the SmartScreen prompt choose **More info → Run anyway**.

**CLI:** not in the releases yet. `scripts/hanuman/release-local.sh <tag> cli` builds `dist/release/<tag>/hanuman-cli_<version>.tgz`; install it with `npm i -g ./dist/release/<tag>/hanuman-cli_<version>.tgz` to get the `hanuman` (and `bru`) command on any system with Node.js 22.

### Share collections through Git
Keep the workspace or collection in a Git repository, commit the `.yml`/`.bru` files and push to any Git host. Teammates clone and open the collection. Keep secrets in the collection's git-ignored `.env` file or in secret environment variables — never commit them.

### Development
```bash
nvm use && npm i --legacy-peer-deps && npm run setup && npm run dev
```
See [contributing.md](contributing.md), [CODING_STANDARDS.md](CODING_STANDARDS.md) and [docs/UPSTREAM-SYNC.md](docs/UPSTREAM-SYNC.md).

### Releasing
The usual path is GitHub Actions, which is free for this public repository: push a tag (`git tag v0.1.1 && git push origin v0.1.1`), then run the [`release.yml`](.github/workflows/release.yml) workflow from the Actions tab (or `gh workflow run release.yml -f tag=v0.1.1 -f platforms='macOS + Windows'`). `platforms` is `all` (macOS, Windows, Linux, the snap, the CLI tarball and the `ghcr.io/toomanyitem/hanuman-cli` images), `macOS + Windows`, or `Windows`. The workflow creates and publishes the release in this repository, or adds the files to it if it already exists; installed apps see the new version from there.

To build on your own machine, use [`scripts/hanuman/release-local.sh`](scripts/hanuman/release-local.sh) `<tag> <targets> --upload`: a Mac builds macOS Intel/Apple Silicon; an x86_64 Linux machine builds Linux x64/arm64, Windows (via wine) and the CLI. `--upload` creates a draft release in this repository; publish it once every platform is attached (installed apps only see published releases). On an Apple Silicon Mac, Windows cannot be built in Docker ([`release-docker.sh`](scripts/hanuman/release-docker.sh)): under Docker Desktop's Rosetta emulation wine cannot run the NSIS installer (`c0000018`), and under QEMU electron-builder's `app-builder` crashes (`fatal error: lfstack.push`).

---

## License & credits
Hanuman is a fork of [Bruno](https://github.com/usebruno/bruno) © Anoop M D, Anusree P S and contributors, under the [MIT License](license.md). See [NOTICE](NOTICE). Hanuman is not affiliated with or endorsed by Bruno Software Inc.

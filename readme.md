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
ดาวน์โหลดจากหน้า [Releases](https://github.com/toomanyitem/hanuman-releases/releases) (repo แยกที่เปิดเป็น public ไว้สำหรับไฟล์ติดตั้งโดยเฉพาะ)

| ระบบ | ชิป | ไฟล์ |
|---|---|---|
| macOS | Apple Silicon | `hanuman_<version>_arm64_mac.dmg` (หรือ `.pkg`, `.zip`) |
| macOS | Intel | `hanuman_<version>_x64_mac.dmg` (หรือ `.pkg`, `.zip`) |
| Windows | x64 และ ARM64 | `hanuman_<version>_win.exe` (ตัวเดียวเลือกชิปให้เอง) หรือ `_x64_win.exe` / `_arm64_win.exe` (ไฟล์เล็กกว่า) |

ตอนนี้ release มีเฉพาะ **macOS และ Windows** ส่วน Linux, snap และ CLI ยังไม่มีไฟล์ติดตั้ง ถ้าต้องใช้ให้ build เองจาก source (ดูหัวข้อ [ออก release](#ออก-release))

**แอปยังไม่ได้เซ็นโค้ด** จึงต้องทำเพิ่มครั้งแรก:
- **macOS:** เปิดแอปหนึ่งครั้ง ถ้าขึ้นว่าเปิดไม่ได้ ให้ไปที่ **System Settings → Privacy & Security** แล้วกด **Open Anyway** หรือรัน `xattr -dr com.apple.quarantine /Applications/Hanuman.app`
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
build ในเครื่องตัวเองแล้วอัปโหลดขึ้น GitHub Release ด้วย [`scripts/hanuman/release-local.sh`](scripts/hanuman/release-local.sh) (ไม่กินโควตา GitHub Actions)

**macOS** build บน Mac (ต้อง `gh auth login` ไว้ก่อน)
```bash
npm i --legacy-peer-deps && npm run setup              # ครั้งแรกครั้งเดียว
scripts/hanuman/release-local.sh v0.1.0 mac --upload   # macOS (Intel + Apple Silicon)
```

**Windows ยัง build ใน Docker บน Mac ชิป Apple ไม่ได้** ลองแล้วทั้งสองแบบใน Docker Desktop:
- เปิด **Use Rosetta for x86_64/amd64 emulation**: แพ็กแอปผ่าน แต่ wine รันตัวติดตั้งของ NSIS ไม่ได้ (`c0000018`)
- ปิด Rosetta (ใช้ QEMU): ตัว `app-builder` ของ electron-builder crash (`fatal error: lfstack.push`) ตั้งแต่ขั้นแพ็กแอป

ให้ build Windows บนเครื่อง Windows หรือ Linux x86_64 หรือรัน workflow [`release.yml`](.github/workflows/release.yml) ที่แท็บ Actions โดยติ๊ก **windows_only** (build แค่ Windows ไม่ publish อะไร) แล้วอัปโหลดไฟล์จาก artifact `desktop-Windows` เข้า release เอง เช่น
```bash
gh run download <run-id> -n desktop-Windows -D win
gh release upload v0.1.0 -R toomanyitem/hanuman-releases win/*.exe
```

**Linux + Windows + CLI** บนเครื่อง Linux x86_64
```bash
sudo dpkg --add-architecture i386 && sudo apt-get update
sudo apt-get install rpm wine wine64 wine32:i386
scripts/hanuman/release-local.sh v0.1.0 linux win cli --upload
```

- `--upload` สร้าง release แบบ **draft** ใน [`toomanyitem/hanuman-releases`](https://github.com/toomanyitem/hanuman-releases) ถ้ายังไม่มี แล้วอัปโหลดไฟล์ (รันซ้ำได้ จะแทนที่ไฟล์เดิม) พอครบทุกระบบแล้วค่อยกด **Publish** บนหน้า GitHub แอปที่ติดตั้งไว้จะเห็นเวอร์ชันใหม่หลัง Publish เท่านั้น
- [`release-docker.sh`](scripts/hanuman/release-docker.sh) build Linux + Windows + CLI ใน Docker จาก commit ปัจจุบัน (ต้อง commit ก่อน) ให้ Docker ใช้ RAM อย่างน้อย 8 GB บน Mac ชิป Apple ขั้น Windows จะล้มตามที่เขียนไว้ข้างบน และสคริปต์คัดลอกไฟล์ออกมาตอนจบเท่านั้น จึงไม่ได้ไฟล์ใดเลย
- ไฟล์ที่ build ได้อยู่ที่ `dist/release/<tag>/`
- แอป mac ที่ไม่มี Developer ID จะถูกเซ็นแบบ ad-hoc ให้อัตโนมัติ เพื่อให้เปิดบน Apple Silicon ได้
- ถ้าไม่มีเครื่องว่าง ใช้ workflow [`release.yml`](.github/workflows/release.yml) ได้ (กดรันเองที่แท็บ Actions เท่านั้น) ซึ่งทำ Docker image ของ CLI ให้ด้วย ต้องตั้ง secret `HANUMAN_RELEASES_TOKEN` (fine-grained token ที่มีสิทธิ์ Contents: write ใน `hanuman-releases`) ก่อน

---

## English

### What you get
- Everything Bruno does: HTTP, GraphQL, gRPC, WebSocket, scripts and tests, environments, the collection runner, the CLI, the mock server, API docs generation, and Postman/Insomnia/OpenAPI import.
- **No telemetry or analytics.** Nothing leaves your machine unless you ask (for example, by sending a request).
- System-browser OAuth2 uses a local loopback callback (`http://127.0.0.1:9876/callback`) instead of a vendor-hosted redirect.
- Installs side by side with Bruno (its own `hanuman://` protocol and data folder).
- Update notices: **Help → Check for Updates…** or **Preferences → General → Updates** (the check at startup is opt-in). The app only asks GitHub for the latest release of `toomanyitem/hanuman-releases`.
- Roadmap: see the [design spec](docs/superpowers/specs/2026-10-20-hanuman-design.md) — full Git UI, data-driven testing, secret managers, Socket.IO/MQTT, load testing, a full mock server, monitors, and offline API docs.

### Install
Download from [Releases](https://github.com/toomanyitem/hanuman-releases/releases), a public repository that only holds the installers.

Releases currently ship **macOS and Windows**: macOS Intel and Apple Silicon (`hanuman_<version>_x64_mac.dmg` / `_arm64_mac.dmg`, or `.pkg`, `.zip`), and Windows as one installer for x64 and ARM64 (`hanuman_<version>_win.exe`) or a smaller one per architecture (`_x64_win.exe`, `_arm64_win.exe`). There are no Linux, snap or CLI downloads yet; build them from source (see [Releasing](#releasing)).

Builds are **unsigned**:
- **macOS:** open the app once; if macOS blocks it, go to **System Settings → Privacy & Security** and choose **Open Anyway**, or run `xattr -dr com.apple.quarantine /Applications/Hanuman.app`.
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
Build on your own machines with [`scripts/hanuman/release-local.sh`](scripts/hanuman/release-local.sh) and upload to a draft release in [`toomanyitem/hanuman-releases`](https://github.com/toomanyitem/hanuman-releases) (`--upload`), then publish it once every platform is attached (installed apps only see published releases) — an x86_64 Linux machine builds Linux x64/arm64, Windows (via wine) and the CLI; a Mac builds macOS Intel/Apple Silicon (`release-local.sh <tag> mac --upload`). On an Apple Silicon Mac, Windows cannot be built in Docker yet: with Docker Desktop's Rosetta emulation wine cannot run the NSIS installer (`c0000018`), and with QEMU electron-builder's `app-builder` crashes (`fatal error: lfstack.push`). [`release-docker.sh`](scripts/hanuman/release-docker.sh) builds Windows in the same run as Linux and the CLI and copies files out only at the end, so on Apple Silicon it produces nothing. The manual [`release.yml`](.github/workflows/release.yml) workflow does the same on GitHub Actions (including the CLI Docker images) when no machine is available; its `windows_only` input builds just the Windows installer and publishes nothing, leaving it as the `desktop-Windows` run artifact to upload to the release yourself.

---

## License & credits
Hanuman is a fork of [Bruno](https://github.com/usebruno/bruno) © Anoop M D, Anusree P S and contributors, under the [MIT License](license.md). See [NOTICE](NOTICE). Hanuman is not affiliated with or endorsed by Bruno Software Inc.

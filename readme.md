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

| ระบบ | ชิป | ไฟล์ |
|---|---|---|
| macOS | Apple Silicon | `hanuman_<version>_arm64_mac.dmg` (หรือ `.pkg`, `.zip`) |
| macOS | Intel | `hanuman_<version>_x64_mac.dmg` (หรือ `.pkg`, `.zip`) |
| Windows | x64 และ ARM64 | `hanuman_<version>_win.exe` (ตัวเดียวเลือกชิปให้เอง) |
| Linux | x64 | `hanuman_<version>_x86_64_linux.AppImage`, `_amd64_linux.deb`, `_x86_64_linux.rpm` |
| Linux | arm64 | `hanuman_<version>_arm64_linux.AppImage`, `_arm64_linux.deb`, `_aarch64_linux.rpm` |
| Linux (Snap) | x64 | `hanuman_<version>_amd64_linux.snap` → `sudo snap install --dangerous <ไฟล์>` |

**แอปยังไม่ได้เซ็นโค้ด** จึงต้องทำเพิ่มครั้งแรก:
- **macOS:** คลิกขวาที่แอปแล้วเลือก **Open** หรือรัน `xattr -dr com.apple.quarantine /Applications/Hanuman.app`
- **Windows:** ถ้าขึ้น SmartScreen ให้กด **More info → Run anyway**
- **Linux (AppImage):** `chmod +x hanuman_*.AppImage` แล้วเปิดได้เลย

**CLI:** ดาวน์โหลด `hanuman-cli_<version>.tgz` จาก Releases แล้วรัน `npm i -g ./hanuman-cli_<version>.tgz` จะได้คำสั่ง `hanuman` (และ `bru`) ใช้ได้ทุกระบบที่มี Node.js 22

**CLI ผ่าน Docker** (amd64/arm64, มีแบบ `alpine` และ `debian`):
```bash
docker login ghcr.io            # ใช้ GitHub token ที่มีสิทธิ์ read:packages
docker run --rm -v "$PWD":/collection ghcr.io/toomanyitem/hanuman-cli run
```

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

```bash
# บนเครื่อง Linux: Linux (x64+arm64) + Windows (ต้องมี wine) + CLI
sudo apt-get install rpm wine64
scripts/hanuman/release-local.sh v0.1.0 linux win cli --upload

# บน Mac: macOS (Intel + Apple Silicon)
scripts/hanuman/release-local.sh v0.1.0 mac --upload
```

- `--upload` สร้าง release แบบ **draft** ถ้ายังไม่มี แล้วอัปโหลดไฟล์ (รันซ้ำได้ จะแทนที่ไฟล์เดิม) พอครบทุกระบบแล้วค่อยกด **Publish** บนหน้า GitHub
- ไฟล์ที่ build ได้อยู่ที่ `dist/release/<tag>/`
- แอป mac ที่ไม่มี Developer ID จะถูกเซ็นแบบ ad-hoc ให้อัตโนมัติ เพื่อให้เปิดบน Apple Silicon ได้
- ถ้าไม่มีเครื่องว่าง ใช้ workflow [`release.yml`](.github/workflows/release.yml) ได้ (กดรันเองที่แท็บ Actions เท่านั้น) ซึ่งทำ Docker image ของ CLI ให้ด้วย

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

Every platform Bruno ships is built: macOS (Intel, Apple Silicon: dmg/pkg/zip), Windows (one installer for x64 and ARM64), Linux x64/arm64 (AppImage, deb, rpm) and a snap.

**CLI:** download `hanuman-cli_<version>.tgz` from Releases and run `npm i -g ./hanuman-cli_<version>.tgz` to get the `hanuman` (and `bru`) command, or use the `ghcr.io/toomanyitem/hanuman-cli` Docker image (amd64/arm64, `alpine` or `debian`).

### Share collections through Git
Keep the workspace or collection in a Git repository, commit the `.yml`/`.bru` files and push to any Git host. Teammates clone and open the collection. Keep secrets in the collection's git-ignored `.env` file or in secret environment variables — never commit them.

### Development
```bash
nvm use && npm i --legacy-peer-deps && npm run setup && npm run dev
```
See [contributing.md](contributing.md), [CODING_STANDARDS.md](CODING_STANDARDS.md) and [docs/UPSTREAM-SYNC.md](docs/UPSTREAM-SYNC.md).

### Releasing
Build on your own machines with [`scripts/hanuman/release-local.sh`](scripts/hanuman/release-local.sh) and upload to a draft GitHub Release (`--upload`), then publish it once every platform is attached — Linux builds Linux x64/arm64, Windows (via wine) and the CLI; a Mac builds macOS Intel/Apple Silicon. The manual [`release.yml`](.github/workflows/release.yml) workflow does the same on GitHub Actions (including the CLI Docker images) when no machine is available.

---

## License & credits
Hanuman is a fork of [Bruno](https://github.com/usebruno/bruno) © Anoop M D, Anusree P S and contributors, under the [MIT License](license.md). See [NOTICE](NOTICE). Hanuman is not affiliated with or endorsed by Bruno Software Inc.

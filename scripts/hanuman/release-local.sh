#!/usr/bin/env bash
#
# Build Hanuman installers on this machine and upload them to a GitHub Release,
# instead of spending GitHub Actions minutes.
#
# Usage: scripts/hanuman/release-local.sh <tag> [targets...] [--upload]
#   targets: mac win linux snap cli   (default: what this OS builds best —
#            macOS: mac · Linux: linux win cli · Windows: win)
#   --upload: create the release as a draft if it does not exist yet, then
#             upload (or replace) the files. Needs `gh auth login`.
#             Releases go to toomanyitem/hanuman, where the app checks for
#             updates (override with HANUMAN_RELEASE_REPO).
#   --upload-only: skip building and upload what is already in dist/release/<tag>
#             (e.g. files built by scripts/hanuman/release-docker.sh).
#
# Examples:
#   scripts/hanuman/release-local.sh v0.1.0                 # build only, files in dist/release/v0.1.0
#   scripts/hanuman/release-local.sh v0.1.0 mac --upload    # on a Mac
#   scripts/hanuman/release-local.sh v0.1.0 linux win cli --upload
#   scripts/hanuman/release-local.sh v0.1.0 --upload-only
#
# What each target needs:
#   mac   — macOS (dmg/pkg need hdiutil/productbuild); builds x64 + arm64
#   win   — Windows, or wine on macOS/Linux; one installer for x64 + arm64
#   linux — Linux (rpm needs `rpmbuild`: sudo apt-get install rpm); x64 + arm64
#   snap  — Ubuntu 20.04/22.04 with snapcraft (see scripts/build-snap-local.sh)
#   cli   — anywhere; one tarball for every OS/arch

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ELECTRON_OUT="$ROOT_DIR/packages/bruno-electron/out"

TAG="${1:-}"
[[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]] || { echo "Usage: $0 <tag like v0.1.0> [mac|win|linux|snap|cli ...] [--upload]" >&2; exit 1; }
shift
VERSION="${TAG#v}"

UPLOAD=false
UPLOAD_ONLY=false
TARGETS=()
for arg in "$@"; do
  case "$arg" in
    --upload) UPLOAD=true ;;
    --upload-only) UPLOAD_ONLY=true ;;
    mac|win|linux|snap|cli) TARGETS+=("$arg") ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

if [ ${#TARGETS[@]} -eq 0 ]; then
  case "$(uname -s)" in
    Darwin) TARGETS=(mac) ;;
    Linux) TARGETS=(linux win cli) ;;
    MINGW*|MSYS*|CYGWIN*) TARGETS=(win) ;;
    *) echo "Unsupported OS $(uname -s); pass targets explicitly" >&2; exit 1 ;;
  esac
fi

RELEASE_DIR="$ROOT_DIR/dist/release/$TAG"
RELEASE_REPO="${HANUMAN_RELEASE_REPO:-toomanyitem/hanuman}"
mkdir -p "$RELEASE_DIR"

cd "$ROOT_DIR"

upload() {
  if ! gh release view "$TAG" -R "$RELEASE_REPO" > /dev/null 2>&1; then
    echo "==> Creating draft release $TAG in $RELEASE_REPO (publish it on GitHub when every platform is uploaded)"
    # --target makes publishing create a missing tag at the commit that was built.
    gh release create "$TAG" -R "$RELEASE_REPO" --draft --title "Hanuman $TAG" --target "$(git rev-parse HEAD)" \
      --notes "Built from toomanyitem/hanuman@$(git rev-parse --short HEAD). Download the installer for your system below; the builds are unsigned (see the readme)."
  fi
  echo "==> Uploading to release $TAG in $RELEASE_REPO"
  gh release upload "$TAG" -R "$RELEASE_REPO" "$RELEASE_DIR"/* --clobber
}

if [ "$UPLOAD_ONLY" = true ]; then
  [ -n "$(ls -A "$RELEASE_DIR")" ] || { echo "Nothing to upload in $RELEASE_DIR" >&2; exit 1; }
  upload
  exit 0
fi

# set-version.js rewrites these; put them back however the script exits.
VERSIONED_FILES=(packages/bruno-electron/package.json packages/bruno-app/package.json packages/bruno-cli/package.json)
for f in "${VERSIONED_FILES[@]}"; do cp "$f" "$f.release-backup"; done
restore_versions() {
  for f in "${VERSIONED_FILES[@]}"; do [ -f "$f.release-backup" ] && mv "$f.release-backup" "$f"; done
}
trap restore_versions EXIT

node scripts/hanuman/set-version.js "$TAG"

needs_web=false
for t in "${TARGETS[@]}"; do [ "$t" != cli ] && needs_web=true; done
if [ "$needs_web" = true ]; then
  echo "==> Building web app"
  npm run build:web
fi

# npm only installs node-pty's prebuilt binary for this machine's OS/arch; the
# app bundle needs the target OS's binaries for both arches. Keep in sync with
# forceInstallPlatformDeps() in scripts/setup.js.
install_pty() {
  npm i --legacy-peer-deps --no-save --force "@lydell/node-pty-$1-arm64@1.1.0" "@lydell/node-pty-$1-x64@1.1.0" > /dev/null
}

collect() {
  shopt -s nullglob
  local files=("$ELECTRON_OUT"/*.dmg "$ELECTRON_OUT"/*.pkg "$ELECTRON_OUT"/*.zip "$ELECTRON_OUT"/*.exe \
    "$ELECTRON_OUT"/*.AppImage "$ELECTRON_OUT"/*.deb "$ELECTRON_OUT"/*.rpm "$ELECTRON_OUT"/*.snap)
  shopt -u nullglob
  [ ${#files[@]} -gt 0 ] || { echo "No installers found in $ELECTRON_OUT" >&2; exit 1; }
  cp "${files[@]}" "$RELEASE_DIR/"
}

build_desktop() {
  local name="$1" pty_platform="$2" builder_args="$3"
  echo "==> Building $name"
  install_pty "$pty_platform"
  CSC_IDENTITY_AUTO_DISCOVERY=false ELECTRON_BUILDER_ARGS="$builder_args --publish never" node scripts/build-electron.js
  collect
}

for target in "${TARGETS[@]}"; do
  case "$target" in
    mac) build_desktop macOS darwin "--mac" ;;
    win) build_desktop Windows win32 "--win" ;;
    linux) build_desktop Linux linux "--linux" ;;
    snap)
      echo "==> Building snap"
      ./scripts/build-snap-local.sh --skip-web
      for f in "$ELECTRON_OUT"/*.snap; do mv "$f" "$ELECTRON_OUT/hanuman_${f##*/bruno_}" 2> /dev/null || true; done
      collect
      ;;
    cli)
      echo "==> Bundling CLI"
      node scripts/bundle-cli.js
      cp dist/cli-bundle/*.tgz "$RELEASE_DIR/hanuman-cli_${VERSION}.tgz"
      ;;
  esac
done

echo
echo "==> Files in $RELEASE_DIR"
ls -lh "$RELEASE_DIR"

if [ "$UPLOAD" = true ]; then
  upload
fi

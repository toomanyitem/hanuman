#!/usr/bin/env bash
#
# Build the Linux (x64 + arm64), Windows and CLI release files inside Docker,
# then optionally upload them — for a Mac or any machine without rpm and wine.
# The build runs on a fresh clone of the current commit, so commit first.
#
# Usage: scripts/hanuman/release-docker.sh <tag> [--upload]
#   --upload: same as release-local.sh --upload (draft release, needs gh auth)
#
# Apple Silicon: the image is amd64 (wine needs x86), and the Windows step fails
# under both Docker Desktop's Rosetta and QEMU emulation (see "Releasing" in the
# readme), so build Windows elsewhere. Give Docker at least 8 GB of memory and
# ~20 GB of disk.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE=hanuman-release-builder

TAG="${1:-}"
[[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]] || { echo "Usage: $0 <tag like v0.1.0> [--upload]" >&2; exit 1; }
shift
UPLOAD=false
for arg in "$@"; do
  case "$arg" in
    --upload) UPLOAD=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

cd "$ROOT_DIR"
COMMIT="$(git rev-parse HEAD)"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Warning: uncommitted changes are not built; building commit $COMMIT" >&2
fi

echo "==> Building the build image"
docker build --platform linux/amd64 -t "$IMAGE" docker/release

echo "==> Building $TAG from $COMMIT"
mkdir -p dist/release
docker run --rm --platform linux/amd64 \
  -v "$ROOT_DIR:/src:ro" \
  -v "$ROOT_DIR/dist/release:/out" \
  -v hanuman-release-npm-cache:/root/.npm \
  -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  "$IMAGE" "$COMMIT" "$TAG"

echo
echo "==> Files in dist/release/$TAG"
ls -lh "dist/release/$TAG"

if [ "$UPLOAD" = true ]; then
  scripts/hanuman/release-local.sh "$TAG" --upload-only
fi

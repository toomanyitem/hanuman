#!/usr/bin/env bash
# Runs inside the docker/release image. Builds commit $1 of the repo mounted at
# /src for release tag $2 and copies the installers to /out/<tag>.
set -euo pipefail

COMMIT="$1"
TAG="$2"

git clone --quiet /src /build
cd /build
git checkout --quiet "$COMMIT"

npm ci --legacy-peer-deps
npm run build:graphql-docs
npm run build:bruno-query
npm run build:bruno-common
npm run sandbox:bundle-libraries --workspace=packages/bruno-js
npm run build:bruno-converters
npm run build:bruno-requests
npm run build:schema-types
npm run build:bruno-filestore
npm run build:bruno-sqlite

scripts/hanuman/release-local.sh "$TAG" linux win cli

mkdir -p "/out/$TAG"
cp dist/release/"$TAG"/* "/out/$TAG/"
# Hand the files back to the host user (matters on Linux hosts).
chown -R "${HOST_UID:-0}:${HOST_GID:-0}" "/out/$TAG"

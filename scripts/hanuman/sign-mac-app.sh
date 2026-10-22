#!/usr/bin/env bash
#
# Sign a packed Hanuman.app with the release certificate.
#
# Usage: MAC_SIGNING_P12_BASE64=… MAC_SIGNING_P12_PASSWORD=… HANUMAN_MAC_CERT_SHA1=… \
#          scripts/hanuman/sign-mac-app.sh <path/to/Hanuman.app>
#
# Every macOS release is signed with the same self-signed certificate, so the app's
# designated requirement is tied to that certificate instead of a per-build cdhash:
# the keychain keeps trusting new versions ("hanuman Safe Storage") and the in-app
# updater accepts only downloads that satisfy the running app's requirement.
# electron-builder rejects a self-signed identity as untrusted, so the release
# workflow packs the app (`--mac dir`), signs it with this script in a job that
# installs no npm packages, then builds the installers with `--prepackaged`.
# HANUMAN_MAC_CERT_SHA1 pins the certificate: a different one would make every
# installed copy refuse the update.
set -euo pipefail

app="${1:?Usage: $0 <path/to/Hanuman.app>}"
: "${MAC_SIGNING_P12_BASE64:?Set MAC_SIGNING_P12_BASE64 (base64 of the .p12)}"
: "${MAC_SIGNING_P12_PASSWORD:?Set MAC_SIGNING_P12_PASSWORD}"
: "${HANUMAN_MAC_CERT_SHA1:?Set HANUMAN_MAC_CERT_SHA1 (SHA-1 of the release certificate)}"

work=$(mktemp -d)
keychain="$work/signing.keychain-db"
keychain_password=$(openssl rand -hex 16)
cleanup() {
  security delete-keychain "$keychain" 2>/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

printf '%s' "$MAC_SIGNING_P12_BASE64" | base64 --decode > "$work/signing.p12"
security create-keychain -p "$keychain_password" "$keychain"
security set-keychain-settings -lut 300 "$keychain"
security unlock-keychain -p "$keychain_password" "$keychain"
# -x: the private key can be used for signing but not exported again.
security import "$work/signing.p12" -k "$keychain" -P "$MAC_SIGNING_P12_PASSWORD" -T /usr/bin/codesign -x > /dev/null
rm "$work/signing.p12"
security set-key-partition-list -S codesign: -s -k "$keychain_password" "$keychain" > /dev/null

identity=$(security find-identity -p codesigning "$keychain" | awk '/^ *1\)/ { print $2 }')
if [ "$identity" != "$HANUMAN_MAC_CERT_SHA1" ]; then
  echo "MAC_SIGNING_P12_BASE64 holds certificate '$identity', expected $HANUMAN_MAC_CERT_SHA1" >&2
  exit 1
fi

codesign --force --deep --sign "$identity" --keychain "$keychain" "$app"
codesign --verify --deep --strict "$app"
requirement=$(codesign -d -r- "$app" 2>/dev/null)
echo "$requirement"
case "$requirement" in
  *"certificate leaf = H\"$(echo "$identity" | tr 'A-F' 'a-f')\""*) ;;
  *) echo "Unexpected designated requirement after signing" >&2; exit 1 ;;
esac

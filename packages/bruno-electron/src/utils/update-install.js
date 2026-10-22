const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const { isNewerVersion } = require('./update-check');

const execFileAsync = promisify(execFile);

const BUNDLE_ID = 'com.toomanyitem.hanuman';

/*
 * macOS only. Downloads the release zip with net.fetch and writes it with fs, so
 * the files never get the com.apple.quarantine attribute that browser and
 * webContents downloads get, and the ad-hoc signed app opens without a
 * Gatekeeper prompt. electron-updater would need a Developer ID signature.
 */

const versionFromTag = (tag) => String(tag || '').replace(/^v/, '');

/**
 * Picks `hanuman_<ver>_<arch>_mac.zip` from a GitHub release and its sha256.
 * Refuses an asset with no digest: the digest is what ties the file to the release.
 */
const selectMacAsset = (release, arch) => {
  const version = versionFromTag(release && release.tag_name);
  const name = `hanuman_${version}_${arch}_mac.zip`;
  const asset = ((release && release.assets) || []).find((a) => a.name === name);
  if (!asset || !asset.browser_download_url) {
    throw new Error(`The release has no ${name} to download.`);
  }
  const match = /^sha256:([0-9a-f]{64})$/i.exec(asset.digest || '');
  if (!match) {
    throw new Error(`GitHub did not give a sha256 digest for ${name}, so it can't be checked.`);
  }
  return { name, version, url: asset.browser_download_url, size: asset.size, sha256: match[1].toLowerCase() };
};

/**
 * Finds the running .app from the executable path and refuses when it can't be
 * swapped in place. The returned bundle path is what the helper script replaces.
 */
const resolveInstallTarget = ({ exePath, isPackaged, access = fs.accessSync }) => {
  if (!isPackaged) {
    throw new Error('Only an installed copy of Hanuman can update itself.');
  }
  // <bundle>.app/Contents/MacOS/<exe>
  const bundlePath = path.resolve(exePath, '..', '..', '..');
  if (path.extname(bundlePath) !== '.app') {
    throw new Error(`Couldn't find the Hanuman app around ${exePath}.`);
  }
  if (bundlePath.includes('/AppTranslocation/')) {
    throw new Error('macOS is running Hanuman from a temporary read-only copy (App Translocation). Move Hanuman.app to the Applications folder, open it from there, and try again.');
  }
  // Moving the bundle needs write access to its folder and, for a directory, to the bundle itself.
  for (const target of [path.dirname(bundlePath), bundlePath]) {
    try {
      access(target, fs.constants.W_OK);
    } catch {
      throw new Error(`Hanuman can't write to ${target}. Install the update yourself, or ask an administrator to.`);
    }
  }
  return bundlePath;
};

/**
 * Streams the asset into `destPath`, hashing as it goes, and rejects unless the
 * sha256 matches. `onProgress` gets a fraction in [0, 1], or null when the size is unknown.
 */
const downloadAsset = async ({ url, sha256, destPath, fetch, signal, onProgress = () => {} }) => {
  const response = await fetch(url, { signal, headers: { 'User-Agent': 'Hanuman' } });
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }
  const total = Number(response.headers.get('content-length')) || 0;
  const hash = crypto.createHash('sha256');
  const file = await fs.promises.open(destPath, 'w');
  let received = 0;
  try {
    for await (const chunk of response.body) {
      hash.update(chunk);
      await file.write(chunk);
      received += chunk.length;
      onProgress(total ? received / total : null);
    }
  } finally {
    await file.close();
  }
  const actual = hash.digest('hex');
  if (actual !== sha256) {
    throw new Error(`The download's sha256 (${actual}) doesn't match the release (${sha256}).`);
  }
};

const readBundleInfo = async (appPath) => {
  const { stdout } = await execFileAsync('plutil', ['-convert', 'json', '-o', '-', path.join(appPath, 'Contents', 'Info.plist')]);
  const plist = JSON.parse(stdout);
  return { bundleId: plist.CFBundleIdentifier, version: plist.CFBundleShortVersionString };
};

const verifyBundleInfo = ({ bundleId, version }, { expectedVersion, currentVersion }) => {
  if (bundleId !== BUNDLE_ID) {
    throw new Error(`The download is not Hanuman (bundle id ${bundleId}).`);
  }
  if (version !== expectedVersion) {
    throw new Error(`The download is version ${version}, but the release is ${expectedVersion}.`);
  }
  if (!isNewerVersion(version, currentVersion)) {
    throw new Error(`The download (${version}) is not newer than this copy (${currentVersion}).`);
  }
};

/**
 * Unzips the download next to it and checks it is a newer, intact Hanuman.
 * Returns the path of the extracted .app.
 */
const extractAndVerify = async ({ zipPath, workDir, expectedVersion, currentVersion }) => {
  const outDir = path.join(workDir, 'extracted');
  await execFileAsync('ditto', ['-x', '-k', '--noqtn', zipPath, outDir]);
  const entries = await fs.promises.readdir(outDir);
  if (entries.length !== 1 || path.extname(entries[0]) !== '.app') {
    throw new Error(`The download should contain one app, found: ${entries.join(', ') || 'nothing'}.`);
  }
  const appPath = path.join(outDir, entries[0]);
  verifyBundleInfo(await readBundleInfo(appPath), { expectedVersion, currentVersion });
  // A broken ad-hoc signature would make macOS report the app as damaged after the swap.
  await execFileAsync('codesign', ['--verify', '--deep', '--strict', appPath]);
  return appPath;
};

/*
 * Runs after Hanuman quits: waits for the pid to exit, moves the old app to the
 * Trash, moves the new one in (putting the old one back if that fails) and opens
 * it. Gives up after 10 minutes, e.g. when the user cancelled the quit.
 */
const HELPER_SCRIPT = `#!/bin/sh
pid="$1"; old="$2"; new="$3"
tries=0
while kill -0 "$pid" 2>/dev/null; do
  tries=$((tries + 1))
  if [ "$tries" -gt 3000 ]; then echo "Hanuman ($pid) did not quit; update not installed"; exit 1; fi
  sleep 0.2
done
trashed="$HOME/.Trash/$(basename "$old" .app) $(date +%Y%m%d-%H%M%S).app"
if ! mv "$old" "$trashed"; then
  echo "Could not move $old to the Trash; update not installed"
  "\${HANUMAN_UPDATE_OPEN:-open}" "$old"
  exit 1
fi
if ! mv "$new" "$old"; then
  echo "Could not move $new into place; restoring the previous app"
  mv "$trashed" "$old"
  "\${HANUMAN_UPDATE_OPEN:-open}" "$old"
  exit 1
fi
echo "Installed $old"
"\${HANUMAN_UPDATE_OPEN:-open}" "$old"
`;

/**
 * Starts the detached helper that swaps the app once this process exits.
 * The caller quits the app right after. Output goes to <tmpdir>/hanuman-update.log.
 */
const startSwapHelper = ({ workDir, pid, bundlePath, newAppPath }) => {
  const scriptPath = path.join(workDir, 'install-update.sh');
  fs.writeFileSync(scriptPath, HELPER_SCRIPT, { mode: 0o700 });
  const log = fs.openSync(path.join(os.tmpdir(), 'hanuman-update.log'), 'a');
  const child = spawn('/bin/sh', [scriptPath, String(pid), bundlePath, newAppPath], {
    detached: true,
    stdio: ['ignore', log, log]
  });
  child.unref();
  fs.closeSync(log);
};

module.exports = {
  BUNDLE_ID,
  HELPER_SCRIPT,
  selectMacAsset,
  resolveInstallTarget,
  downloadAsset,
  verifyBundleInfo,
  extractAndVerify,
  startSwapHelper
};

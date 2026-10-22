const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  HELPER_SCRIPT,
  selectMacAsset,
  resolveInstallTarget,
  downloadAsset,
  verifyBundleInfo,
  parseDesignatedRequirement,
  verifySignature
} = require('./update-install');

const SHA = 'a'.repeat(64);
const asset = (name, extra = {}) => ({ name, browser_download_url: `https://example.test/${name}`, size: 10, digest: `sha256:${SHA}`, ...extra });
const release = (assets) => ({ tag_name: 'v0.3.0', assets });

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hanuman-install-spec-'));

describe('selectMacAsset', () => {
  const assets = [
    asset('hanuman_0.3.0_arm64_mac.dmg'),
    asset('hanuman_0.3.0_arm64_mac.zip'),
    asset('hanuman_0.3.0_x64_mac.zip', { digest: `sha256:${'b'.repeat(64)}` }),
    asset('hanuman_0.3.0_x64_win.exe')
  ];

  it.each([
    ['arm64', 'hanuman_0.3.0_arm64_mac.zip', SHA],
    ['x64', 'hanuman_0.3.0_x64_mac.zip', 'b'.repeat(64)]
  ])('picks the %s zip and its digest', (arch, name, sha256) => {
    expect(selectMacAsset(release(assets), arch)).toEqual({
      name,
      version: '0.3.0',
      url: `https://example.test/${name}`,
      size: 10,
      sha256
    });
  });

  it('refuses a release with no zip for this arch', () => {
    expect(() => selectMacAsset(release([asset('hanuman_0.3.0_arm64_mac.dmg')]), 'arm64')).toThrow('no hanuman_0.3.0_arm64_mac.zip');
  });

  it.each([undefined, null, '', 'md5:abc', `sha256:${'a'.repeat(63)}`])('refuses digest %p', (digest) => {
    expect(() => selectMacAsset(release([asset('hanuman_0.3.0_arm64_mac.zip', { digest })]), 'arm64')).toThrow('sha256 digest');
  });
});

describe('downloadAsset', () => {
  const body = Buffer.from('hanuman zip bytes');
  const sha256 = crypto.createHash('sha256').update(body).digest('hex');
  const fetchReturning = (chunks) => jest.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => String(body.length) },
    body: (async function* () {
      yield* chunks;
    })()
  });

  it('writes the file and reports progress when the digest matches', async () => {
    const dir = makeTempDir();
    const destPath = path.join(dir, 'a.zip');
    const onProgress = jest.fn();

    await downloadAsset({ url: 'u', sha256, destPath, fetch: fetchReturning([body.subarray(0, 5), body.subarray(5)]), signal: new AbortController().signal, onProgress });

    expect(fs.readFileSync(destPath)).toEqual(body);
    expect(onProgress).toHaveBeenLastCalledWith(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects when the digest does not match', async () => {
    const dir = makeTempDir();

    await expect(downloadAsset({ url: 'u', sha256: SHA, destPath: path.join(dir, 'a.zip'), fetch: fetchReturning([body]), signal: new AbortController().signal }))
      .rejects.toThrow('doesn\'t match the release');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('stops when cancelled mid-download, even if the body keeps streaming', async () => {
    const dir = makeTempDir();
    const controller = new AbortController();
    const onProgress = jest.fn(() => controller.abort());

    await expect(downloadAsset({ url: 'u', sha256, destPath: path.join(dir, 'a.zip'), fetch: fetchReturning([body.subarray(0, 5), body.subarray(5)]), signal: controller.signal, onProgress }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(onProgress).toHaveBeenCalledTimes(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects an HTTP error', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(downloadAsset({ url: 'u', sha256, destPath: 'unused', fetch, signal: new AbortController().signal })).rejects.toThrow('HTTP 404');
  });
});

describe('verifyBundleInfo', () => {
  const expected = { expectedVersion: '0.3.0', currentVersion: '0.2.0' };

  it('accepts a newer Hanuman matching the release', () => {
    expect(() => verifyBundleInfo({ bundleId: 'com.toomanyitem.hanuman', version: '0.3.0' }, expected)).not.toThrow();
  });

  it('refuses another bundle id', () => {
    expect(() => verifyBundleInfo({ bundleId: 'com.usebruno.app', version: '0.3.0' }, expected)).toThrow('not Hanuman');
  });

  it('refuses a version that differs from the release', () => {
    expect(() => verifyBundleInfo({ bundleId: 'com.toomanyitem.hanuman', version: '0.3.1' }, expected)).toThrow('release is 0.3.0');
  });

  it('refuses a version that is not newer', () => {
    expect(() => verifyBundleInfo({ bundleId: 'com.toomanyitem.hanuman', version: '0.2.0' }, { expectedVersion: '0.2.0', currentVersion: '0.2.0' }))
      .toThrow('not newer');
  });
});

describe('resolveInstallTarget', () => {
  const exePath = '/Applications/Hanuman.app/Contents/MacOS/Hanuman';
  const writable = () => {};

  it('returns the running .app bundle', () => {
    expect(resolveInstallTarget({ exePath, isPackaged: true, access: writable })).toBe('/Applications/Hanuman.app');
  });

  it('refuses an unpackaged (dev) app', () => {
    expect(() => resolveInstallTarget({ exePath, isPackaged: false, access: writable })).toThrow('installed copy');
  });

  it('refuses a path outside an .app bundle', () => {
    expect(() => resolveInstallTarget({ exePath: '/usr/local/bin/hanuman', isPackaged: true, access: writable })).toThrow('Couldn\'t find');
  });

  it('refuses an app running under App Translocation', () => {
    const translocated = '/private/var/folders/x/T/AppTranslocation/ABC/d/Hanuman.app/Contents/MacOS/Hanuman';
    expect(() => resolveInstallTarget({ exePath: translocated, isPackaged: true, access: writable })).toThrow('App Translocation');
  });

  it.each([
    ['the folder', '/Applications'],
    ['the bundle', '/Applications/Hanuman.app']
  ])('refuses when %s is not writable', (_, readOnly) => {
    const access = (target) => {
      if (target === readOnly) {
        throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
      }
    };
    expect(() => resolveInstallTarget({ exePath, isPackaged: true, access })).toThrow(`can't write to ${readOnly}`);
  });

  it('refuses a real read-only folder', () => {
    if (process.getuid && process.getuid() === 0) {
      return;
    }
    const dir = makeTempDir();
    const exe = path.join(dir, 'Hanuman.app', 'Contents', 'MacOS', 'Hanuman');
    fs.mkdirSync(path.dirname(exe), { recursive: true });
    fs.chmodSync(dir, 0o555);
    try {
      expect(() => resolveInstallTarget({ exePath: exe, isPackaged: true })).toThrow('can\'t write to');
    } finally {
      fs.chmodSync(dir, 0o755);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('parseDesignatedRequirement', () => {
  it('returns the requirement of a certificate-signed app', () => {
    const output = 'designated => identifier "com.toomanyitem.hanuman" and certificate leaf = H"8c314ef8d2a8fa040e310fe6cbf7d19b6796b13d"\n';
    expect(parseDesignatedRequirement(output)).toBe('identifier "com.toomanyitem.hanuman" and certificate leaf = H"8c314ef8d2a8fa040e310fe6cbf7d19b6796b13d"');
  });

  it('returns null for an ad-hoc app, whose implicit cdhash requirement changes every build', () => {
    expect(parseDesignatedRequirement('# designated => cdhash H"8d0b0230aff943a825efae53b03b3c2624e6e3ae"\n')).toBeNull();
  });
});

const describeOnMac = process.platform === 'darwin' ? describe : describe.skip;

describeOnMac('verifySignature', () => {
  const signedCopy = (dir, name) => {
    const binary = path.join(dir, name);
    fs.copyFileSync('/usr/bin/true', binary);
    spawnSync('codesign', ['--force', '--sign', '-', '--identifier', 'com.toomanyitem.hanuman', binary]);
    return binary;
  };

  it('accepts a validly signed download when the running copy is ad-hoc signed', async () => {
    const dir = makeTempDir();
    await expect(verifySignature({ appPath: signedCopy(dir, 'new'), runningAppPath: signedCopy(dir, 'running') })).resolves.toBeUndefined();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('refuses a download whose signature is broken', async () => {
    const dir = makeTempDir();
    const broken = signedCopy(dir, 'new');
    fs.appendFileSync(broken, 'tampered');
    await expect(verifySignature({ appPath: broken, runningAppPath: signedCopy(dir, 'running') })).rejects.toThrow('signature is broken');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describeOnMac('swap helper script', () => {
  const setup = () => {
    const dir = makeTempDir();
    const home = path.join(dir, 'home');
    fs.mkdirSync(path.join(home, '.Trash'), { recursive: true });
    const oldApp = path.join(dir, 'Applications', 'Hanuman.app');
    const workDir = path.join(dir, 'hanuman-update-work');
    const newApp = path.join(workDir, 'extracted', 'Hanuman.app');
    fs.mkdirSync(oldApp, { recursive: true });
    fs.mkdirSync(newApp, { recursive: true });
    fs.writeFileSync(path.join(oldApp, 'version'), 'old');
    fs.writeFileSync(path.join(newApp, 'version'), 'new');
    const script = path.join(workDir, 'install-update.sh');
    fs.writeFileSync(script, HELPER_SCRIPT);
    const opened = path.join(dir, 'opened');
    const run = (newPath = newApp) => spawnSync('/bin/sh', [script, '999999', oldApp, newPath], {
      // A fake `open` records the path instead of launching the dummy bundle.
      env: { ...process.env, HOME: home, HANUMAN_UPDATE_OPEN: path.join(dir, 'fake-open') },
      encoding: 'utf8'
    });
    fs.writeFileSync(path.join(dir, 'fake-open'), `#!/bin/sh\necho "$1" > "${opened}"\n`, { mode: 0o755 });
    return { dir, home, oldApp, newApp, workDir, opened, run };
  };

  it('moves the old app to the Trash, the new one in, opens it and removes its work dir', () => {
    const { dir, home, oldApp, workDir, opened, run } = setup();

    const result = run();

    expect(result.status).toBe(0);
    expect(fs.existsSync(workDir)).toBe(false);
    expect(fs.readFileSync(path.join(oldApp, 'version'), 'utf8')).toBe('new');
    const trashed = fs.readdirSync(path.join(home, '.Trash'));
    expect(trashed).toHaveLength(1);
    expect(fs.readFileSync(path.join(home, '.Trash', trashed[0], 'version'), 'utf8')).toBe('old');
    expect(fs.readFileSync(opened, 'utf8').trim()).toBe(oldApp);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('puts the old app back when the new one cannot be moved in', () => {
    const { dir, home, oldApp, workDir, opened, run } = setup();

    const result = run(path.join(dir, 'missing', 'Hanuman.app'));

    expect(result.status).toBe(1);
    expect(fs.existsSync(workDir)).toBe(true);
    expect(fs.readFileSync(path.join(oldApp, 'version'), 'utf8')).toBe('old');
    expect(fs.readdirSync(path.join(home, '.Trash'))).toHaveLength(0);
    expect(fs.readFileSync(opened, 'utf8').trim()).toBe(oldApp);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

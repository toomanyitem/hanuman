const path = require('path');
const { execFileSync } = require('child_process');

// Signs the mac app before it is archived into dmg/zip/pkg when there is no
// Developer ID (CSC_LINK / CSC_NAME), because Apple Silicon refuses to launch arm64
// apps with no signature at all.
//
// With HANUMAN_CODESIGN_IDENTITY (the SHA-1 of a code-signing certificate, looked up
// in HANUMAN_CODESIGN_KEYCHAIN when set) every build gets the same designated
// requirement, so the keychain keeps trusting new versions ("Hanuman Safe Storage")
// and the in-app updater can tell a release is ours. Releases use one self-signed
// certificate, which electron-builder's own signing rejects as untrusted.
// Without it the bundle is signed ad-hoc, whose requirement changes every build.
const macSign = async (context) => {
  if (context.electronPlatformName !== 'darwin' || process.env.CSC_LINK || process.env.CSC_NAME) {
    return;
  }
  if (process.platform !== 'darwin') {
    console.warn('  • skipped signing: codesign is only available on macOS');
    return;
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const identity = process.env.HANUMAN_CODESIGN_IDENTITY;
  const keychain = process.env.HANUMAN_CODESIGN_KEYCHAIN;
  const signArgs = identity ? ['--sign', identity, ...(keychain ? ['--keychain', keychain] : [])] : ['--sign', '-'];
  console.log(`  • ${identity ? `signing with certificate ${identity}` : 'ad-hoc signing'} ${appPath}`);
  execFileSync('codesign', ['--force', '--deep', ...signArgs, appPath], { stdio: 'inherit' });
};

module.exports = macSign;

const path = require('path');
const { execFileSync } = require('child_process');

// Apple Silicon refuses to launch arm64 apps with no signature at all. Without a
// Developer ID (CSC_LINK / CSC_NAME), electron-builder 24 skips signing, so give
// the bundle an ad-hoc signature before it is archived into dmg/zip/pkg. Users
// still clear quarantine on first launch (see readme.md).
const adhocSign = async (context) => {
  if (context.electronPlatformName !== 'darwin' || process.env.CSC_LINK || process.env.CSC_NAME) {
    return;
  }
  if (process.platform !== 'darwin') {
    console.warn('  • skipped ad-hoc signing: codesign is only available on macOS');
    return;
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`  • ad-hoc signing ${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
};

module.exports = adhocSign;

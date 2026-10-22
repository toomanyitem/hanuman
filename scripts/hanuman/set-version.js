#!/usr/bin/env node
'use strict';

// Stamp the release version (from a `vX.Y.Z` tag) into the app packages that
// report it at runtime: the Electron main process, the renderer and the CLI.
const fs = require('fs');
const path = require('path');

const PACKAGES = [
  'packages/bruno-electron/package.json',
  'packages/bruno-app/package.json',
  'packages/bruno-cli/package.json'
];

const tag = process.argv[2];
const version = (tag || '').replace(/^v/, '');

if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Expected a tag like v0.1.0, got "${tag}"`);
  process.exit(1);
}

for (const relativePath of PACKAGES) {
  const file = path.resolve(__dirname, '..', '..', relativePath);
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`${relativePath} -> ${version}`);
}

#!/usr/bin/env node
'use strict';

// Guards the fork's invariants after merging upstream Bruno: no telemetry, no
// vendor phone-home endpoints, and no Bruno app identity in user-facing spots.
// Exits non-zero and prints each hit so the merge can be fixed before landing.
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const RULES = [
  { pattern: 'posthog', reason: 'telemetry (PostHog) must stay removed' },
  { pattern: 'appinfo\\.usebruno\\.com', reason: 'startup notifications must not call Bruno servers by default' },
  { pattern: 'oauth\\.usebruno\\.com', reason: 'OAuth2 callbacks must stay on the local loopback listener' },
  { pattern: 'GoldenEdition', reason: 'upsell component must stay removed' },
  { pattern: 'useTelemetry|useChangelogOnUpdate', reason: 'telemetry / Bruno changelog hooks must stay removed' },
  { pattern: "setAsDefaultProtocolClient\\('bruno'\\)", reason: 'Hanuman registers hanuman://, not bruno://' },
  { pattern: "productName: .*'Bruno", reason: 'productName must be Hanuman' },
  { pattern: "appId: 'com\\.usebruno", reason: 'appId must be com.toomanyitem.hanuman' },
  { pattern: "'About Bruno'|Welcome to Bruno|Set up Bruno", reason: 'user-facing app name must be Hanuman' }
];

const SEARCH_PATHS = ['packages/bruno-app/src', 'packages/bruno-electron/src', 'packages/bruno-electron/electron-builder-config.js', 'packages/bruno-app/package.json'];

let failed = false;

for (const { pattern, reason } of RULES) {
  let output = '';
  try {
    output = execFileSync('git', ['grep', '-n', '-I', '-E', pattern, '--', ...SEARCH_PATHS], { cwd: ROOT, encoding: 'utf8' });
  } catch (error) {
    // git grep exits 1 when nothing matches.
    if (error.status !== 1) {
      throw error;
    }
  }

  if (output.trim()) {
    failed = true;
    console.error(`\n✖ ${reason} (/${pattern}/):\n${output.trimEnd()}`);
  }
}

if (failed) {
  console.error('\nFork invariants violated — see docs/UPSTREAM-SYNC.md.');
  process.exit(1);
}

console.log('✓ Fork invariants hold.');

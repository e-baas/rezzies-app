#!/usr/bin/env node
/**
 * Materialise the App Store Connect API .p8 private key into ./secrets/
 * so `eas submit` can pick it up. Reads APP_STORE_CONNECT_PRIVATE_KEY from
 * the tyny Vault via tyctl (preferred) or from the env (CI fallback).
 *
 * Usage:
 *   node scripts/bootstrap-asc-key.js
 *
 * Output:
 *   ./secrets/asc-api-key.p8   (mode 0600, .gitignored via *.p8 pattern)
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const OUT_DIR = path.resolve(__dirname, '..', 'secrets');
const OUT_FILE = path.join(OUT_DIR, 'asc-api-key.p8');

function readFromVault() {
  try {
    const raw = execSync('tyctl vault get APP_STORE_CONNECT_PRIVATE_KEY --raw', {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return raw.trim();
  } catch {
    return null;
  }
}

function main() {
  const key = readFromVault() || process.env.APP_STORE_CONNECT_PRIVATE_KEY;
  if (!key) {
    console.error('ERROR: APP_STORE_CONNECT_PRIVATE_KEY not found in Vault or env.');
    console.error('Set it via `tyctl vault set APP_STORE_CONNECT_PRIVATE_KEY` or export it before running.');
    process.exit(1);
  }
  if (!key.includes('BEGIN PRIVATE KEY')) {
    console.error('ERROR: APP_STORE_CONNECT_PRIVATE_KEY does not look like a PEM .p8 (no BEGIN PRIVATE KEY header).');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, key.endsWith('\n') ? key : `${key}\n`, { mode: 0o600 });
  console.log(`Wrote ${OUT_FILE} (${key.length} bytes).`);
}

main();

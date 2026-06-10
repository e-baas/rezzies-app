#!/usr/bin/env node
/*
 * iOS signing credentials for `eas build --profile testflight`
 * (the testflight profile sets credentialsSource: "local", so EAS uses exactly
 *  the cert/profile we hand it and NEVER contacts Apple to create/rotate certs).
 *
 * ── PINNED-CERT MODEL (root-cause fix for repeated "certificate revoked" emails) ──
 * The Apple Distribution cert + App Store provisioning profile are PINNED in Vault:
 *   REZZIES_IOS_DIST_P12_B64           base64 of the .p12 (cert + private key)
 *   REZZIES_IOS_DIST_P12_PASSWORD      the .p12 password
 *   REZZIES_IOS_PROVISIONING_PROFILE_B64  base64 of the .mobileprovision
 * Every build REUSES these — no Apple cert calls, no revocation. The earlier
 * email storm was caused by an old version of THIS script revoking + re-minting
 * the Distribution cert on every run; that behavior is gone.
 *
 * Commands:
 *   provision   (default) write secrets/dist.p12, secrets/rezzies.mobileprovision,
 *               and credentials.json FROM Vault. Zero Apple API calls. Use this
 *               for every build. If the Vault keys are missing it errors and tells
 *               you to run `mint` once.
 *   mint        create ONE new Distribution cert (NO revocation) + App Store
 *               profile, write artifacts to OUT_DIR, and print base64 to store in
 *               Vault. Run this only to establish/rotate the pinned cert. Apple
 *               caps Distribution certs at 2 — if both slots are full, free one in
 *               the Apple Developer portal first (revoking emails the account
 *               holder, so do it deliberately, not on every build).
 *   list-certs  list Distribution certs.
 *
 * Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_P8_PATH (from scripts/bootstrap-asc-key.js),
 *      BUNDLE_ID (default com.ebaas.rezzies), OUT_DIR (default /tmp/ioscreds),
 *      NODE_PATH pointing at a scratch dir with `jsonwebtoken` + `node-forge`.
 *      Repo root is assumed CWD for `provision` (writes ./secrets + ./credentials.json).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER = process.env.ASC_ISSUER_ID;
const P8 = process.env.ASC_P8_PATH;
const BUNDLE = process.env.BUNDLE_ID || 'com.ebaas.rezzies';
const OUT = process.env.OUT_DIR || '/tmp/ioscreds';

function vaultGet(key) {
  try {
    const out = execSync(`tyctl vault get ${key}`, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
    const j = JSON.parse(out);
    return typeof j.value === 'string' ? j.value : null;
  } catch { return null; }
}

function token() {
  const jwt = require('jsonwebtoken');
  return jwt.sign({}, fs.readFileSync(P8, 'utf8'), {
    algorithm: 'ES256', keyid: KEY_ID, issuer: ISSUER, audience: 'appstoreconnect-v1',
    expiresIn: '18m', header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
  });
}
const BASE = 'https://api.appstoreconnect.apple.com';
async function api(method, p, body) {
  const res = await fetch(BASE + p, {
    method, headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status}: ${text.slice(0, 800)}`);
  return json;
}

function writeLocalCredentials(p12Buf, profileBuf, password) {
  fs.mkdirSync('secrets', { recursive: true });
  fs.writeFileSync('secrets/dist.p12', p12Buf);
  fs.writeFileSync('secrets/rezzies.mobileprovision', profileBuf);
  fs.writeFileSync('credentials.json', JSON.stringify({
    ios: {
      provisioningProfilePath: 'secrets/rezzies.mobileprovision',
      distributionCertificate: { path: 'secrets/dist.p12', password },
    },
  }, null, 2));
}

(async () => {
  const action = process.argv[2] || 'provision';

  if (action === 'list-certs') {
    const r = await api('GET', '/v1/certificates?limit=200');
    for (const c of (r.data || [])) console.log(c.id, c.attributes.certificateType, c.attributes.displayName, 'exp:' + c.attributes.expirationDate);
    return;
  }

  if (action === 'provision') {
    // Reuse the PINNED cert from Vault. No Apple calls, no revocation.
    const p12b64 = vaultGet('REZZIES_IOS_DIST_P12_B64');
    const password = vaultGet('REZZIES_IOS_DIST_P12_PASSWORD') || 'rezzies';
    const profb64 = vaultGet('REZZIES_IOS_PROVISIONING_PROFILE_B64');
    if (!p12b64 || !profb64) {
      console.error('ERROR: pinned cert not found in Vault (REZZIES_IOS_DIST_P12_B64 / REZZIES_IOS_PROVISIONING_PROFILE_B64).');
      console.error('Run `node scripts/provision-ios-credentials.js mint` once, store the printed base64 in Vault, then retry.');
      process.exit(1);
    }
    writeLocalCredentials(Buffer.from(p12b64, 'base64'), Buffer.from(profb64, 'base64'), password);
    console.log('[provision] wrote secrets/dist.p12 + secrets/rezzies.mobileprovision + credentials.json from pinned Vault cert (no Apple calls).');
    return;
  }

  if (action === 'mint') {
    fs.mkdirSync(OUT, { recursive: true });
    // Deliberately NO certificate revocation — that was the email-spam root cause.
    const keyPem = `${OUT}/dist.key.pem`, csrPem = `${OUT}/dist.csr.pem`;
    execSync(`openssl genrsa -out ${keyPem} 2048`, { stdio: 'ignore' });
    execSync(`openssl req -new -key ${keyPem} -out ${csrPem} -subj "/CN=Rezzies Distribution/O=e-baas"`, { stdio: 'ignore' });
    const cert = await api('POST', '/v1/certificates', { data: { type: 'certificates', attributes: { certificateType: 'DISTRIBUTION', csrContent: fs.readFileSync(csrPem, 'utf8') } } });
    const certId = cert.data.id;
    console.log('[mint] created DISTRIBUTION cert', certId, '(no existing cert was revoked)');
    fs.writeFileSync(`${OUT}/dist.cer`, Buffer.from(cert.data.attributes.certificateContent, 'base64'));
    const certPemPath = `${OUT}/dist.cert.pem`;
    execSync(`openssl x509 -inform DER -in ${OUT}/dist.cer -out ${certPemPath}`, { stdio: 'ignore' });

    const bids = await api('GET', `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE)}&limit=200`);
    let bundleRef = (bids.data || []).find(b => b.attributes.identifier === BUNDLE)?.id;
    if (!bundleRef) { const nb = await api('POST', '/v1/bundleIds', { data: { type: 'bundleIds', attributes: { identifier: BUNDLE, name: 'Rezzies', platform: 'IOS' } } }); bundleRef = nb.data.id; }
    try { await api('POST', '/v1/bundleIdCapabilities', { data: { type: 'bundleIdCapabilities', attributes: { capabilityType: 'PUSH_NOTIFICATIONS' }, relationships: { bundleId: { data: { type: 'bundleIds', id: bundleRef } } } } }); console.log('[mint] push capability enabled'); }
    catch (e) { console.log('[mint] push capability:', e.message.split('\n')[0]); }

    const profName = 'Rezzies App Store';
    const profs = await api('GET', `/v1/profiles?filter[name]=${encodeURIComponent(profName)}&limit=200`);
    for (const p of (profs.data || [])) if (p.attributes.name === profName) { try { await api('DELETE', `/v1/profiles/${p.id}`); } catch {} } // deleting a PROFILE is silent (no email)
    const prof = await api('POST', '/v1/profiles', { data: { type: 'profiles', attributes: { name: profName, profileType: 'IOS_APP_STORE' }, relationships: { bundleId: { data: { type: 'bundleIds', id: bundleRef } }, certificates: { data: [{ type: 'certificates', id: certId }] } } } });
    fs.writeFileSync(`${OUT}/rezzies.mobileprovision`, Buffer.from(prof.data.attributes.profileContent, 'base64'));
    console.log('[mint] created profile', prof.data.id);

    const forge = require('node-forge');
    const pw = 'rezzies';
    const p12 = forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(fs.readFileSync(keyPem, 'utf8')), [forge.pki.certificateFromPem(fs.readFileSync(certPemPath, 'utf8'))], pw, { algorithm: '3des' });
    fs.writeFileSync(`${OUT}/dist.p12`, Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'));
    const p12b64 = fs.readFileSync(`${OUT}/dist.p12`).toString('base64');
    const profb64 = fs.readFileSync(`${OUT}/rezzies.mobileprovision`).toString('base64');
    console.log('[mint] wrote', `${OUT}/dist.p12`);
    console.log('\nStore these in Vault to pin the cert (so future builds reuse it):');
    console.log(`  tyctl vault set REZZIES_IOS_DIST_P12_B64 --value "${p12b64.slice(0, 12)}…"   # full value in ${OUT}/p12.b64`);
    console.log(`  tyctl vault set REZZIES_IOS_DIST_P12_PASSWORD --value "${pw}"`);
    console.log(`  tyctl vault set REZZIES_IOS_PROVISIONING_PROFILE_B64 --value "…"   # full value in ${OUT}/profile.b64`);
    fs.writeFileSync(`${OUT}/p12.b64`, p12b64);
    fs.writeFileSync(`${OUT}/profile.b64`, profb64);
    console.log(JSON.stringify({ certId, profileId: prof.data.id }));
    return;
  }

  console.error('usage: provision-ios-credentials.js [provision|mint|list-certs]');
  process.exit(2);
})().catch(e => { console.error(e.message || e); process.exit(1); });

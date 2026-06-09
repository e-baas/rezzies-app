#!/usr/bin/env node
/*
 * App Store Connect API: provision an iOS Apple Distribution certificate +
 * push-enabled App Store provisioning profile fully non-interactively, then
 * emit credentials.json + dist.p12 + rezzies.mobileprovision for
 * `eas build --profile testflight` (which sets credentialsSource: "local").
 *
 * Why this exists: EAS cannot generate iOS distribution credentials in
 * --non-interactive mode (it needs an interactive Apple-ID login + team-type
 * selection). This script uses the ASC API key (already in Vault) to create
 * them via the App Store Connect REST API instead — no human login required.
 * It also enables the Push Notifications capability on the App ID, because
 * expo-notifications injects the aps-environment entitlement.
 *
 * Requires: openssl (system) + `jsonwebtoken` and `node-forge` npm packages
 * (install them in a scratch dir — they are NOT app dependencies):
 *   mkdir -p /tmp/asc && cd /tmp/asc && npm i jsonwebtoken node-forge
 *   cd <repo> && node scripts/bootstrap-asc-key.js   # writes ./secrets/asc-api-key.p8
 *   export ASC_KEY_ID=$(tyctl vault get APP_STORE_CONNECT_KEY_ID | jq -r .value)
 *   export ASC_ISSUER_ID=$(tyctl vault get APP_STORE_CONNECT_ISSUER_ID | jq -r .value)
 *   export ASC_P8_PATH="$(pwd)/secrets/asc-api-key.p8"
 *   export BUNDLE_ID=com.ebaas.rezzies OUT_DIR=/tmp/ioscreds
 *   export NODE_PATH=/tmp/asc/node_modules
 *   node scripts/provision-ios-credentials.js provision
 * Then: cp /tmp/ioscreds/{dist.p12,rezzies.mobileprovision} ./secrets/ and put
 * credentials.json at repo root with paths relative to root (see runbook).
 */
const fs = require('fs');
const { execSync } = require('child_process');
const jwt = require('jsonwebtoken');
const forge = require('node-forge');

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER = process.env.ASC_ISSUER_ID;
const P8 = process.env.ASC_P8_PATH;
const BUNDLE = process.env.BUNDLE_ID || 'com.ebaas.rezzies';
const OUT = process.env.OUT_DIR || '/tmp/ioscreds';
fs.mkdirSync(OUT, { recursive: true });

const privKey = fs.readFileSync(P8, 'utf8');
function token() {
  return jwt.sign({}, privKey, {
    algorithm: 'ES256',
    keyid: KEY_ID,
    issuer: ISSUER,
    audience: 'appstoreconnect-v1',
    expiresIn: '18m',
    header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
  });
}
const BASE = 'https://api.appstoreconnect.apple.com';
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 800)}`);
  }
  return json;
}

(async () => {
  const action = process.argv[2];

  if (action === 'list-certs') {
    const r = await api('GET', '/v1/certificates?limit=200');
    for (const c of r.data) {
      console.log(c.id, c.attributes.certificateType, c.attributes.displayName, 'exp:' + c.attributes.expirationDate);
    }
    return;
  }

  if (action === 'provision') {
    // 0) Revoke existing DISTRIBUTION certs we no longer hold the private key for.
    //    Apple caps Apple Distribution certs at 2; we consolidate to one fresh
    //    cert+key we control. Set KEEP_CERTS=1 to skip.
    if (!process.env.KEEP_CERTS) {
      const existing = await api('GET', '/v1/certificates?limit=200');
      for (const c of (existing.data || [])) {
        if (c.attributes.certificateType === 'DISTRIBUTION') {
          try { await api('DELETE', `/v1/certificates/${c.id}`); console.log('[asc] revoked stale DISTRIBUTION cert', c.id); }
          catch (e) { console.log('[asc] could not revoke', c.id, '-', e.message.split('\n')[0]); }
        }
      }
    }

    // 1) Private key + CSR
    const keyPem = `${OUT}/dist.key.pem`;
    const csrPem = `${OUT}/dist.csr.pem`;
    execSync(`openssl genrsa -out ${keyPem} 2048`, { stdio: 'ignore' });
    execSync(`openssl req -new -key ${keyPem} -out ${csrPem} -subj "/CN=Rezzies Distribution/O=e-baas"`, { stdio: 'ignore' });
    const csr = fs.readFileSync(csrPem, 'utf8');

    // 2) Create Apple Distribution certificate
    let certId, certContent;
    try {
      const cert = await api('POST', '/v1/certificates', {
        data: { type: 'certificates', attributes: { certificateType: 'DISTRIBUTION', csrContent: csr } },
      });
      certId = cert.data.id;
      certContent = cert.data.attributes.certificateContent;
      console.log('[asc] created DISTRIBUTION cert', certId);
    } catch (e) {
      console.error('[asc] cert create failed:', e.message);
      throw e;
    }

    // Build PEM cert from base64 DER
    const der = Buffer.from(certContent, 'base64');
    const certPemPath = `${OUT}/dist.cert.pem`;
    fs.writeFileSync(`${OUT}/dist.cer`, der);
    execSync(`openssl x509 -inform DER -in ${OUT}/dist.cer -out ${certPemPath}`, { stdio: 'ignore' });

    // 3) Bundle ID — find or create
    let bundleIdRef;
    const bids = await api('GET', `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE)}&limit=200`);
    const existing = (bids.data || []).find(b => b.attributes.identifier === BUNDLE);
    if (existing) {
      bundleIdRef = existing.id;
      console.log('[asc] found bundleId', BUNDLE, bundleIdRef);
    } else {
      const nb = await api('POST', '/v1/bundleIds', {
        data: { type: 'bundleIds', attributes: { identifier: BUNDLE, name: 'Rezzies', platform: 'IOS' } },
      });
      bundleIdRef = nb.data.id;
      console.log('[asc] created bundleId', BUNDLE, bundleIdRef);
    }

    // 3b) Enable Push Notifications capability on the App ID (expo-notifications
    //     adds the aps-environment entitlement, so the profile must include it).
    try {
      await api('POST', '/v1/bundleIdCapabilities', {
        data: {
          type: 'bundleIdCapabilities',
          attributes: { capabilityType: 'PUSH_NOTIFICATIONS' },
          relationships: { bundleId: { data: { type: 'bundleIds', id: bundleIdRef } } },
        },
      });
      console.log('[asc] enabled PUSH_NOTIFICATIONS capability');
    } catch (e) {
      // 409 = already enabled; anything else is informative but non-fatal here
      console.log('[asc] push capability:', e.message.split('\n')[0]);
    }

    // 4) App Store provisioning profile (no devices needed)
    // Remove any existing IOS_APP_STORE profiles with same name to avoid dupes
    const profName = 'Rezzies App Store';
    const profs = await api('GET', `/v1/profiles?filter[name]=${encodeURIComponent(profName)}&limit=200`);
    for (const p of (profs.data || [])) {
      if (p.attributes.name === profName) {
        try { await api('DELETE', `/v1/profiles/${p.id}`); console.log('[asc] deleted stale profile', p.id); } catch {}
      }
    }
    const prof = await api('POST', '/v1/profiles', {
      data: {
        type: 'profiles',
        attributes: { name: profName, profileType: 'IOS_APP_STORE' },
        relationships: {
          bundleId: { data: { type: 'bundleIds', id: bundleIdRef } },
          certificates: { data: [{ type: 'certificates', id: certId }] },
        },
      },
    });
    const profileContent = prof.data.attributes.profileContent;
    const profPath = `${OUT}/rezzies.mobileprovision`;
    fs.writeFileSync(profPath, Buffer.from(profileContent, 'base64'));
    console.log('[asc] created profile', prof.data.id);

    // 5) Package .p12 (cert + key) with node-forge
    const p12Password = 'rezzies';
    const keyObj = forge.pki.privateKeyFromPem(fs.readFileSync(keyPem, 'utf8'));
    const certObj = forge.pki.certificateFromPem(fs.readFileSync(certPemPath, 'utf8'));
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keyObj, [certObj], p12Password, { algorithm: '3des' });
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    const p12Path = `${OUT}/dist.p12`;
    fs.writeFileSync(p12Path, Buffer.from(p12Der, 'binary'));
    console.log('[asc] wrote p12', p12Path);

    // 6) credentials.json
    const creds = {
      ios: {
        provisioningProfilePath: profPath,
        distributionCertificate: { path: p12Path, password: p12Password },
      },
    };
    fs.writeFileSync(`${OUT}/credentials.json`, JSON.stringify(creds, null, 2));
    console.log('[asc] wrote credentials.json');
    console.log(JSON.stringify({ certId, bundleIdRef, profileId: prof.data.id, p12Path, profPath }));
    return;
  }

  console.error('usage: asc.js list-certs|provision');
  process.exit(2);
})().catch(e => { console.error(e.message || e); process.exit(1); });

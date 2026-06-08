# Pilot Build Runbook (TYC-139)

Concrete steps to produce the first **TestFlight (iOS)** build and the first
**Expo EAS internal distribution APK (Android)** for the friends-and-family
pilot. Tasks 137 (visual polish) and 138 (push notifications) must land in `main`
before running this — otherwise pilot families get a pre-polish, no-reminder
build.

Read [docs/install-flow.md](./install-flow.md) for the pilot-facing instructions.
This file is the operator-facing build/submit sequence.

---

## Prereqs (one-time)

| Item | Source | How |
|---|---|---|
| Expo account + project linked to slug `rezzies-app` | chairman | one-time `eas init` against the e-baas Expo org |
| `EXPO_TOKEN` (long-lived) | Expo → Settings → Access Tokens | store in Vault as `EXPO_TOKEN`; CI consumes it via env |
| Apple Developer Team `F3SY7UT5BV` active + Agreements signed | chairman | App Store Connect → Agreements / Membership |
| App record in App Store Connect for `com.ebaas.rezzies` | chairman or `eas submit` first run | the first `eas submit --auto-submit` will create it if missing |
| ASC API key (.p8) | Vault `APP_STORE_CONNECT_PRIVATE_KEY` | `node scripts/bootstrap-asc-key.js` writes `./secrets/asc-api-key.p8` |

All other Apple identifiers (`APPLE_TEAM_ID`, `APP_STORE_CONNECT_ISSUER_ID`,
`APP_STORE_CONNECT_KEY_ID`, `REZZIES_BUNDLE_ID`, `REZZIES_APP_DISPLAY_NAME`,
`REZZIES_APPLE_CONTACT_EMAIL`) are already in Vault.

---

## Sequence

### 0. Block check

```bash
git fetch origin main && git log --oneline origin/main -10
```

Confirm both of these commits are present on `origin/main`:
- TYC-137 — visual polish pass on first-7-day screens
- TYC-138 — push notifications + incomplete-task reminders

If not present, stop. The pilot build must include both.

### 1. Replace placeholder assets (one-time)

The current `assets/icon.png`, `adaptive-icon.png`, `splash.png`, `favicon.png`
are **solid #0F172A placeholders**. They must be replaced with the approved
artwork before the first TestFlight submission. The EARLY-CHECKPOINT on TYC-139
captures the chairman's approval for the final artwork; commit the approved
files into `assets/` and bump `expo.ios.buildNumber` + `expo.android.versionCode`
in `app.json`.

### 2. Login and key bootstrap

```bash
export EXPO_TOKEN="$(tyctl vault get EXPO_TOKEN --raw)"
node scripts/bootstrap-asc-key.js     # writes ./secrets/asc-api-key.p8 (0600)
```

### 3. Build iOS (TestFlight) + Android (internal APK)

```bash
npx eas-cli build --profile internal --platform ios     --non-interactive
npx eas-cli build --profile internal --platform android --non-interactive
```

`appVersionSource: remote` means EAS owns `buildNumber`/`versionCode`
auto-increment — no manual bumps required between builds.

### 4. Submit iOS to TestFlight

```bash
npx eas-cli submit --profile internal --platform ios --latest --non-interactive
```

This uses the ASC API key path baked into `eas.json` (`./secrets/asc-api-key.p8`)
plus the Vault-loaded issuer/key IDs. The first run will create the ASC app
record for `com.ebaas.rezzies` if it doesn't already exist.

In App Store Connect → TestFlight, add internal testers:
- pilot family contact emails (≤25 internal testers, no Beta App Review needed)
- or set up an **external testing group** if any tester isn't on the e-baas team
  (one-time Beta App Review per build; takes hours, not days)

### 5. Distribute Android APK

`eas build --profile internal --platform android` produces a hosted
internal-distribution page (e.g. `https://expo.dev/accounts/<org>/projects/rezzies-app/builds/<id>`).
The build artifact is a single APK at `Download Build`. Forward that URL — or the
direct APK link — to pilot Android testers via the install-flow Doc.

Play Internal Testing is the fallback if any tester cannot side-load (Samsung
Knox, locked-down enterprise device). It requires uploading the `app-bundle`
from the `production` profile to Play Console; skip unless needed.

### 6. Verify

- TestFlight: install the build on the chairman's iPhone via the TestFlight
  invite. Confirm sign-up, join code, daily check-in, leaderboard, streak,
  notifications fire on schedule.
- Android: install the APK on the chairman's Android device. Same checklist.
- Second non-chairman tester: Dev installs on a personal device via the
  documented install flow (NO chairman next to them) and runs the same checklist.

When both verifications pass, this task closes DONE with the live TestFlight
share link, the EAS Android build URL, and a screenshot of each device home
screen showing the Rezzies icon installed.

---

## Reference

- App identity (Vault-sourced): bundle `com.ebaas.rezzies`, Team `F3SY7UT5BV`,
  display name from `REZZIES_APP_DISPLAY_NAME`, reviewer contact
  `REZZIES_APPLE_CONTACT_EMAIL`.
- Encryption: `ITSAppUsesNonExemptEncryption=false` is set in `app.json`, so
  TestFlight does not prompt for export-compliance per build.
- iOS `buildNumber` and Android `versionCode` are managed remotely by EAS.
  Do not bump them by hand unless you're recovering from a build-number conflict
  in App Store Connect.

---

made with [Tycoon.us](https://tycoon.us) · [superagent](https://tycoon.us)

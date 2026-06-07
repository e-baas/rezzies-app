# Rezzies — Install Flow (Pilot Build)

This is the install guide for the 3-5 pilot families. The Rezzies app is in
**internal testing only** — not publicly available on the App Store or Play
Store. You install it through Apple TestFlight (iOS) or a direct APK link
(Android, via Expo EAS internal distribution).

---

## iOS — TestFlight

### Step 1. Install TestFlight

1. Open the App Store on your iPhone.
2. Search **TestFlight** (by Apple) and install it.
3. Open TestFlight once and sign in with the **Apple ID you'll use to test
   Rezzies**.

### Step 2. Accept your invite

1. The chairman will send you a **TestFlight invite link** by email or text
   message. The email subject will be something like
   *"You're invited to test Rezzies"*.
2. Tap the link on your iPhone.
3. TestFlight will open and show **Rezzies — Accept**. Tap **Accept**.

### Step 3. Install Rezzies

1. Tap **Install** in TestFlight.
2. Wait for the download (≈30 seconds on Wi-Fi).
3. Tap **Open**, or find the Rezzies icon on your home screen.

### Step 4. First launch

1. Sign up with your email + password (this creates your Rezzies profile in
   Supabase).
2. Enter the **join code** the program sponsor shares with you.
3. You're in. Start your first daily check-in.

### What to expect

- **Updates**: TestFlight will notify you when a new build is available.
  Tap **Update** to install. Builds expire 90 days after upload.
- **Crash reports**: TestFlight automatically sends crash logs back to us. No
  action needed.
- **Feedback**: shake your phone in the app to open the TestFlight feedback
  sheet, or screenshot + share via the share sheet.

---

## Android — Expo EAS Internal Distribution

### Step 1. Allow installs from unknown sources

1. Open **Settings → Apps → Special access → Install unknown apps**.
2. Find your browser (Chrome) and toggle **Allow from this source**.
   (Wording varies slightly by phone manufacturer.)

### Step 2. Tap the install link

1. The chairman will send you a **rezzies-pilot.apk** link by email or text.
2. Tap the link on your Android phone.
3. Your browser will download the APK.

### Step 3. Install

1. Tap the downloaded APK file (in your notification shade or Downloads
   folder).
2. Tap **Install**. Android will warn you the app is from an unknown
   developer — tap **Install anyway**.
3. Tap **Open** when install finishes.

### Step 4. First launch

Same as iOS Step 4 above.

### What to expect

- **Updates**: we'll send a new link when a new build is ready. Tap to
  install over the old one (your data is preserved).
- **No automatic update prompts** on Android internal distribution. Watch
  for the chairman's "new build available" message.

---

## Trouble?

| Problem | Try this |
|---|---|
| TestFlight says invite expired | Reply to the chairman and ask for a fresh invite — the link is one-time. |
| App crashes on launch | Screenshot the error and send it. Reinstall from the same link. |
| Can't sign in | Make sure you're on Wi-Fi or cellular data. Try resetting the password from the sign-in screen. |
| Join code doesn't work | Confirm the code with your program sponsor. Codes are 6 characters, case-insensitive. |
| Don't see today's habits | Pull down to refresh on the Home tab. |

---

## App identity

- **App name (home screen):** Rezzies
- **Bundle ID (iOS):** `com.ebaas.rezzies`
- **Package (Android):** `com.ebaas.rezzies`
- **Apple Developer Team:** F3SY7UT5BV (e-baas venture identity)
- **Internal contact:** dan@amaze.net

---

made with [Tycoon.us](https://tycoon.us) · [superagent](https://tycoon.us)

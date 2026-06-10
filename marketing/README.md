# Rezzies marketing assets

## Pilot flyer (`pilot-flyer.html`)

Bold one-page recruitment flyer for the friends-and-family pilot — the
exciting, visual counterpart to the leader guide. US-Letter portrait,
renders to a single-page PDF for print or digital share.

**Narrative flow (chairman revision, TYC-157):** big Rezzies name reveal →
clear warm intro (healthy habits as a family game; "compete together ·
complete together") → a "you're invited to help us test it" invitation
(noting the pilot prize money is a thank-you, not part of the regular
program) → the in-family contest with **$50** to each family's
**top points-scorer** → *then* the **$100** grand prize for the pilot
family with the **highest combined points** → app screenshots →
at-a-glance install (iPhone TestFlight / Android link) → how to join.

**Pilot contact:** **Tiffany** runs the pilot — `tiffany@rezzies.co`.
(That inbox on the `rezzies.co` domain is being stood up; confirm it's
live before wide distribution.) Two QR codes currently point to
**placeholder URLs** — swap them once the real install-flow doc and leader
guide are live (see below).

### Regenerate the PDF

```bash
chromium-browser --headless --no-sandbox --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=rezzies-pilot-flyer.pdf \
  "file://$(pwd)/pilot-flyer.html"
```

(Any Chromium/Chrome works — `--print-to-pdf` honors the `@page size: 8.5in 11in`.)

### Updating the QR codes / links

The QR PNGs in `assets/` were generated from placeholder URLs:

- `qr-install.png` → `https://rezzies.app/install`
- `qr-guide.png` → `https://rezzies.app/leader-guide`

Regenerate with the `qrcode` CLI/lib against the real URLs and overwrite the
PNGs, then re-render the PDF.

### Assets

App screenshots (`screen-checkin.png`, `screen-leaderboard.png`,
`screen-streak.png`) are pulled from the v2 visual mockup (Direction A,
teal). The logo is referenced live from `../assets/brand/svg/`.

**Blended screenshots** (`screen-checkin-blend.png`,
`screen-leaderboard-blend.png`, `screen-streak-blend.png`) are the
flyer-ready versions: the app's flat dark page background is recolored to
the flyer's navy (`#0C1322`) so the screens blend into the flyer background
instead of reading as hard dark rectangles. Only the flat page background
is recolored — the elevated cards, rings, habit pills, leaderboard content,
trophy, gold text, and teal day pills are left untouched. The flyer
references the `-blend` files (all three now sit bare on a soft shadow +
faint teal glow, no card frame or border); the originals are kept as the
raw source screenshots.

Regenerate the check-in / leaderboard blends by recoloring near-neutral
pixels with `max(r,g,b) <= 16` → `#0C1322`. The Perfect Week (`streak`)
blend has a lighter `#161616` page background, so use `blend-streak.js`
(near-neutral pixels with `max(r,g,b) <= 40` and low saturation →
`#0C1322`):

```bash
npm install sharp --no-save && node blend-streak.js
```

---

made with [Tycoon.us](https://tycoon.us) · [superagent](https://tycoon.us)

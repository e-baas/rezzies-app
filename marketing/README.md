# Rezzies marketing assets

## Pilot flyer (`pilot-flyer.html`)

Bold one-page recruitment flyer for the friends-and-family pilot — the
exciting, visual counterpart to the leader guide. US-Letter portrait,
renders to a single-page PDF for print or digital share.

**Narrative flow (chairman revision, TYC-157):** big Rezzies name reveal →
clear warm intro (healthy habits as a family game; "compete together ·
complete together") → a "you're invited to help us test it" invitation →
the in-family contest with **$50** to each family's most consistent player
→ *then* the **$100** grand prize for the family with the best total
overall → app screenshots → at-a-glance install (iPhone TestFlight /
Android link) → how to join.

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

---

made with [Tycoon.us](https://tycoon.us) · [superagent](https://tycoon.us)

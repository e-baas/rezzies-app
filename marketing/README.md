# Rezzies marketing assets

## Pilot flyer (`pilot-flyer.html`)

Bold one-page recruitment flyer for the friends-and-family pilot — the
exciting, visual counterpart to the leader guide. US-Letter portrait,
renders to a single-page PDF for print or digital share.

**Contents:** what Rezzies is, the 14-day "your family vs. theirs" pitch,
prize structure ($50 Amazon card per family winner · $100 for the top
family overall), at-a-glance install steps (iPhone TestFlight / Android
link), and how to join (`dan@amaze.net`). Two QR codes currently point to
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

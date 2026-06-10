// Recolor the streak screenshot's flat near-black page background (#0A0A0A)
// to the flyer navy (#0C1322) so the Perfect Week graphic blends into the
// flyer like the other phone screens. Only near-neutral-dark pixels
// (max(r,g,b) <= 16) are swapped; the trophy, gold text, glow, and teal
// day pills are left untouched.
const sharp = require('sharp');

const NAVY = { r: 0x0c, g: 0x13, b: 0x22 }; // #0C1322
const SRC = 'assets/screen-streak.png';
const OUT = 'assets/screen-streak-blend.png';

(async () => {
  const img = sharp(SRC);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let swapped = 0;
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    // near-neutral (low saturation) AND dark → flat page bg / vignette
    if (mx <= 40 && (mx - mn) <= 8) {
      data[i] = NAVY.r;
      data[i + 1] = NAVY.g;
      data[i + 2] = NAVY.b;
      swapped++;
    }
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: ch } })
    .png()
    .toFile(OUT);
  console.log(`wrote ${OUT} — recolored ${swapped} px of ${info.width * info.height}`);
})();

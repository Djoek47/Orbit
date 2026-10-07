/**
 * Normalize device screenshots for App Store Connect IAP / subscription
 * "Review Information" uploads (must match app screenshot specs — not 1024² promo art).
 *
 * Output: 1290×2796 JPEG, sRGB, 72 dpi, no alpha (iPhone 6.7" portrait).
 *
 * Usage:
 *   node scripts/normalize-asc-iap-review-screenshots.mjs [input...]
 * Default inputs: bundled paths from the latest ASC capture set.
 */
import { mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import sharp from 'sharp';

const W = 1290;
const H = 2796;
const DPI = 72;
const BG = { r: 18, g: 10, b: 8 }; // near Choremaxx paywall backdrop

const OUT = join(process.cwd(), 'store/screenshots/asc-iap-review');
const ART = '/opt/cursor/artifacts/asc-iap-review';

const DEFAULTS = [
  {
    in: '/home/ubuntu/.cursor/projects/workspace/assets/33c21b28-cbff-4c79-8b2d-d8b2fde31880.png',
    out: 'poppins-tokens-credits-200-700-2000.jpg',
    note: 'Consumables — full Credits / Buy more actions (use for 200, 700, 2000 IAPs)',
  },
  {
    in: '/home/ubuntu/.cursor/projects/workspace/assets/c1ead2ed-e43b-45ee-be36-540727e67aa7.jpg',
    out: 'premium-yearly-review.jpg',
    note: 'Subscription — yearly paywall',
  },
  {
    in: '/home/ubuntu/.cursor/projects/workspace/assets/d0a97e8f-3719-4d35-a1ff-f4108dc0eec2.jpg',
    out: 'premium-monthly-review.jpg',
    note: 'Subscription — monthly paywall',
  },
];

mkdirSync(OUT, { recursive: true });
mkdirSync(ART, { recursive: true });

async function normalizeOne({ in: inputPath, out: outputName, note }) {
  const base = basename(inputPath);
  const meta = await sharp(inputPath).metadata();
  const resized = await sharp(inputPath)
    .rotate()
    .flatten({ background: BG })
    .resize(W, H, {
      fit: 'contain',
      background: BG,
      kernel: sharp.kernel.lanczos3,
    })
    .jpeg({
      quality: 92,
      chromaSubsampling: '4:4:4',
      mozjpeg: true,
    })
    .withMetadata({ density: DPI })
    .toBuffer();

  const final = await sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: BG,
    },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .jpeg({ quality: 92, mozjpeg: true })
    .withMetadata({ density: DPI })
    .toBuffer();

  const outPath = join(OUT, outputName);
  const artPath = join(ART, outputName);
  await sharp(final).toFile(outPath);
  await sharp(final).toFile(artPath);

  const check = await sharp(outPath).metadata();
  console.log(JSON.stringify({ outputName, note, source: base, from: `${meta.width}×${meta.height}`, to: `${check.width}×${check.height}`, format: check.format, outPath, artPath }, null, 2));

  // Aliases for consumable SKUs (same UI frame — ASC wants one file per IAP field)
  if (outputName.includes('tokens-credits')) {
    for (const alias of [
      'consumable-200-actions-review.jpg',
      'consumable-700-actions-review.jpg',
      'consumable-2000-actions-review.jpg',
    ]) {
      await sharp(final).toFile(join(OUT, alias));
      await sharp(final).toFile(join(ART, alias));
      console.log(`  → alias ${alias}`);
    }
  }
}

const inputs = process.argv.slice(2).length
  ? process.argv.slice(2).map((p) => ({ in: p, out: basename(p).replace(/\.[^.]+$/, '') + '-review.jpg' }))
  : DEFAULTS;

for (const item of inputs) {
  await normalizeOne(item);
}

console.log('\nUpload these JPEGs under Review Information → Capture d’écran (not the 1024×1024 promotional image).');

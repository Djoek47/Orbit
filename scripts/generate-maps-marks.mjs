/**
 * Generate Apple Maps / Google Maps / Waze lockup plates for Settings.
 * Run: node scripts/generate-maps-marks.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../assets/brand/maps');
fs.mkdirSync(OUT, { recursive: true });

async function plate({ file, bg, fg, label, accent }) {
  const size = 128;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="28" fill="${bg}"/>
  ${accent ?? ''}
  <text x="64" y="78" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700" fill="${fg}">${label}</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, file));
}

async function main() {
  await plate({
    file: 'apple-maps.png',
    bg: '#1C1C1E',
    fg: '#FFFFFF',
    label: '',
    accent: `
      <circle cx="64" cy="54" r="22" fill="#34C759"/>
      <circle cx="78" cy="46" r="16" fill="#FF9F0A"/>
      <circle cx="50" cy="46" r="16" fill="#0A84FF"/>
      <circle cx="64" cy="38" r="12" fill="#FF375F"/>
      <path d="M64 78 L58 104 L70 104 Z" fill="#F2F2F7"/>
    `,
  });
  await plate({
    file: 'google-maps.png',
    bg: '#FFFFFF',
    fg: '#1A73E8',
    label: '',
    accent: `
      <path d="M64 24 C48 24 36 38 36 54 C36 78 64 108 64 108 C64 108 92 78 92 54 C92 38 80 24 64 24 Z" fill="#EA4335"/>
      <circle cx="64" cy="54" r="12" fill="#FFFFFF"/>
    `,
  });
  await plate({
    file: 'waze.png',
    bg: '#33CCFF',
    fg: '#0B1B2B',
    label: '',
    accent: `
      <ellipse cx="64" cy="62" rx="34" ry="30" fill="#1C3A4A"/>
      <circle cx="52" cy="58" r="6" fill="#FFFFFF"/>
      <circle cx="76" cy="58" r="6" fill="#FFFFFF"/>
      <path d="M48 74 Q64 86 80 74" stroke="#33CCFF" stroke-width="4" fill="none" stroke-linecap="round"/>
    `,
  });
  console.log('wrote maps lockups to', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

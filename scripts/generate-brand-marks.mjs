#!/usr/bin/env node
/**
 * Regenerate themed Choremaxx *house* mark PNGs + store icons.
 * Requires: npm install sharp --no-save
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const themes = {
  coral: { roof: '#D85A30', body: '#E88B5C', sparkle: '#FAC775', bg: '#D85A30' },
  sky: { roof: '#378ADD', body: '#5BADE8', sparkle: '#FAC775', bg: '#378ADD' },
  berry: { roof: '#7F77DD', body: '#A49AE8', sparkle: '#F4C0D1', bg: '#7F77DD' },
  citrus: { roof: '#EF9F27', body: '#F5C56B', sparkle: '#712B13', bg: '#EF9F27' },
};

function houseSvg(t, { plate = true, mono = false, transparentPlate = false } = {}) {
  const roof = mono ? '#FFFFFF' : t.roof;
  const body = mono ? '#FFFFFF' : t.body;
  const sparkle = mono ? '#FFFFFF' : t.sparkle;
  const plateFill = mono || transparentPlate ? 'none' : t.bg;
  const plateRect =
    plate && !transparentPlate && !mono
      ? `<rect x="0" y="0" width="1024" height="1024" rx="224" fill="${plateFill}"/>`
      : '';
  const s = 11.43;
  const ox = (1024 - 56 * s) / 2;
  const oy = (1024 - 48 * s) / 2 + 20;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" fill="none">
  ${plateRect}
  <g transform="translate(${ox},${oy}) scale(${s})">
    <path d="M14 3.5 L15.1 7.2 L14 10.9 L12.9 7.2 Z" fill="${sparkle}"/>
    <path d="M10.2 7.2 L14 8.3 L17.8 7.2 L14 6.1 Z" fill="${sparkle}"/>
    <path d="M10 22 L28 6 L46 22" stroke="${roof}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M12 26 C18 22 24 22 28 26 C32 30 38 30 44 26 C42 34 38 40 28 42 C18 40 14 34 12 26 Z" fill="${body}"/>
  </g>
</svg>`;
}

async function writePng(file, svg, size = 1024) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  console.log('wrote', file, size);
}

const marksDir = path.join('assets/brand/marks');
fs.mkdirSync(marksDir, { recursive: true });

for (const [name, t] of Object.entries(themes)) {
  await writePng(path.join(marksDir, `choremaxx-mark-${name}.png`), houseSvg(t, { plate: true }), 512);
}

await writePng('assets/images/icon.png', houseSvg(themes.coral, { plate: true }), 1024);
await writePng('assets/images/splash-icon.png', houseSvg(themes.coral, { plate: true }), 512);
await writePng('assets/images/favicon.png', houseSvg(themes.coral, { plate: true }), 48);
await writePng(
  'assets/images/android-icon-foreground.png',
  houseSvg(themes.coral, { plate: false, transparentPlate: true }),
  1024
);
await sharp({
  create: { width: 1024, height: 1024, channels: 3, background: '#D85A30' },
})
  .png()
  .toFile('assets/images/android-icon-background.png');
await writePng(
  'assets/images/android-icon-monochrome.png',
  houseSvg(themes.coral, { plate: false, transparentPlate: true, mono: true }),
  1024
);
await writePng('assets/brand/choremaxx-logo-mark.png', houseSvg(themes.coral, { plate: true }), 512);
console.log('done');

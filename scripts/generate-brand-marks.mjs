#!/usr/bin/env node
/**
 * Regenerate themed Choremaxx mark PNGs + store icons.
 * Requires: npm install sharp --no-save
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const themes = {
  coral: { bg: '#D85A30', check: '#FFFFFF', bars: '#FAC775' },
  sky: { bg: '#378ADD', check: '#FFFFFF', bars: '#FAC775' },
  berry: { bg: '#7F77DD', check: '#FFFFFF', bars: '#F4C0D1' },
  citrus: { bg: '#EF9F27', check: '#712B13', bars: '#FFFFFF' },
};

function markSvg({ bg, check, bars }, { rounded = true, transparentBg = false, mono = false } = {}) {
  const bgFill = mono ? '#000000' : transparentBg ? 'none' : bg;
  const checkStroke = mono ? '#FFFFFF' : check;
  const barFill = mono ? '#FFFFFF' : bars;
  const rect = rounded
    ? `<rect x="0" y="0" width="1024" height="1024" rx="224" fill="${bgFill}"/>`
    : transparentBg
      ? ''
      : `<rect x="0" y="0" width="1024" height="1024" fill="${bgFill}"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" fill="none">
  ${rect}
  <path d="M288 504 L440 656 L744 328" stroke="${checkStroke}" stroke-width="88" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <rect x="288" y="736" width="112" height="160" rx="32" fill="${barFill}"/>
  <rect x="456" y="656" width="112" height="240" rx="32" fill="${barFill}"/>
  <rect x="624" y="560" width="112" height="336" rx="32" fill="${barFill}"/>
</svg>`;
}

async function writePng(file, svg, size = 1024) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  console.log('wrote', file, size);
}

const marksDir = path.join('assets/brand/marks');
fs.mkdirSync(marksDir, { recursive: true });

for (const [name, colors] of Object.entries(themes)) {
  await writePng(path.join(marksDir, `choremaxx-mark-${name}.png`), markSvg(colors), 512);
}

await writePng('assets/images/icon.png', markSvg(themes.coral, { rounded: false }), 1024);
await writePng('assets/images/splash-icon.png', markSvg(themes.coral, { rounded: true }), 512);
await writePng('assets/images/favicon.png', markSvg(themes.coral, { rounded: true }), 48);
await writePng(
  'assets/images/android-icon-foreground.png',
  markSvg(themes.coral, { rounded: false, transparentBg: true }),
  1024
);
await sharp({
  create: { width: 1024, height: 1024, channels: 3, background: '#D85A30' },
})
  .png()
  .toFile('assets/images/android-icon-background.png');
await writePng(
  'assets/images/android-icon-monochrome.png',
  markSvg(themes.coral, { rounded: false, transparentBg: true, mono: true }),
  1024
);
await writePng('assets/brand/choremaxx-logo-mark.png', markSvg(themes.coral, { rounded: true }), 512);
console.log('done');

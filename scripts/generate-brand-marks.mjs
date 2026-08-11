#!/usr/bin/env node
/**
 * Regenerate themed Choremaxx *house* mark PNGs + store / alternate icons.
 * Plated icons use high-contrast roof/body/sparkle so the full house reads
 * on primary-colored plates (fixes invisible roof on coral TestFlight icon).
 *
 * Usage: npm run generate:brand-marks
 * Requires: sharp (devDependency)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Palette plates: primary background.
 * On plated icons, roof/body/sparkle are chosen for contrast on that plate
 * (not the same hex as bg — that made the roof disappear).
 */
const themes = {
  coral: {
    bg: '#D85A30',
    roof: '#FFF6EE',
    body: '#FFE0CC',
    sparkle: '#FAC775',
    // Transparent FG / in-app style (palette-accurate)
    fgRoof: '#D85A30',
    fgBody: '#E88B5C',
    fgSparkle: '#FAC775',
  },
  sky: {
    bg: '#378ADD',
    roof: '#F5FBFF',
    body: '#D6ECFF',
    sparkle: '#FAC775',
    fgRoof: '#378ADD',
    fgBody: '#5BADE8',
    fgSparkle: '#FAC775',
  },
  citrus: {
    bg: '#EF9F27',
    roof: '#FFF8EF',
    body: '#FFE9C2',
    sparkle: '#712B13',
    fgRoof: '#EF9F27',
    fgBody: '#F5C56B',
    fgSparkle: '#712B13',
  },
  berry: {
    bg: '#7F77DD',
    roof: '#F8F5FF',
    body: '#E4DFFA',
    sparkle: '#F4C0D1',
    fgRoof: '#7F77DD',
    fgBody: '#A49AE8',
    fgSparkle: '#F4C0D1',
  },
};

function houseSvg(
  t,
  {
    plate = true,
    mono = false,
    transparentPlate = false,
    /** When true, use fg* colors (palette-accurate) instead of plated contrast. */
    paletteAccurate = false,
    /** Solid white/black house for iOS tinted mode. */
    tintSilhouette = false,
  } = {}
) {
  let roof;
  let body;
  let sparkle;
  if (mono || tintSilhouette) {
    roof = body = sparkle = '#FFFFFF';
  } else if (paletteAccurate || transparentPlate) {
    roof = t.fgRoof;
    body = t.fgBody;
    sparkle = t.fgSparkle;
  } else {
    roof = t.roof;
    body = t.body;
    sparkle = t.sparkle;
  }

  const plateFill = mono || transparentPlate || tintSilhouette ? 'none' : t.bg;
  const plateRect =
    plate && !transparentPlate && !mono && !tintSilhouette
      ? `<rect x="0" y="0" width="1024" height="1024" rx="224" fill="${plateFill}"/>`
      : '';

  // Slightly larger mark so the house fills the plate better (was too small).
  const s = 13.2;
  const ox = (1024 - 56 * s) / 2;
  const oy = (1024 - 48 * s) / 2 + 12;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" fill="none">
  ${plateRect}
  <g transform="translate(${ox},${oy}) scale(${s})">
    <path d="M14 3.5 L15.1 7.2 L14 10.9 L12.9 7.2 Z" fill="${sparkle}"/>
    <path d="M10.2 7.2 L14 8.3 L17.8 7.2 L14 6.1 Z" fill="${sparkle}"/>
    <path d="M10 22 L28 6 L46 22" stroke="${roof}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M12 26 C18 22 24 22 28 26 C32 30 38 30 44 26 C42 34 38 40 28 42 C18 40 14 34 12 26 Z" fill="${body}"/>
  </g>
</svg>`;
}

async function writePng(file, svg, size = 1024) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  console.log('wrote', file, size);
}

const marksDir = path.join('assets/brand/marks');
const iconsDir = path.join('assets/brand/icons');
fs.mkdirSync(marksDir, { recursive: true });
fs.mkdirSync(iconsDir, { recursive: true });

for (const [name, t] of Object.entries(themes)) {
  // Header / glass marks (plated, high contrast)
  await writePng(path.join(marksDir, `choremaxx-mark-${name}.png`), houseSvg(t, { plate: true }), 512);
  // Alternate home-screen icons (1024 plated)
  await writePng(path.join(iconsDir, `icon-${name}.png`), houseSvg(t, { plate: true }), 1024);
  // Android adaptive FG for alternate icons (transparent plate, palette-accurate)
  await writePng(
    path.join(iconsDir, `icon-${name}-foreground.png`),
    houseSvg(t, { plate: false, transparentPlate: true }),
    1024
  );
  // Per-palette tinted silhouette (white house)
  await writePng(
    path.join(iconsDir, `icon-${name}-tinted.png`),
    houseSvg(t, { plate: false, transparentPlate: true, tintSilhouette: true }),
    1024
  );
  // Per-palette dark plate variant
  const darkPlate = {
    ...t,
    bg: name === 'sky' ? '#07121F' : name === 'citrus' ? '#1A1208' : name === 'berry' ? '#100A1C' : '#1A0C08',
  };
  await writePng(path.join(iconsDir, `icon-${name}-dark.png`), houseSvg(darkPlate, { plate: true }), 1024);
}

// Default store / Expo icon = well-lit coral
await writePng('assets/images/icon.png', houseSvg(themes.coral, { plate: true }), 1024);
await writePng('assets/images/splash-icon.png', houseSvg(themes.coral, { plate: true }), 512);
await writePng('assets/images/favicon.png', houseSvg(themes.coral, { plate: true }), 48);

// Android adaptive: transparent FG with palette-accurate house
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
console.log('wrote assets/images/android-icon-background.png');

await writePng(
  'assets/images/android-icon-monochrome.png',
  houseSvg(themes.coral, { plate: false, transparentPlate: true, mono: true }),
  1024
);

// iOS appearance variants of default (coral well-lit + tint silhouette)
await writePng(
  'assets/images/icon-light.png',
  houseSvg(themes.coral, { plate: true }),
  1024
);
// Dark mode plate: deep night with lit coral house
const darkTheme = {
  ...themes.coral,
  bg: '#1A0C08',
  roof: '#FFE0CC',
  body: '#E88B5C',
  sparkle: '#FAC775',
};
await writePng('assets/images/icon-dark.png', houseSvg(darkTheme, { plate: true }), 1024);
// Tinted: white silhouette on transparent (system applies tint)
await writePng(
  'assets/images/icon-tinted.png',
  houseSvg(themes.coral, { plate: false, transparentPlate: true, tintSilhouette: true }),
  1024
);

await writePng('assets/brand/choremaxx-logo-mark.png', houseSvg(themes.coral, { plate: true }), 512);

console.log('done — well-lit house marks + alternate icons');

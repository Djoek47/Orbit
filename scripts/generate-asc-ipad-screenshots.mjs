/**
 * Temporary App Store Connect iPad 13" screenshots (portrait 2064×2752).
 * Marketing-style frames for upload while real device shots are pending.
 * Run: node scripts/generate-asc-ipad-screenshots.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const W = 2064;
const H = 2752;
const OUT = join(process.cwd(), 'store/screenshots/ipad-13');
const ART = '/opt/cursor/artifacts/asc-ipad-13';

mkdirSync(OUT, { recursive: true });
mkdirSync(ART, { recursive: true });

const screens = [
  {
    file: '01-home.png',
    kicker: 'HOME',
    title: "Today's Tasks",
    lines: ['Emma · unload dishwasher', 'Jack · homework packet', 'Streak matches Household Health'],
    accent: '#2DD4BF',
  },
  {
    file: '02-tasks.png',
    kicker: 'TASKS',
    title: 'Clear responsibilities',
    lines: ['Assign · request proof · approve', 'Kids see only what they need', 'Parents stay in control'],
    accent: '#38BDF8',
  },
  {
    file: '03-ranks.png',
    kicker: 'RANKS',
    title: 'Family momentum',
    lines: ['XP · streaks · rewards vault', 'Fair scoring for the whole house', 'Celebrate without pressure'],
    accent: '#FBBF24',
  },
  {
    file: '04-grocery.png',
    kicker: 'GROCERY',
    title: 'Lists that travel',
    lines: ['Shared list · Smart Shopping', 'Near-home suggestions', 'Open the list when you arrive'],
    accent: '#A78BFA',
  },
  {
    file: '05-poppins.png',
    kicker: 'POPPINS',
    title: 'Your household co-manager',
    lines: ['Talk or type · calm answers', 'Tasks · trips · groceries', 'Always on the family’s side'],
    accent: '#F472B6',
  },
  {
    file: '06-switch.png',
    kicker: 'SHARED TABLET',
    title: 'Switch profiles',
    lines: ['Tap your profile on the iPad', 'Personal accents follow each face', 'One device · whole household'],
    accent: '#FB923C',
  },
];

function escapeXml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function svgFor(screen) {
  const lineYs = [1480, 1600, 1720];
  const lines = screen.lines
    .map(
      (line, i) =>
        `<text x="180" y="${lineYs[i]}" font-family="Helvetica Neue, Arial, sans-serif" font-size="52" fill="rgba(255,255,255,0.78)">${escapeXml(line)}</text>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#041018"/>
      <stop offset="55%" stop-color="#0B1F2A"/>
      <stop offset="100%" stop-color="#12263A"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.12)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.04)"/>
    </linearGradient>
    <radialGradient id="glow" cx="70%" cy="18%" r="45%">
      <stop offset="0%" stop-color="${screen.accent}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${screen.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- device chrome -->
  <rect x="120" y="160" width="1824" height="2432" rx="96" fill="#07131A" stroke="rgba(255,255,255,0.12)" stroke-width="4"/>
  <rect x="160" y="220" width="1744" height="2312" rx="72" fill="url(#card)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>

  <!-- brand -->
  <text x="220" y="360" font-family="Helvetica Neue, Arial, sans-serif" font-size="40" font-weight="700" letter-spacing="6" fill="${screen.accent}">CHOREMAXX</text>
  <text x="220" y="460" font-family="Helvetica Neue, Arial, sans-serif" font-size="36" font-weight="600" letter-spacing="4" fill="rgba(255,255,255,0.45)">${escapeXml(screen.kicker)}</text>
  <text x="220" y="620" font-family="Helvetica Neue, Arial, sans-serif" font-size="96" font-weight="800" fill="#FFFFFF">${escapeXml(screen.title)}</text>

  <!-- fake UI cards -->
  <rect x="220" y="760" width="1624" height="220" rx="40" fill="rgba(255,255,255,0.08)"/>
  <circle cx="320" cy="870" r="48" fill="${screen.accent}" fill-opacity="0.9"/>
  <rect x="400" y="830" width="520" height="36" rx="12" fill="rgba(255,255,255,0.55)"/>
  <rect x="400" y="890" width="380" height="28" rx="10" fill="rgba(255,255,255,0.25)"/>

  <rect x="220" y="1020" width="780" height="280" rx="40" fill="rgba(255,255,255,0.07)"/>
  <rect x="1064" y="1020" width="780" height="280" rx="40" fill="rgba(255,255,255,0.07)"/>
  <rect x="280" y="1100" width="420" height="32" rx="10" fill="rgba(255,255,255,0.4)"/>
  <rect x="280" y="1170" width="300" height="28" rx="10" fill="rgba(255,255,255,0.2)"/>
  <rect x="1124" y="1100" width="420" height="32" rx="10" fill="rgba(255,255,255,0.4)"/>
  <rect x="1124" y="1170" width="300" height="28" rx="10" fill="rgba(255,255,255,0.2)"/>

  <rect x="220" y="1340" width="1624" height="8" rx="4" fill="rgba(255,255,255,0.08)"/>
  ${lines}

  <!-- tab bar hint -->
  <rect x="420" y="2280" width="1224" height="120" rx="60" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.1)"/>
  <circle cx="620" cy="2340" r="18" fill="${screen.accent}"/>
  <circle cx="860" cy="2340" r="18" fill="rgba(255,255,255,0.35)"/>
  <circle cx="1100" cy="2340" r="18" fill="rgba(255,255,255,0.35)"/>
  <circle cx="1340" cy="2340" r="18" fill="rgba(255,255,255,0.35)"/>
  <circle cx="1580" cy="2340" r="18" fill="rgba(255,255,255,0.35)"/>

  <text x="220" y="2550" font-family="Helvetica Neue, Arial, sans-serif" font-size="34" fill="rgba(255,255,255,0.35)">Interim ASC asset · replace with device capture</text>
</svg>`;
}

async function main() {
  for (const screen of screens) {
    const svg = Buffer.from(svgFor(screen));
    const png = await sharp(svg).png().toBuffer();
    const meta = await sharp(png).metadata();
    if (meta.width !== W || meta.height !== H) {
      throw new Error(`${screen.file} got ${meta.width}x${meta.height}, expected ${W}x${H}`);
    }
    writeFileSync(join(OUT, screen.file), png);
    writeFileSync(join(ART, screen.file), png);
    console.log('wrote', screen.file, `${W}x${H}`);
  }
  writeFileSync(
    join(OUT, 'README.md'),
    `# iPad 13" App Store screenshots (interim)

Size: **2064 × 2752** portrait (ASC-compatible).

These are temporary marketing frames for App Store Connect upload.
Replace with real TestFlight / Simulator captures before Apple Review when you can.

Upload path: ASC → App version → iPad 13" → Screenshots.
`
  );
  console.log('done →', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

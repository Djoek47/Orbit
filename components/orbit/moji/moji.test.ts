/**
 * Guards for the Moji set:
 *  A — every drawing stays inside the 24×24 grid and uses palette colours
 *  B — every emoji the resolver maps points at a real Moji
 *  C — the grocery catalog and the app's stored emoji all resolve
 *  D — no screen renders a raw emoji any more (avatars excepted)
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { MOJI_ART, type MojiName } from './art';
import { M } from './palette';
import { mojiForEmoji, RESOLVABLE_EMOJIS } from './resolve';

const ROOT = join(__dirname, '..', '..', '..');
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}]\u{FE0F}?/gu;

/** Files allowed to hold emoji: data tables, the resolver, avatar sources, design refs. */
const ALLOWED = [
  'components/orbit/moji/',
  'constants/accent-themes.ts', // AVATAR_EMOJIS — avatars stay emoji
  'lib/household/child-invites.ts', // invite avatars
  'lib/game-levels.ts',
  'lib/game/trophy-tiers.ts',
  'lib/grocery/item-emoji.ts',
  'lib/tasks/homework-subject.ts',
  'lib/poppins/',
  'lib/calendar/make-calendar.ts',
  'lib/onboarding-prefs.ts',
  'lib/rewards/reward-packages.ts',
  'data/',
  'design/',
  'store/orbit-store.tsx',
];

// ── A. Drawings are well formed ──────────────────────────────────────
const PALETTE = new Set<string>([
  ...Object.values(M).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v))),
  '#1F6B3C',
]);
const names = Object.keys(MOJI_ART) as MojiName[];
assert.ok(names.length >= 150, `expected the full Moji set, got ${names.length}`);

for (const name of names) {
  const art = MOJI_ART[name];
  assert.ok(art.length > 0, `${name} has no shapes`);
  for (const shape of art) {
    assert.ok(PALETTE.has(shape.f), `${name}: ${shape.f} is not a palette colour`);
    if (shape.o != null) assert.ok(shape.o > 0 && shape.o <= 1, `${name}: bad opacity`);
    const numbers =
      shape.t === 'p'
        ? [...shape.d.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0]))
        : shape.t === 'c'
          ? [shape.cx - shape.r, shape.cx + shape.r, shape.cy - shape.r, shape.cy + shape.r]
          : shape.t === 'e'
            ? [shape.cx - shape.rx, shape.cx + shape.rx, shape.cy - shape.ry, shape.cy + shape.ry]
            : [shape.x, shape.x + shape.w, shape.y, shape.y + shape.h];
    for (const n of numbers) {
      assert.ok(n >= -2 && n <= 26, `${name}: ${n} is outside the 24 grid`);
    }
  }
}

// ── B. The resolver points at real Moji ──────────────────────────────
for (const emoji of RESOLVABLE_EMOJIS) {
  const resolved = mojiForEmoji(emoji);
  assert.ok(resolved, `${emoji} does not resolve`);
  assert.ok(MOJI_ART[resolved], `${emoji} → ${resolved}, which is not a Moji`);
}
// The variation selector must not matter.
assert.equal(mojiForEmoji('🗺️'), mojiForEmoji('🗺'));
// Avatar emojis deliberately stay unresolved.
assert.equal(mojiForEmoji('🦊'), undefined);
assert.equal(mojiForEmoji(null), undefined);

// ── C. Stored data resolves ──────────────────────────────────────────
const catalog = JSON.parse(
  readFileSync(join(ROOT, 'data', 'canada-grocery-catalog.json'), 'utf8')
) as { products?: { icon?: string; name?: string }[] };
const unresolved = new Set<string>();
for (const product of catalog.products ?? []) {
  if (product.icon && !mojiForEmoji(product.icon)) unresolved.add(product.icon);
}
assert.equal(
  unresolved.size,
  0,
  `catalog icons with no Moji: ${[...unresolved].join(' ')}`
);

const itemEmoji = readFileSync(join(ROOT, 'lib', 'grocery', 'item-emoji.ts'), 'utf8');
const ruleEmojis = new Set([...itemEmoji.matchAll(EMOJI)].map((m) => m[0]));
const missingRules = [...ruleEmojis].filter((e) => !mojiForEmoji(e));
assert.equal(missingRules.length, 0, `item-emoji values with no Moji: ${missingRules.join(' ')}`);

// ── D. No screen renders a raw emoji ─────────────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx') && !full.includes('.test.')) out.push(full);
  }
  return out;
}

const offenders: string[] = [];
for (const dir of ['app', 'components']) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = file.slice(ROOT.length + 1);
    if (ALLOWED.some((prefix) => rel.startsWith(prefix))) continue;
    const src = readFileSync(file, 'utf8');
    for (const line of src.split('\n')) {
      // Emoji inside JSX text — `>🛒<` or `{'🛒'}` — is what we removed.
      if (/>[^<]*[\u{1F300}-\u{1FAFF}]/u.test(line)) offenders.push(`${rel}: ${line.trim()}`);
    }
  }
}
assert.equal(offenders.length, 0, `raw emoji still rendered:\n${offenders.join('\n')}`);

console.log(`moji: ${names.length} drawings, ${RESOLVABLE_EMOJIS.length} emoji mapped — ok`);

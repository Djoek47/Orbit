/**
 * WO12 audit P1 — every TEXT colour on the light card must clear WCAG AA (4.5:1)
 * against the composite card surface (rgba(255,255,255,0.92) over #F0F4F8).
 * Fills keep the bright dark hexes and are not asserted here as text.
 *
 * Run: npx tsx lib/poppins/stage-contrast.test.ts
 */
import assert from 'node:assert/strict';

import {
  STAGE,
  stageAccent,
  stageFill,
  stageLightCardComposite,
  stageSuccessText,
  stageDangerText,
  stageFaint,
  stageMuted,
} from '@/constants/iui-stage';

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg: string, bg: string): number {
  const L1 = luminance(fg);
  const L2 = luminance(bg);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
const lightCard = stageLightCardComposite();
const darkCard = '#0B1524'; // approx dark card over #070D1C

assert.ok(/^#[0-9a-f]{6}$/i.test(lightCard), `composite hex, got ${lightCard}`);

const lightText: Array<{ name: string; hex: string }> = [
  { name: 'domainLight.chores', hex: STAGE.domainLight.chores },
  { name: 'domainLight.plan', hex: STAGE.domainLight.plan },
  { name: 'domainLight.rewards', hex: STAGE.domainLight.rewards },
  { name: 'domainLight.household', hex: STAGE.domainLight.household },
  { name: 'semanticLight.success', hex: STAGE.semanticLight.success },
  { name: 'semanticLight.warning', hex: STAGE.semanticLight.warning },
  { name: 'semanticLight.danger', hex: STAGE.semanticLight.danger },
  { name: 'shell.teachLight', hex: STAGE.shell.teachLight },
  { name: 'text.mutedLight', hex: STAGE.text.mutedLight },
  { name: 'text.faintLight', hex: STAGE.text.faintLight },
];

for (const { name, hex } of lightText) {
  const ratio = contrastRatio(hex, lightCard);
  assert.ok(
    ratio >= AA,
    `${name} ${hex} on light card ${lightCard}: ${ratio.toFixed(2)} < ${AA}`
  );
}

const darkText: Array<{ name: string; hex: string }> = [
  { name: 'domain.chores', hex: STAGE.domain.chores },
  { name: 'domain.plan', hex: STAGE.domain.plan },
  { name: 'domain.rewards', hex: STAGE.domain.rewards },
  { name: 'domain.household', hex: STAGE.domain.household },
  { name: 'semantic.success', hex: STAGE.semantic.success },
  { name: 'semantic.warning', hex: STAGE.semantic.warning },
  { name: 'semantic.danger', hex: STAGE.semantic.danger },
  { name: 'shell.teach', hex: STAGE.shell.teach },
  { name: 'text.mutedDark', hex: STAGE.text.mutedDark },
  { name: 'text.faintDark', hex: STAGE.text.faintDark },
];

for (const { name, hex } of darkText) {
  const ratio = contrastRatio(hex, darkCard);
  assert.ok(
    ratio >= AA,
    `${name} ${hex} on dark card ${darkCard}: ${ratio.toFixed(2)} < ${AA}`
  );
}

// stageAccent / helpers pick the right palette
assert.equal(stageAccent('grocery_add', undefined, false), STAGE.domainLight.chores);
assert.equal(stageAccent('grocery_add', undefined, true), STAGE.domain.chores);
assert.equal(stageAccent('calendar_zoom', undefined, false), STAGE.domainLight.plan);
assert.equal(stageAccent('result_mark', undefined, false), STAGE.semanticLight.success);
assert.equal(stageAccent('coach_steps', undefined, false), STAGE.shell.teachLight);
assert.equal(stageFill('grocery_add'), STAGE.domain.chores);
assert.equal(stageFill('result_mark'), STAGE.semantic.success);
assert.equal(stageSuccessText(false), STAGE.semanticLight.success);
assert.equal(stageDangerText(false), STAGE.semanticLight.danger);
assert.equal(stageFaint(false), STAGE.text.faintLight);
assert.equal(stageMuted(false), STAGE.text.mutedLight);

// Regression: old light text hexes must not sneak back
assert.notEqual(STAGE.text.faintLight, '#6E88AA');
assert.notEqual(STAGE.domainLight.chores, STAGE.domain.chores);

console.log('stage-contrast.test.ts ok', {
  lightCard,
  sample: {
    chores: contrastRatio(STAGE.domainLight.chores, lightCard).toFixed(2),
    success: contrastRatio(STAGE.semanticLight.success, lightCard).toFixed(2),
    faint: contrastRatio(STAGE.text.faintLight, lightCard).toFixed(2),
  },
});

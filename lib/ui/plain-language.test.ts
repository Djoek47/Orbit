/**
 * Nothing on screen should read like it came out of a terminal.
 *
 * The app had drifted into notation: "Settings → Notifications → ChoreMaxx", "Show QR /
 * regenerate", "7d → 3d → 24h → ~1h", "This tablet will host everyone on the QR". Each one
 * made sense to whoever wrote it and to nobody holding the phone. Arrows in particular are a
 * programmer's shorthand for "then", and once a few appear the rest of the copy starts
 * matching their register.
 *
 * This is a guard, not a style guide: it fails on the specific shapes that kept coming back.
 * Comments are stripped first — prose explaining the code is allowed to use whatever notation
 * makes it clearest. Only what a person can read on screen is checked.
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execSync('grep -rl "" --include=*.tsx app components', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

/** Block comments, line comments and import lines are not user-facing. */
function visibleSource(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|import\b)/.test(line))
    .join('\n');
}

type Rule = { name: string; re: RegExp; why: string };

const RULES: Rule[] = [
  {
    name: 'arrow',
    re: /→/,
    why: 'Write "then", "becomes", or name the screens in a sentence. An arrow is notation.',
  },
  {
    name: 'regenerate',
    re: /\bregenerate\b/i,
    why: 'Say "show the code" or "make a new code". Nobody regenerates anything in a kitchen.',
  },
  {
    name: 'duration-shorthand',
    re: /\b\d+d\b\s*·?\s*\b\d+d\b|\b\d+h\s*→/,
    why: 'Write "3 days" and "24 hours" out. 7d/3d/24h is log output.',
  },
  {
    name: 'host-verb',
    re: /\bwill host\b|\bhosts? (?:everyone|the profiles?)\b/i,
    why: '"Host" is a server word. Say who can use the device.',
  },
];

const failures: string[] = [];

/**
 * Pull out only what a person can read: the inside of quoted copy, and JSX text between tags.
 * Checking whole lines caught identifiers — `onPress={regenerate}` is a function name, not
 * something anyone sees.
 */
function copyFragments(line: string): string[] {
  const out: string[] = [];

  const propRe =
    /(?:caption|title|subtitle|sub|label|placeholder|hint|body|message|purpose|text)\s*=\s*\{?[`"']([^`"']{3,})[`"']/g;
  for (const m of line.matchAll(propRe)) out.push(m[1]!);

  const alertRe = /orbitAlert\(\s*[`"']([^`"']{3,})[`"']/g;
  for (const m of line.matchAll(alertRe)) out.push(m[1]!);

  // JSX text: >…< with no braces or tags inside.
  for (const m of line.matchAll(/>([^<>{}]*[A-Za-z]{3}[^<>{}]*)</g)) out.push(m[1]!);

  // Copy sitting alone on its own line inside a Text element.
  const bare = line.trim();
  if (/^[A-Z][^<>{}=]*[a-z][^<>{}=]*$/.test(bare) && bare.length > 8) out.push(bare);

  return out;
}

for (const file of files) {
  const src = visibleSource(readFileSync(file, 'utf8'));
  src.split('\n').forEach((line, index) => {
    if (/accessibilityLabel|accessibilityHint|testID/.test(line)) return;
    for (const fragment of copyFragments(line)) {
      for (const rule of RULES) {
        if (rule.re.test(fragment)) {
          failures.push(
            `${file}:${index + 1}  [${rule.name}] ${fragment.trim().slice(0, 110)}\n     ${rule.why}`
          );
          return;
        }
      }
    }
  });
}

assert.equal(
  failures.length,
  0,
  `Copy that reads like code:\n\n${failures.join('\n')}\n\n${failures.length} to fix.`
);

// A handful of the exact strings that were wrong, pinned so they cannot come back verbatim.
const pinned: [string, RegExp][] = [
  ['components/orbit/members/shared-device-manage-card.tsx', /Show QR code \/ regenerate/],
  ['components/orbit/members/shared-device-manage-card.tsx', /not a Switch menu on your phone/],
  ['app/settings.tsx', /You → House ownership/],
  ['app/(tabs)/plan.tsx', /Sidekicks still see theirs/],
];
for (const [file, re] of pinned) {
  assert.doesNotMatch(readFileSync(file, 'utf8'), re, `${file} still carries the old wording`);
}

console.log(`plain-language: ok (${files.length} screens)`);

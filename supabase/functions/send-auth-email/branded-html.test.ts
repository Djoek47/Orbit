/**
 * Live auth email markup — must match docs/email/confirm-email.html.
 * Run: npx --yes tsx supabase/functions/send-auth-email/branded-html.test.ts
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderBrandedAuthEmail } from './branded-html.ts';

const out = renderBrandedAuthEmail({
  action: 'signup',
  name: 'Sarah',
  confirmUrl: 'https://www.choremaxx.app/auth/callback?token_hash=preview&type=signup',
  otp: '83538952',
});

assert.match(out.html, /class="cm-cell"/);
assert.match(out.html, /cm-band/);
assert.match(out.html, /cm-eyebrow/);
assert.match(out.html, /linear-gradient\(180deg/);
assert.match(out.html, /cm-code/);
assert.match(out.html, /83538952/);
assert.match(out.html, /privacy@choremaxx\.app/);
assert.equal(out.html.includes('font-family:"Bricolage'), false, 'inline styles must not break on quoted font names');
assert.equal(out.html.includes('123 Main'), false);
assert.equal(out.html.includes('Placeholder'), false);

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
mkdirSync(join(root, 'docs/email'), { recursive: true });
writeFileSync(join(root, 'docs/email/confirm-email.html'), out.html, 'utf8');

console.log('PASS branded-html', out.html.length, 'bytes');

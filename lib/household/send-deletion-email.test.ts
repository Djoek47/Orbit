import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('deletion reminder stages export distinct subjects', async () => {
  const mod = await import('../../emails/household-deletion-reminder');
  const base = {
    name: 'Alex Nero',
    householdName: 'The Nero Home',
    purgeDate: 'Thu, Nov 5, 2026',
    recoverUrl: 'https://www.choremaxx.app',
    optOutUrl: 'https://www.choremaxx.app',
  };
  assert.match(mod.subjectFor({ ...base, stage: '7d' }), /7 days left/);
  assert.match(mod.subjectFor({ ...base, stage: '3d' }), /3 days left/);
  assert.match(mod.subjectFor({ ...base, stage: '24h' }), /24 hours left/);
  assert.match(mod.subjectFor({ ...base, stage: '1h11m' }), /1 hour left/);
  const text = mod.textFor({ ...base, stage: '7d' });
  assert.match(text, /Cancel deletion/);
  assert.match(text, /Stop reminder emails/);
});

test('deletion final and cancelled templates export subjects', async () => {
  const final = await import('../../emails/household-deletion-final');
  const cancelled = await import('../../emails/household-deletion-cancelled');
  assert.match(
    final.subjectFor({
      name: 'Alex',
      householdName: 'The Nero Home',
      confirmBy: '24 hours',
      confirmUrl: 'https://www.choremaxx.app',
      cancelUrl: 'https://www.choremaxx.app',
    }),
    /Confirm permanent deletion/
  );
  assert.match(
    cancelled.subjectFor({
      name: 'Alex',
      householdName: 'The Nero Home',
      homeUrl: 'https://www.choremaxx.app',
    }),
    /Deletion cancelled/
  );
});

test('deletion edge branded HTML covers all kinds', () => {
  const src = readFileSync(
    join(process.cwd(), 'supabase/functions/send-household-deletion-email/branded-html.ts'),
    'utf8'
  );
  assert.match(src, /renderHouseholdDeletionEmail/);
  assert.match(src, /1h11m/);
  assert.match(src, /Confirm permanent deletion/);
  assert.match(src, /Deletion cancelled/);
});

test('settings no longer exposes admin Email tests harness', () => {
  const settings = readFileSync(join(process.cwd(), 'app/settings.tsx'), 'utf8');
  assert.doesNotMatch(settings, /Email tests/);
  assert.doesNotMatch(settings, /Send test email/);
  assert.doesNotMatch(settings, /openEmailTestPicker/);
});

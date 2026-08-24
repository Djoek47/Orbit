/**
 * Revision G §7.1 / A4.5 / A7.1.
 * Run: npx --yes tsx lib/sidekick/permissions.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  POPPINS_EDGE_FUNCTIONS,
  groceryAddAllowedForSidekick,
  sidekickForbiddenStatus,
} from './permissions';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

const denied: Array<Parameters<typeof sidekickForbiddenStatus>[1]> = [
  'complete_others_task',
  'create_task',
  'assign_task',
  'edit_task',
  'poppins',
  'grocery_remove',
  'grocery_edit',
  'grocery_checkoff',
  'grocery_add_when_disabled',
  'grant_reward',
  'mark_reward_given',
  'mark_allowance_paid',
  'settings',
  'members',
  'invites',
  'subscription',
];

for (const action of denied) {
  assert.equal(sidekickForbiddenStatus('child', action), 403, action);
  assert.equal(sidekickForbiddenStatus('sidekick', action), 403, action);
  assert.equal(sidekickForbiddenStatus('admin', action), null, `${action} admin`);
}
pass(`A7.1 every No row is 403 (${denied.length})`);

assert.equal(groceryAddAllowedForSidekick({ role: 'child', householdAllows: false }), false);
assert.equal(groceryAddAllowedForSidekick({ role: 'child', householdAllows: true }), true);
pass('A7.2 grocery add follows household flag');

{
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  for (const name of POPPINS_EDGE_FUNCTIONS) {
    const src = readFileSync(join(root, 'supabase/functions', name, 'index.ts'), 'utf8');
    assert.ok(
      src.includes('requireNonSidekick') || src.includes('poppins-auth'),
      `${name} must go through poppins-auth`
    );
    assert.ok(src.includes('requireActiveMember') || src.includes('requireNonSidekick'), `${name} auth`);
  }
  const auth = readFileSync(join(root, 'supabase/functions/_shared/poppins-auth.ts'), 'utf8');
  assert.ok(auth.includes('requireNonSidekick'));
  assert.ok(auth.includes('status: 403') || auth.includes(', 403)'));
  pass(`A4.5 Poppins edge functions reject Sidekick (${POPPINS_EDGE_FUNCTIONS.length})`);
}

console.log('\nsidekick permission tests passed');

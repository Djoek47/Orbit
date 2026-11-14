/**
 * Shared-device remove must soft-delete with a returned row (no silent 0-row updates).
 * Run: npx tsx lib/household/shared-device-remove.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const repo = readFileSync('repositories/household-repository.ts', 'utf8');
const removeBlock = repo.slice(
  repo.indexOf('async removeMember(memberId: string)'),
  repo.indexOf('async refreshInvite(')
);

assert.match(removeBlock, /status:\s*'removed'/, 'soft-removes the row');
assert.match(removeBlock, /shared_with_member_ids:\s*\[\]/, 'clears tablet links');
assert.match(removeBlock, /\.select\(/, 'asks Supabase for the updated row');
assert.match(removeBlock, /maybeSingle|single/, 'requires a result');
assert.match(removeBlock, /if \(!data\)/, 'throws when RLS / missing row silently no-ops');

const card = readFileSync('components/orbit/members/shared-device-manage-card.tsx', 'utf8');
assert.match(card, /confirmRemove/, 'confirms inline — Settings is already a modal');
assert.match(card, /Confirm remove/, 'has an accessible confirm control');
assert.doesNotMatch(
  card,
  /orbitAlert\(/,
  'does not nest OrbitAlert on top of the Settings modal'
);

const roster = readFileSync('components/orbit/members/household-members-roster.tsx', 'utf8');
assert.match(roster, /handleRemoveDevice/, 'devices use a dedicated remove path');
assert.match(roster, /onRemoveDevice=\{\(\) => handleRemoveDevice\(device\)\}/);

console.log('shared-device-remove: ok');

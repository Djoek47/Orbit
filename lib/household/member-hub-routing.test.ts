/**
 * People Sidekick rows open the member hub — not PersonalizeLookSheet.
 * Run: npx tsx lib/household/member-hub-routing.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const roster = readFileSync('components/orbit/members/household-members-roster.tsx', 'utf8');
assert.match(roster, /router\.push\(`\/member\/\$\{member\.id\}`/);
assert.doesNotMatch(
  roster,
  /onPress=\{\(\) => onPersonalize\(member\.id\)\}/,
  'Sidekick rows must not open PersonalizeLookSheet first'
);

const setup = readFileSync('app/setup-kid-device.tsx', 'utf8');
assert.match(setup, /setViewingDeviceId\(device\.id\)/);
assert.match(setup, /deviceId/);
assert.match(setup, /Generate new QR|regenerate/i);

const personalize = readFileSync('components/orbit/personalize-look-sheet.tsx', 'utf8');
assert.match(personalize, /scrollable/);
assert.match(personalize, /accessibilityLabel="Close"/);
assert.doesNotMatch(personalize, /<ScrollView/, 'must not nest ScrollView inside BottomSheet');

const card = readFileSync('components/orbit/members/shared-device-manage-card.tsx', 'utf8');
assert.match(card, /setup-kid-device\?deviceId=/);

console.log('member-hub-routing: ok');

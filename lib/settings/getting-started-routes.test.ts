/**
 * Getting started rows land on the thing they name, not the Settings root.
 * Run: npx tsx lib/settings/getting-started-routes.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const card = read('components/orbit/tour/getting-started-card.tsx');
assert.match(card, /'\/settings\?section=members&add=1'/, 'Add a Sidekick opens Add someone');
assert.match(card, /sidekickSetupRoute\(sidekickSetupTarget\(household\.members\)\)/, 'Set up a device picks a Sidekick');
assert.ok(
  !/id: 'add_sidekick',[\s\S]{0,200}router\.push\('\/settings' as never\)/.test(card),
  'no row drops you on the Settings root any more'
);
assert.ok(
  !/id: 'setup_device',[\s\S]{0,260}router\.push\('\/settings' as never\)/.test(card),
  'including Set up a device'
);
// The rows move under the finger.
assert.match(card, /onPressIn=\{\(\) => press\.set/, 'rows animate on press');

const settings = read('app/settings.tsx');
assert.match(settings, /add\?: string; invite\?: string/, 'Settings takes the intents');
assert.match(settings, /params\.add === '1'/, 'add=1 opens Add someone');
assert.match(settings, /openMemberInvite\(member\)/, 'invite=<id> opens that QR');
assert.match(settings, /handledIntent/, 'and only acts once');
// Adding someone already leads to their code.
assert.match(settings, /onAdded=\{\(member\) => \{[\s\S]{0,140}openMemberInvite\(member\)/, 'a new Sidekick goes straight to their QR');
// Help → Get Started dismisses Settings and opens the Home checklist card.
assert.match(settings, /label="Get Started"/, 'checklist row is Get Started');
assert.ok(!settings.includes('Show the checklist'), 'old checklist label is gone');
assert.match(settings, /tourControls\?\.showChecklist\(\)/, 'Get Started calls showChecklist');

const tourProvider = read('components/orbit/tour/tour-provider.tsx');
assert.match(
  tourProvider,
  /showChecklist = useCallback\(\(\) => \{[\s\S]{0,280}?dismissModalsThen/,
  'Get Started dismisses Settings then lands on Home'
);
assert.match(
  tourProvider,
  /checklistHidden: false/,
  'and forces the Getting Started card visible'
);

// Settings for a Sidekick / shared device.
const sidekick = read('components/orbit/sidekick-settings-screen.tsx');
assert.ok(!sidekick.includes('Lock app'), 'Lock app is gone');
assert.match(sidekick, /memberSettingsModel/, 'one screen, three shapes');
assert.match(sidekick, /model\.signOut\.label/, 'sign out says what it signs out');
assert.match(settings, /usesMemberSettings\(currentMember\?\.role\)/, 'the iPad never gets admin settings');

console.log('getting-started-routes: ok');

/**
 * Final multipass — Smart delivery contracts across announce / push / open-as.
 * Run: npx --yes tsx lib/notifications/smart-delivery-multipass.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const store = read('store/orbit-store.tsx');
assert.match(store, /loadAnnounceLedger/, 'Sidekick sync loads announce ledger');
assert.match(store, /recordAnnouncedKeys/, 'presented banners are ledgered');
assert.match(store, /toExpoNotificationIdentifier/, 'stable Expo identifiers');
assert.match(store, /smartDelivery:\s*prefs\.smartDelivery/, 'Smart pref wired into announce');
assert.match(store, /householdRef\.current = merged/, 'baseline refs updated before announce');
assert.match(
  store,
  /announceNewTasks:\s*false/,
  'hydrate paths stay silent'
);
assert.match(store, /announceNewTasks:\s*true/, 'live sync may announce');

const announce = read('lib/notifications/sidekick-announce.ts');
assert.match(announce, /announcedKeys/, 'ledger keys filter candidates');
assert.match(announce, /dismissedNotificationIds/, 'tombstones filter notes');
assert.match(announce, /reduceBannersWithSmartDigest/, 'Smart rollup applied');

const prefs = read('services/poppins-notifications.ts');
assert.match(prefs, /smartDelivery:\s*true/, 'Smart default ON');

const settings = read('app/settings.tsx');
assert.match(settings, /NotificationPrefsPanel/, 'Settings uses premium prefs panel');
assert.match(settings, /smartDelivery|NotificationPrefsPanel/, 'Settings exposes Smart delivery');

const panel = read('components/orbit/settings/notification-prefs-panel.tsx');
assert.match(panel, /Smart delivery/, 'Smart hero on prefs panel');
assert.match(panel, /SMART_DELIVERY_CHIPS/, 'Smart mode chips explain the difference');
assert.doesNotMatch(panel, /deadlines still fire/, 'no code-like quiet hours copy');
assert.match(panel, /quietHoursStart/, 'quiet window start is adjustable');
assert.match(panel, /quietHoursEnd/, 'quiet window end is adjustable');

const ui = read('lib/notifications/smart-delivery-ui.ts');
assert.match(ui, /channelGroups/, 'channels condensed into groups');
assert.match(ui, /SMART_DELIVERY_HERO/);

const inbox = read('components/orbit/notification-inbox.tsx');
assert.match(inbox, /PersonActivityShowcase/, 'Activity shows per-person showcase');

const notify = read('lib/notifications/notify-task-assigned.ts');
assert.match(notify, /targetMemberId/, 'assignee open-as id on create');
assert.match(notify, /mergeKey/, 'digest merge key when Smart ON');

assert.match(read('components/orbit/notification-tap-bridge.tsx'), /shouldOpenNotificationAsMember/);
assert.match(read('lib/notifications/navigate.ts'), /smart_digest/);
assert.match(read('docs/product-context.md'), /Smart delivery notifications/);

console.log('smart-delivery-multipass: ok');

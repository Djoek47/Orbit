/**
 * Multipass — notification prefs UI + Activity showcase contracts.
 * Run: npx --yes tsx lib/notifications/notif-activity-ui-multipass.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

// Pass A — Settings wires the new panel
{
  const settings = read('app/settings.tsx');
  assert.match(settings, /NotificationPrefsPanel/);
  assert.doesNotMatch(
    settings,
    /Choose which Poppins alerts you want/,
    'old long list copy removed from settings'
  );
}

// Pass B — Smart is a hero mode, not just another row
{
  const panel = read('components/orbit/settings/notification-prefs-panel.tsx');
  assert.match(panel, /SMART_DELIVERY_HERO/);
  assert.match(panel, /smartDelivery/);
  assert.match(panel, /Quiet hours/);
  assert.match(panel, /Open household inbox/);
  const ui = read('lib/notifications/smart-delivery-ui.ts');
  assert.match(ui, /Recommended/);
  assert.match(ui, /Task digests/);
  assert.match(ui, /Evenings stay calm/);
  assert.doesNotMatch(ui, /deadlines still fire/);
  assert.doesNotMatch(ui, /still use this channel/);
}

// Pass C — channel groups cover every pref key except heroes
{
  const ui = read('lib/notifications/smart-delivery-ui.ts');
  for (const key of [
    'tasks',
    'rewards',
    'groceries',
    'itinerary',
    'deals',
    'plans',
    'xpFairness',
    'nearShop',
    'missingOnTheWay',
  ]) {
    assert.match(ui, new RegExp(`'${key}'`), `group includes ${key}`);
  }
}

// Pass D — Activity showcase + member attribution on facts
{
  const showcase = read('components/orbit/activity/person-activity-showcase.tsx');
  assert.match(showcase, /Household energy|Your energy/);
  assert.match(showcase, /signals today/);
  assert.match(showcase, /StreakDots/);
  const policy = read('lib/poppins/notification-policy.ts');
  assert.match(policy, /memberId: fact\.memberId/);
  const inbox = read('components/orbit/notification-inbox.tsx');
  assert.match(inbox, /PersonActivityShowcase/);
  assert.doesNotMatch(inbox, /StreakStrip/, 'showcase replaces flat streak strip on Activity');
}

// Pass E — Smart digest still rules-first (no live LLM)
{
  const digest = read('lib/notifications/smart-digest.ts');
  assert.match(digest, /Rules-first Smart delivery/);
  assert.match(digest, /reduceBannersWithSmartDigest/);
  assert.match(digest, /Open Activity/);
}

// Pass F — enabling Smart keeps Tasks + Quiet ready
{
  const panel = read('components/orbit/settings/notification-prefs-panel.tsx');
  assert.match(panel, /tasks:\s*true/);
  assert.match(panel, /quietHoursEnabled:\s*true/);
}

console.log('notif-activity-ui-multipass: ok');

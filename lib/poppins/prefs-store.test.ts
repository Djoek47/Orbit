/**
 * Server-first notification prefs merge — WO9.3 follow-up.
 * Run: npx --yes tsx lib/poppins/prefs-store.test.ts
 */
import assert from 'node:assert/strict';

import { mergeNotificationPrefs } from '@/lib/poppins/prefs-store';
import { DEFAULT_POPPINS_NOTIFICATION_PREFS } from '@/services/poppins-notifications';

const deviceA = { ...DEFAULT_POPPINS_NOTIFICATION_PREFS, tasks: false, deals: false };
const deviceBLocal = { ...DEFAULT_POPPINS_NOTIFICATION_PREFS };

assert.deepEqual(
  mergeNotificationPrefs({ server: deviceA, local: deviceBLocal }),
  deviceA,
  'B must show A’s server toggles, not phone defaults'
);

const afterBToggle = mergeNotificationPrefs({
  server: { ...deviceA, groceries: false },
  local: deviceBLocal,
});
assert.equal(afterBToggle.tasks, false, 'B toggle must not re-enable A’s tasks');
assert.equal(afterBToggle.deals, false);
assert.equal(afterBToggle.groceries, false);

assert.deepEqual(
  mergeNotificationPrefs({ server: null, local: { tasks: false } }),
  { ...DEFAULT_POPPINS_NOTIFICATION_PREFS, tasks: false },
  'local fills in only when the server has none'
);

assert.deepEqual(
  mergeNotificationPrefs({ server: {}, local: { tasks: false } }),
  { ...DEFAULT_POPPINS_NOTIFICATION_PREFS, tasks: false },
  'empty server object counts as none'
);

console.log('PASS prefs-store mergeNotificationPrefs');

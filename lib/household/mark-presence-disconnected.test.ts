/**
 * Run: npx --yes tsx lib/household/mark-presence-disconnected.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MEMBER_LIVE_MS } from '@/lib/household/member-presence';
import { disconnectedLastSeenIso } from '@/lib/household/mark-presence-disconnected';

const now = Date.parse('2026-10-06T12:00:00.000Z');
const iso = disconnectedLastSeenIso(now);
const age = now - Date.parse(iso);
assert.ok(age > MEMBER_LIVE_MS, 'disconnected stamp must be outside live window');
assert.ok(age < MEMBER_LIVE_MS + 120_000);

const store = readFileSync(join(process.cwd(), 'store/orbit-store.tsx'), 'utf8');
assert.match(store, /markPresenceDisconnected/);
assert.match(
  readFileSync(join(process.cwd(), 'supabase/functions/sidekick-sync/index.ts'), 'utf8'),
  /disconnect/
);

console.log('mark-presence-disconnected: ok');

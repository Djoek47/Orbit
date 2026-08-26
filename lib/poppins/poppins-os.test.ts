/**
 * Poppins OS — one viewport, create not draft, Speak retries, Activity on tap.
 * Run: npx tsx lib/poppins/poppins-os.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { executePoppinsTool } from '@/lib/ai/execute-poppins-tool';
import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';
import type { HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function source(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

const chips = source('components/orbit/global-header-chips.tsx');
assert.ok(!/if \(drive\.live\) setInboxOpen\(true\)/.test(chips), 'live IUI must not auto-open inbox');
assert.match(chips, /accessibilityLabel="Notifications"/);
assert.match(chips, /variant="inbox"/);

const poppinsTab = source('app/(tabs)/poppins.tsx');
assert.match(poppinsTab, /PoppinsHourglass/);
assert.match(poppinsTab, /variant="activity"/);
assert.match(poppinsTab, /accessibilityLabel="Activity"/);
assert.match(poppinsTab, /active=\{showActivity\}/, 'hourglass animates only while the sheet is open');
assert.ok(
  !poppinsTab.includes('active={isActive || monitorFeed.length > 0}'),
  'hourglass must not spin unprompted'
);
assert.ok(!poppinsTab.includes('Type instead'), 'Type is a door, not the error product');
assert.match(poppinsTab, /drive\.live \? null/);
assert.ok(poppinsTab.includes('if (drive.live) return'), 'hourglass does not overlay a live scene');

const sheet = source('components/orbit/poppins-activity-sheet.tsx');
assert.match(sheet, /SheetTab = 'notifications' \| 'activity'/);
assert.match(sheet, /Poppins Activity/);
assert.match(sheet, /'Notifications'/);

const stage = source('components/orbit/poppins-stage.tsx');
assert.match(stage, /occurrenceDateForDueLabel/);
assert.ok(!/buildLibraryAssignInput\([^)]*new Date\(\)\)/.test(stage), 'library assign honors due');

const live = source('lib/poppins/live-context.tsx');
assert.match(live, /router\.push\('\/\(tabs\)\/poppins'/);

const household = {
  id: 'hh1',
  householdName: 'Test',
  greetingName: 'Alex',
  tasks: [],
  groceries: [],
  events: [],
  members: [{ id: 'm1', name: 'Alex', role: 'admin', status: 'active' }],
  rewards: [],
  itineraries: [],
  places: [],
} as unknown as HouseholdSnapshot;

const metrics = {
  momentum: 50,
  openTasks: 0,
  taskCompletionRate: 1,
  groceryReadiness: 1,
  calendarCoverage: 1,
  upcomingEvents: 0,
} as unknown as OrbitMetrics;

const assigned = executePoppinsTool(
  'assign_task',
  { title: 'Dishes', assignee: 'Alex', due: 'Tomorrow' },
  household,
  metrics
);
assert.equal((assigned.ui_actions as Array<{ type?: string }>)[0]?.type, 'create_task_draft');
assert.ok(!String(assigned.note).toLowerCase().includes('draft is ready'));
assert.match(String(assigned.note), /creates the task/i);

const playlist = mapUiActionsToPlaylist(assigned.ui_actions as Array<Record<string, unknown>>);
assert.equal(playlist[0]?.payload.write, 'create_task');
assert.equal(playlist[0]?.commit, 'hold');

console.log('PASS poppins-os');

/**
 * The + beside the calendar starts on the day you are looking at.
 * Run: npx tsx lib/calendar/plan-add-date.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { planAddHref, planAddOptionsForActor } from '@/lib/calendar/sidekick-plan-add';
import { DEFAULT_MEMBER_CAPABILITIES } from '@/lib/member-capabilities';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const options = planAddOptionsForActor({
  isAdmin: true,
  isSidekick: false,
  caps: DEFAULT_MEMBER_CAPABILITIES,
});
const event = options.find((o) => o.route === '/create-event')!;
assert.ok(event, 'an admin can add an event');

// The chosen day rides along, next to whatever the option already carried.
const withDate = planAddHref(event, '2026-10-07');
assert.match(withDate, /date=2026-10-07/);
if (event.query) {
  for (const key of Object.keys(event.query)) assert.match(withDate, new RegExp(`${key}=`));
}

// No day given (an older caller) behaves exactly as before.
assert.equal(planAddHref(event), event.query ? `${event.route}?${new URLSearchParams(event.query)}` : event.route);
const homework = options.find((o) => o.route === '/assign-homework');
if (homework && !homework.query) assert.equal(planAddHref(homework), '/assign-homework');

// The screens are wired: Plan hands the selected day over, create-event reads it.
assert.match(read('app/(tabs)/plan.tsx'), /dateKey=\{selectedKey\}/, 'Plan passes the selected day');
const create = read('app/create-event.tsx');
assert.match(create, /params\.date/, 'create-event reads it');
assert.match(create, /\\d\{4\}-\\d\{2\}-\\d\{2\}/, 'and checks it looks like a date');

// The empty day twinkles, and stops for Reduce Motion.
const sparkle = read('components/orbit/plan/empty-day-sparkle.tsx');
assert.match(sparkle, /isReduceMotionEnabled/);
assert.match(sparkle, /withRepeat/);
assert.match(read('app/(tabs)/plan.tsx'), /<EmptyDaySparkle/);

console.log('plan-add-date: ok');

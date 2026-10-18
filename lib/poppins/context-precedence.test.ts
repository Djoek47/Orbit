/**
 * WO10 C — §2 sentences: local grammar wins over mismatched model plans.
 * Run: npx tsx lib/poppins/context-precedence.test.ts
 */
import assert from 'node:assert/strict';

import { parseCompoundHouseholdIntent } from '@/lib/poppins/clause-segment';
import {
  actFamilyOf,
  preferLocalOnPlanMismatch,
  primaryWriteFamily,
} from '@/lib/poppins/context-precedence';

const mealButter = parseCompoundHouseholdIntent(
  'I have a meal to prepare tomorrow, we need to add butter to the list'
);
assert.equal(primaryWriteFamily(mealButter), 'grocery');
assert.ok(mealButter.every((a) => actFamilyOf(String(a.type)) !== 'task'));

const jam = parseCompoundHouseholdIntent('add jam to grocery');
assert.equal(primaryWriteFamily(jam), 'grocery');

const milk = parseCompoundHouseholdIntent('hey can you add milk');
assert.equal(primaryWriteFamily(milk), 'grocery');

const dishes = parseCompoundHouseholdIntent('add a cleaning task for dishes');
assert.equal(primaryWriteFamily(dishes), 'task');

// Model wrongly invents a task while local is grocery → keep local.
const mismatch = preferLocalOnPlanMismatch(mealButter, [
  { type: 'create_task_draft', title: 'Prepare meal' },
  { type: 'add_grocery', name: 'Butter' },
]);
assert.equal(mismatch.mismatched, true);
assert.equal(primaryWriteFamily(mismatch.actions), 'grocery');
assert.ok(!mismatch.actions.some((a) => String(a.type).includes('task')));

// Matching families keep the model plan.
const match = preferLocalOnPlanMismatch(jam, [{ type: 'add_grocery', name: 'Jam' }]);
assert.equal(match.mismatched, false);
assert.equal(primaryWriteFamily(match.actions), 'grocery');

console.log('context-precedence.test.ts ok');

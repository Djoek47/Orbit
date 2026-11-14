/**
 * WO4 clause segmentation — rule 4 test first.
 * Run: npx --yes tsx lib/poppins/clause-segment.test.ts
 */
import assert from 'node:assert/strict';

import {
  inheritSlotsAcrossActions,
  parseCompoundHouseholdIntent,
  splitClauses,
} from '@/lib/poppins/clause-segment';

const members = ['Drako', 'Maya'];

// --- Rule 4 FIRST: trailing slot applies backwards ---
{
  const clauses = splitClauses('dishes and trash for Drako');
  assert.deepEqual(
    clauses.map((c) => c.toLowerCase()),
    ['dishes', 'trash for drako'.toLowerCase()].map((s) => s),
    `expected two clauses, got ${JSON.stringify(clauses)}`
  );

  const actions = parseCompoundHouseholdIntent('dishes and trash for Drako', {
    memberNames: members,
  });
  const drafts = actions.filter((a) => String(a.type) === 'create_task_draft');
  assert.ok(drafts.length >= 2, `expected ≥2 drafts, got ${drafts.length}: ${JSON.stringify(actions)}`);
  assert.ok(
    drafts.every((a) => String(a.assignee) === 'Drako'),
    `rule 4: both assignees Drako, got ${JSON.stringify(drafts.map((a) => a.assignee))}`
  );
}

// Explicit overrides — different assignees
{
  const actions = parseCompoundHouseholdIntent('dishes for Drako and trash for Maya', {
    memberNames: members,
  });
  const drafts = actions.filter((a) => String(a.type) === 'create_task_draft');
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0]?.assignee, 'Drako');
  assert.equal(drafts[1]?.assignee, 'Maya');
}

// Safe and — grocery list stays one clause; WO11 expands to multiple grocery acts
{
  const clauses = splitClauses('add milk and eggs to the list');
  assert.equal(clauses.length, 1);
  const actions = parseCompoundHouseholdIntent('add milk and eggs to the list', {
    memberNames: members,
  });
  assert.equal(actions.filter((a) => String(a.type) === 'add_grocery').length, 2);
  assert.deepEqual(
    actions.filter((a) => String(a.type) === 'add_grocery').map((a) => String(a.name)),
    ['Milk', 'Eggs']
  );
}

// Mixed-kind: navigate deferred after acts
{
  const merged = inheritSlotsAcrossActions([
    { type: 'create_task_draft', title: 'Dishes', assignee: 'Drako' },
    { type: 'navigate', route: '/(tabs)/calendar' },
  ]);
  assert.equal(String(merged[0]?.type), 'create_task_draft');
  assert.equal(String(merged[merged.length - 1]?.type), 'navigate');
}

// WO9 A3.4 — grocery never inherits chore slots (either direction)
{
  const forward = inheritSlotsAcrossActions([
    { type: 'create_task_draft', title: 'Dishes', assignee: 'Drako', category: 'kitchen_dining' },
    { type: 'add_grocery', name: 'milk' },
  ]);
  const grocery = forward.find((a) => String(a.type) === 'add_grocery');
  assert.ok(grocery);
  assert.equal(grocery?.assignee, undefined);
  assert.equal(grocery?.category, undefined);

  const backward = inheritSlotsAcrossActions([
    { type: 'add_grocery', name: 'milk' },
    { type: 'create_task_draft', title: 'Dishes', assignee: 'Drako', category: 'kitchen_dining' },
  ]);
  const grocery2 = backward.find((a) => String(a.type) === 'add_grocery');
  assert.ok(grocery2);
  assert.equal(grocery2?.assignee, undefined);
  assert.equal(grocery2?.category, undefined);
  const task = backward.find((a) => String(a.type) === 'create_task_draft');
  assert.equal(task?.assignee, 'Drako');
}

console.log('PASS clause-segment (rule 4 + safe and)');

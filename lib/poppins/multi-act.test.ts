/**
 * WO11 §4 / §1.1 — multi-act parse + clean titles.
 * Run: npx tsx lib/poppins/multi-act.test.ts
 */
import assert from 'node:assert/strict';

import { parseCompoundHouseholdIntent } from '@/lib/poppins/clause-segment';

const members = ['Mia', 'Sylla'];

function acts(utterance: string) {
  return parseCompoundHouseholdIntent(utterance, { memberNames: members });
}

function groceryNames(out: Array<Record<string, unknown>>) {
  return out.filter((a) => String(a.type) === 'add_grocery').map((a) => String(a.name ?? ''));
}

function tasks(out: Array<Record<string, unknown>>) {
  return out.filter((a) => String(a.type) === 'create_task_draft');
}

// §1.1 table
{
  const out = acts('add milk and bread to the list');
  assert.deepEqual(groceryNames(out), ['Milk', 'Bread'], 'milk and bread → two items');
  assert.ok(!groceryNames(out).some((n) => /and/i.test(n)), 'never Milk And Bread');
}

{
  const out = acts('add milk, eggs and bread');
  assert.deepEqual(groceryNames(out).sort(), ['Bread', 'Egg', 'Milk'].sort(), 'comma list → three');
}

{
  const out = acts('add bananas, then remind me to call the school at 4');
  assert.ok(
    groceryNames(out).some((n) => /banana/i.test(n)),
    `expected banana grocery, got ${JSON.stringify(out)}`
  );
  const task = tasks(out)[0];
  assert.ok(task, 'remind → task');
  assert.match(String(task!.title), /call.*school/i);
  assert.ok(!/^remind/i.test(String(task!.title)));
}

{
  const out = acts('clear the list and add coffee');
  assert.ok(
    out.some((a) => String(a.type) === 'clear_grocery_list'),
    `expected clear, got ${JSON.stringify(out)}`
  );
  assert.deepEqual(groceryNames(out), ['Coffee']);
}

{
  const out = acts('add milk to the list and assign the dishes to Mia tomorrow');
  assert.deepEqual(groceryNames(out), ['Milk']);
  const task = tasks(out)[0];
  assert.ok(task);
  assert.equal(String(task!.title), 'Dishes');
  assert.equal(String(task!.assignee), 'Mia');
  assert.equal(String(task!.due), 'Tomorrow');
}

{
  const out = acts('assign dishes to Mia and vacuum to Sylla for tomorrow');
  const t = tasks(out);
  assert.equal(t.length, 2, JSON.stringify(t));
  assert.equal(String(t[0]!.title), 'Dishes');
  assert.equal(String(t[0]!.assignee), 'Mia');
  assert.equal(String(t[1]!.title), 'Vacuum');
  assert.equal(String(t[1]!.assignee), 'Sylla');
  assert.equal(String(t[1]!.due), 'Tomorrow');
}

{
  const out = acts('add jam to the list. also we need butter');
  assert.deepEqual(groceryNames(out).sort(), ['Butter', 'Jam'].sort());
}

console.log('multi-act.test.ts ok');

/**
 * Groceries tour step 2 used to auto-skip: target `groceries.aisles` only mounts
 * when Browse is open, and nothing opened it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { getTourDefinition } from '@/lib/tour/tour-steps';
import { applyTourStepEnter, registerTourUiHooks } from '@/lib/tour/tour-store';

const root = process.cwd();

test('aisle step opens Browse; search and store close it', () => {
  const chapter = getTourDefinition('admin').chapters.find((c) => c.id === 'groceries');
  assert.ok(chapter);
  const [search, aisles, store] = chapter!.steps;
  assert.equal(search?.id, 'groceries.search');
  assert.equal(aisles?.id, 'groceries.aisles');
  assert.equal(store?.id, 'groceries.store');
  assert.equal(search?.onEnter, 'groceries.list');
  assert.equal(aisles?.onEnter, 'groceries.browse');
  assert.equal(store?.onEnter, 'groceries.list');
  assert.equal(aisles?.targetId, 'groceries.aisles');
});

test('applyTourStepEnter toggles setGroceryBrowse', () => {
  const calls: boolean[] = [];
  const dispose = registerTourUiHooks({
    setGroceryBrowse: (open) => {
      calls.push(open);
    },
  });
  applyTourStepEnter('groceries.browse');
  applyTourStepEnter('groceries.list');
  dispose();
  assert.deepEqual(calls, [true, false]);
});

test('groceries screen mounts aisle TourTarget inside Browse', () => {
  const src = readFileSync(join(root, 'app/(tabs)/groceries.tsx'), 'utf8');
  assert.match(src, /TourTarget id="groceries\.aisles"/);
  assert.match(src, /showBrowse/);
  assert.match(src, /registerTourUiHooks/);
  assert.match(src, /setGroceryBrowse/);
});

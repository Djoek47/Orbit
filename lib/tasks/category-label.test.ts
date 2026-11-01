/**
 * Category headers use a name, not the storage id.
 * Run: npx tsx lib/tasks/category-label.test.ts
 */
import assert from 'node:assert/strict';

import { categoryDisplayLabel } from '@/lib/tasks/task-library';

assert.equal(categoryDisplayLabel('trash_recycling'), 'Trash');
assert.equal(categoryDisplayLabel('kitchen_dining'), 'Kitchen');
assert.equal(categoryDisplayLabel('homework_education'), 'Homework');
assert.equal(categoryDisplayLabel('Hygiene'), 'Hygiene');
assert.equal(categoryDisplayLabel('custom_errand'), 'Custom Errand');
assert.equal(categoryDisplayLabel(''), 'Task');

console.log('category-label: ok');

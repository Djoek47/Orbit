/**
 * Edit-task category chip ↔ domain id mapping.
 * Run: npx --yes tsx lib/tasks/edit-category.test.ts
 */
import assert from 'node:assert/strict';

import { EDIT_CATEGORY_CHIPS, editCategoryChip, resolveSavedCategory } from './edit-category';

assert.equal(editCategoryChip('kitchen_dining'), 'Kitchen');
assert.equal(editCategoryChip('homework_education'), 'Homework');
assert.equal(editCategoryChip('Kitchen'), 'Kitchen');
assert.equal(editCategoryChip('trash_recycling'), 'Cleaning');
assert.equal(editCategoryChip('bathroom'), 'Cleaning');
assert.equal(editCategoryChip('School'), 'Homework', 'School collapses to Homework chip');
assert.ok(!(EDIT_CATEGORY_CHIPS as readonly string[]).includes('School'));

assert.equal(
  resolveSavedCategory('Kitchen', 'kitchen_dining'),
  'kitchen_dining',
  'unchanged chip keeps domain id'
);
assert.equal(resolveSavedCategory('Laundry', 'kitchen_dining'), 'laundry');
assert.equal(resolveSavedCategory('Homework', 'General'), 'homework_education');
assert.equal(resolveSavedCategory('General', 'xyz'), 'daily_routine');
assert.equal(
  resolveSavedCategory('General', 'daily_routine'),
  'daily_routine',
  'catch-all keeps prior domain when already General-mapped'
);

console.log('edit-category: ok');

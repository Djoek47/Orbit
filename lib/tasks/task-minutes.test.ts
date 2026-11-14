/**
 * Every task gets an honest time, and the keyboard always has a way out.
 * Run: npx tsx lib/tasks/task-minutes.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TASK_LIBRARY } from '@/lib/tasks/task-library';
import { familyOf, minutesForTask, savedMinutesForTask } from '@/lib/tasks/completion-stats';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

// No chore in the library scores zero, and none is silly.
let scored = 0;
for (const domain of TASK_LIBRARY.domains) {
  for (const group of domain.groups) {
    for (const task of group.tasks) {
      const minutes = minutesForTask({ title: task.name, category: domain.id });
      assert.ok(minutes > 0, `${domain.id}/${task.name} has a time`);
      assert.ok(minutes <= 120, `${domain.id}/${task.name} is not absurd: ${minutes}`);
      scored += 1;
    }
  }
}
assert.ok(scored > 100, `the whole library is covered (${scored})`);

// Typed-by-hand categories land in the right family rather than Other.
for (const [category, family] of [
  ['Trash', 'trash'],
  ['Kitchen', 'kitchen'],
  ['Laundry', 'laundry'],
  ['Pets', 'pets'],
  ['Homework', 'homework'],
] as const) {
  assert.equal(familyOf({ title: 'A chore', category }), family, `${category} → ${family}`);
  assert.ok(minutesForTask({ title: 'A chore', category }) > 0);
}

// Saved never exceeds the effort, and a child's own work is effort without saving.
for (const task of [
  { title: 'Brush teeth', category: 'personal_hygiene' },
  { title: 'Read for 20 minutes', category: 'homework_education' },
  { title: 'Mow the lawn', category: 'yard_outdoors' },
]) {
  assert.ok(savedMinutesForTask(task) <= minutesForTask(task), task.title);
}

// The keyboard: one-line fields end with ✓, multi-line ones get the Done bar.
const input = read('components/orbit/app-text.tsx');
assert.match(input, /returnKeyType \?\? \(multiline \? undefined : 'done'\)/, 'one line ends with done');
assert.match(input, /KEYBOARD_DONE_ID/, 'several lines get the bar');
assert.match(read('app/_layout.tsx'), /<KeyboardDoneAccessory \/>/, 'and the bar is mounted once');
assert.match(read('components/orbit/keyboard-done-accessory.tsx'), /InputAccessoryView/);

// Nearby places: Add place asks for location and falls back to the shops New trip lists.
const nearby = read('components/orbit/places/nearby-suggestions-row.tsx');
assert.match(nearby, /requestIfNeeded: askForLocation/, 'a tap may ask for location');
assert.match(nearby, /suggestionsFromStores/, 'and falls back to the trip screen’s shops');
assert.match(nearby, /Use my location/, 'with words that offer the fix');

// Ask Poppins is a redirect, not a hidden request.
assert.match(read('components/orbit/plan-trips-panel.tsx'), /poppins\?ask=trips/);
assert.match(read('app/(tabs)/poppins.tsx'), /POPPINS_ASK_OPENERS/);

console.log('task-minutes: ok');

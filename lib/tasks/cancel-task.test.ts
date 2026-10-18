/**
 * Skip today / cancel occurrence — wiring guards.
 * Runtime mock cancel is covered indirectly via series-edit skip tests;
 * this file locks the minimal-patch + permission contract in source.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../..');
const repo = readFileSync(join(root, 'repositories/task-repository.ts'), 'utf8');
const store = readFileSync(join(root, 'store/orbit-store.tsx'), 'utf8');
const detail = readFileSync(join(root, 'app/task/[id].tsx'), 'utf8');

assert.match(repo, /async cancelTask\(/);
assert.match(repo, /async revertCompletion\(/);
assert.match(repo, /status:\s*'cancelled'/);
assert.match(repo, /due_label:\s*cancelled\.due/);
assert.doesNotMatch(
  repo.slice(repo.indexOf('async cancelTask('), repo.indexOf('async deleteTask(')),
  /buildCoreTaskUpdate/,
  'cancel must not use the full update payload (null difficulty / extra cols break staging)'
);

assert.match(store, /taskRepository\.cancelTask/);
assert.match(store, /canCreateTask/);
assert.match(store, /canAssignTask/);
assert.match(
  store,
  /You do not have permission to skip this task/,
  'permission deny must throw so Skip today surfaces an alert'
);

assert.match(detail, /cancelTask\(task\.id, 'this'\)/);
assert.match(detail, /Couldn.t skip/);

console.log('cancel-task.test.ts: ok');

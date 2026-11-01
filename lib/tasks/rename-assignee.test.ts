import assert from 'node:assert/strict';
import { renameAssigneeInTasks } from './rename-assignee';
import type { HouseholdTask } from '@/types/orbit';

const t = (p: Partial<HouseholdTask>): HouseholdTask =>
  ({ id: 'x', title: 'Wash dishes by hand', category: 'kitchen', assignee: 'Ci', due: 'Today', xp: 15, repeat: 'Daily', status: 'Pending', ...p }) as HouseholdTask;

// Plain task follows the rename, case-insensitively.
let out = renameAssigneeInTasks([t({ assignee: 'ci ' })], 'Ci', 'Cicentos');
assert.equal(out[0].assignee, 'Cicentos');
// Other people's tasks untouched (same object).
const other = t({ assignee: 'Mia' });
assert.equal(renameAssigneeInTasks([other], 'Ci', 'Cicentos')[0], other);
// Split task: names, label and shares all follow.
out = renameAssigneeInTasks(
  [t({ assignee: 'Ci & Mia', assignees: ['Ci', 'Mia'], shares: [{ name: 'Ci', status: 'Pending' }, { name: 'Mia', status: 'Completed' }] })],
  'Ci', 'Cicentos');
assert.deepEqual(out[0].assignees, ['Cicentos', 'Mia']);
assert.equal(out[0].shares![0].name, 'Cicentos');
assert.equal(out[0].shares![1].status, 'Completed');
assert.ok(out[0].assignee.includes('Cicentos'));
// No-ops: same name, empty names.
const same = [t({})];
assert.equal(renameAssigneeInTasks(same, 'Ci', 'ci'), same);
assert.equal(renameAssigneeInTasks(same, '', 'X'), same);
console.log('rename-assignee: ok');

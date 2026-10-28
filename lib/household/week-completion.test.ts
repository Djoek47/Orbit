import assert from 'node:assert/strict';
import { weekCompletion } from './week-completion';
import type { HouseholdTask } from '@/types/orbit';

const NOW = new Date(2026, 9, 28, 10, 0); // Oct 28, 10:00 local
const at = (d: number, h = 18) => new Date(2026, 9, d, h, 0).toISOString();
const t = (status: HouseholdTask['status'], dueAt: string, extra: Partial<HouseholdTask> = {}) =>
  ({ id: Math.random().toString(), title: 'x', due: '', status, dueAt, ...extra }) as HouseholdTask;

const tasks = [
  t('Pending', at(25)),            // day closed, still "Pending" on the server → missed, not open
  t('Pending', at(26)),            // missed
  t('Expired', at(27)),            // missed
  t('Completed', at(27), { completedAt: at(27, 17) }), // done
  t('Completed', at(26), { completedAt: at(26, 17) }), // done
  t('Pending', at(28, 20)),        // due tonight → open
  t('Pending', at(28, 8)),         // past its time today → open, overdue
  t('Cancelled', at(27)),          // skipped: neither
  t('Expired', at(10)),            // outside the week: ignored
  t('Pending', at(30)),            // upcoming → open
];
const w = weekCompletion(tasks, NOW);
assert.equal(w.open, 3, 'only jobs that can still be finished');
assert.equal(w.overdue, 1);
assert.equal(w.done, 2);
assert.equal(w.missed, 3, 'expired by status or by date');
assert.equal(w.score, 40);
assert.equal(weekCompletion([], NOW).score, null, 'nothing due yet: no score, not 0% or 100%');
console.log('week-completion: ok');

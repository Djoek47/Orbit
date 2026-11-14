/**
 * Validates the in-repo Choremaxx task library (T001–T150) against
 * reward-mode seed rules. Companion CSV not required when this passes.
 */
import {
  CHOREMAXX_TASK_LIBRARY,
  libraryTaskXpEligible,
} from '../data/choremaxx-task-library';
import { XP_LADDER } from '../lib/rewards/reward-mode';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

export function runTaskLibrarySeedValidation(): string[] {
  const logs: string[] = [];
  const rows = CHOREMAXX_TASK_LIBRARY;
  assert(rows.length === 150, `expected 150 rows, got ${rows.length}`);
  logs.push('PASS 150 rows');

  const xp = rows.filter((t) => t.tracking === 'xp');
  const streak = rows.filter((t) => t.tracking === 'streak');
  assert(xp.length === 131, `expected 131 xp, got ${xp.length}`);
  assert(streak.length === 19, `expected 19 streak, got ${streak.length}`);
  logs.push('PASS 131 chores / 19 streak');

  const ids = new Set(rows.map((t) => t.id));
  assert(ids.size === 150, 'duplicate task ids');
  for (const t of rows) {
    assert(/^T\d{3}$/.test(t.id), `bad id ${t.id}`);
  }
  logs.push('PASS unique T### ids');

  for (const t of xp) {
    assert(libraryTaskXpEligible(t), `${t.id} should be eligible`);
    assert((XP_LADDER as readonly number[]).includes(t.baseXp), `${t.id} off ladder ${t.baseXp}`);
  }
  for (const t of streak) {
    assert(!libraryTaskXpEligible(t), `${t.id} streak must be ineligible`);
    assert(t.baseXp === 0, `${t.id} streak baseXp must be 0`);
  }
  logs.push('PASS ladder + streak conformance');

  return logs;
}

const logs = runTaskLibrarySeedValidation();
console.log(logs.join('\n'));
console.log(`\n${logs.length} checks passed`);

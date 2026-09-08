/**
 * Revision F §1 — duplicate occurrence cleanup + keep-one selection.
 * Keep completed row if any, otherwise earliest-created (stable by id).
 */

import type { HouseholdTask } from '@/types/orbit';
import { occurrenceKey, seriesDefinitionId } from '@/lib/tasks/recurring';

export type DedupeReport = {
  deletedCount: number;
  deletedIds: string[];
  xpReconciled: number;
  kept: HouseholdTask[];
};

function occurrenceGroupKey(task: HouseholdTask): string | null {
  if (task.occurrenceDate) {
    return occurrenceKey(seriesDefinitionId(task), task.occurrenceDate);
  }
  return null;
}

/** Prefer completed; else earliest id (proxy for created_at in mock). */
export function pickKeptOccurrence(group: HouseholdTask[]): HouseholdTask {
  const completed = group.filter((t) => t.status === 'Completed');
  if (completed.length === 1) return completed[0];
  if (completed.length > 1) {
    return [...completed].sort((a, b) => a.id.localeCompare(b.id))[0];
  }
  return [...group].sort((a, b) => a.id.localeCompare(b.id))[0];
}

/**
 * Collapse duplicate (definitionId, occurrenceDate) rows.
 * XP over-awarded by extra completed duplicates is summed for ledger adjustment.
 */
export function dedupeOccurrences(tasks: HouseholdTask[]): DedupeReport {
  const byKey = new Map<string, HouseholdTask[]>();
  const passthrough: HouseholdTask[] = [];

  for (const task of tasks) {
    const key = occurrenceGroupKey(task);
    if (!key) {
      passthrough.push(task);
      continue;
    }
    const list = byKey.get(key) ?? [];
    list.push(task);
    byKey.set(key, list);
  }

  const kept: HouseholdTask[] = [...passthrough];
  const deletedIds: string[] = [];
  let xpReconciled = 0;

  for (const group of byKey.values()) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    const winner = pickKeptOccurrence(group);
    kept.push(winner);
    for (const row of group) {
      if (row.id === winner.id) continue;
      deletedIds.push(row.id);
      if (row.status === 'Completed' && winner.status === 'Completed') {
        xpReconciled += row.awardedXp ?? 0;
      } else if (row.status === 'Completed' && winner.status !== 'Completed') {
        // Should not happen given pickKeptOccurrence — still account XP if it did.
        xpReconciled += row.awardedXp ?? 0;
      }
    }
  }

  return {
    deletedCount: deletedIds.length,
    deletedIds,
    xpReconciled,
    kept,
  };
}

/** In-memory unique index — throws if a second row would collide. */
export function assertUniqueOccurrenceInsert(
  existing: HouseholdTask[],
  next: Pick<HouseholdTask, 'definitionId' | 'occurrenceDate' | 'id'>
): void {
  if (!next.definitionId || !next.occurrenceDate) return;
  const clash = existing.find(
    (t) =>
      t.id !== next.id &&
      t.definitionId === next.definitionId &&
      t.occurrenceDate === next.occurrenceDate
  );
  if (clash) {
    throw new Error(
      `UNIQUE_VIOLATION: occurrence (${next.definitionId}, ${next.occurrenceDate}) already exists as ${clash.id}`
    );
  }
}

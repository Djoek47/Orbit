/**
 * Task library loader — single SoT from data/choremaxx-task-library.json.
 * Spec: docs/logic/choremaxx-v2-cursor-spec.md §4.1
 */

import libraryJson from '@/data/choremaxx-task-library.json';

export type Frequency =
  | 'daily'
  | 'weekdays'
  | '2x_weekly'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'seasonal'
  | 'as_needed'
  | 'none';

export type LibraryTask = {
  id: string;
  name: string;
  domainId: string;
  groupId: string;
  tracking: 'xp' | 'streak';
  xp: number;
  defaultFrequency: Frequency;
  searchTerms: string[];
};

export type TaskGroup = {
  id: string;
  name: string;
  domainId: string;
  bundleBonusXp: number;
  tasks: LibraryTask[];
};

export type TaskDomain = {
  id: string;
  name: string;
  /** Tile label — Rev F §10.3. Falls back to name when absent. */
  shortName?: string;
  tab: 'chores' | 'homework';
  tracking: 'xp' | 'streak';
  groups: TaskGroup[];
};

export type TaskLibrary = {
  version: string;
  xpValues: number[];
  frequencies: Frequency[];
  domains: TaskDomain[];
};

export const TASK_LIBRARY = libraryJson as TaskLibrary;

export function choreDomains(): TaskDomain[] {
  return TASK_LIBRARY.domains.filter((d) => d.tab === 'chores');
}

export function homeworkDomain(): TaskDomain | undefined {
  return TASK_LIBRARY.domains.find((d) => d.tab === 'homework');
}

export function allLibraryTasks(): LibraryTask[] {
  return TASK_LIBRARY.domains.flatMap((d) => d.groups.flatMap((g) => g.tasks));
}

export function libraryStats() {
  const tasks = allLibraryTasks();
  const xp = tasks.filter((t) => t.tracking === 'xp');
  const streak = tasks.filter((t) => t.tracking === 'streak');
  const dist: Record<number, number> = {};
  for (const t of xp) {
    dist[t.xp] = (dist[t.xp] ?? 0) + 1;
  }
  return {
    version: TASK_LIBRARY.version,
    domains: TASK_LIBRARY.domains.length,
    groups: TASK_LIBRARY.domains.reduce((n, d) => n + d.groups.length, 0),
    tasks: tasks.length,
    xpScoring: xp.length,
    streak: streak.length,
    choresDomains: choreDomains().length,
    dist,
  };
}

/** Equity mode: flat 10 XP for XP-scoring tasks at assignment time (§4.1). */
export function snapshotLibraryXp(
  task: LibraryTask,
  scoringMode: 'meritocracy' | 'equity'
): number {
  if (task.tracking === 'streak') return 0;
  if (scoringMode === 'equity') return 10;
  return task.xp;
}

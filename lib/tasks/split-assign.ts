import {
  resolveTaskXpFromHouseholdTask,
  type HouseholdRewardSettings,
} from '@/lib/rewards/reward-mode';
import type { HouseholdTask, TaskAssigneeShare } from '@/types/orbit';

export function getTaskAssignees(task: Pick<HouseholdTask, 'assignee' | 'assignees' | 'shares'>): string[] {
  if (task.shares && task.shares.length > 0) {
    return task.shares.map((share) => share.name);
  }
  if (task.assignees && task.assignees.length > 0) {
    return task.assignees;
  }
  return task.assignee?.trim() ? [task.assignee.trim()] : [];
}

export function isSplitTask(task: Pick<HouseholdTask, 'assignee' | 'assignees' | 'shares'>): boolean {
  return getTaskAssignees(task).length > 1;
}

export function formatAssigneeLabel(names: string[]): string {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} & ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(', ')} & ${cleaned[cleaned.length - 1]}`;
}

export function buildShares(names: string[], proofRequired?: boolean): TaskAssigneeShare[] {
  return names.map((name) => ({
    name,
    status: 'Pending',
    proofStatus: proofRequired ? 'none' : undefined,
  }));
}

export function getShare(
  task: HouseholdTask,
  name: string
): TaskAssigneeShare | undefined {
  return task.shares?.find((share) => share.name === name);
}

/**
 * XP for one split share. When household settings are provided, Equity (flat)
 * awards the resolved chore XP per completer instead of ladder splitXpEach.
 */
export function splitShareXp(
  task: HouseholdTask,
  settings?: HouseholdRewardSettings
): number {
  if (settings) {
    const resolved = resolveTaskXpFromHouseholdTask(task, settings);
    if (settings.rewardMode === 'flat') {
      return Math.max(1, resolved);
    }
    return Math.max(1, task.splitXpEach ?? resolved);
  }
  return Math.max(1, task.splitXpEach ?? task.xp);
}

/** Extra XP each completer gets when every assignee finishes. */
export function splitAllDoneBonus(
  task: HouseholdTask,
  settings?: HouseholdRewardSettings
): number {
  if (typeof task.splitBonusXp === 'number') {
    return Math.max(0, task.splitBonusXp);
  }
  if (settings?.rewardMode === 'flat') {
    const resolved = resolveTaskXpFromHouseholdTask(task, settings);
    return Math.max(0, Math.round(resolved * 0.25));
  }
  const base = settings ? resolveTaskXpFromHouseholdTask(task, settings) : task.xp;
  return Math.max(5, Math.round(base * 0.25));
}

/** XP deducted when an admin penalizes a non-finisher. */
export function splitPenaltyAmount(
  task: HouseholdTask,
  settings?: HouseholdRewardSettings
): number {
  if (typeof task.splitPenaltyXp === 'number') {
    return Math.max(0, task.splitPenaltyXp);
  }
  if (settings?.rewardMode === 'flat') {
    const resolved = resolveTaskXpFromHouseholdTask(task, settings);
    return Math.max(0, Math.round(resolved * 0.5));
  }
  const base = settings ? resolveTaskXpFromHouseholdTask(task, settings) : task.xp;
  return Math.max(5, Math.round(base * 0.5));
}

export function allSharesSettled(task: HouseholdTask): boolean {
  const shares = task.shares ?? [];
  if (shares.length === 0) return task.status === 'Completed';
  return shares.every((share) => share.status === 'Completed' || share.status === 'Penalized');
}

export function allSharesCompleted(task: HouseholdTask): boolean {
  const shares = task.shares ?? [];
  return shares.length > 0 && shares.every((share) => share.status === 'Completed');
}

export function taskMatchesAssignee(
  task: Pick<HouseholdTask, 'assignee' | 'assignees' | 'shares'>,
  name: string | undefined | null
): boolean {
  if (!name) return false;
  return getTaskAssignees(task).includes(name);
}

export function ensureTaskShares(task: HouseholdTask): HouseholdTask {
  const names = getTaskAssignees(task);
  if (names.length <= 1) {
    return {
      ...task,
      assignees: names.length ? names : undefined,
      shares: undefined,
    };
  }
  if (task.shares && task.shares.length === names.length) {
    return { ...task, assignees: names, assignee: formatAssigneeLabel(names) };
  }
  return {
    ...task,
    assignees: names,
    assignee: formatAssigneeLabel(names),
    shares: buildShares(names, task.proofRequired),
  };
}

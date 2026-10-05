/**
 * Live Household Health numbers — member load and cleaning-by-room.
 * Prefer live task assignment over stale DB `loadShare` (often 0 after sync).
 */
import { DEFAULT_HOUSEHOLD_ROOMS } from '@/data/household-rooms';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import { isOpenTask } from '@/lib/tasks/cancel';
import type { HouseholdMember, HouseholdRoom, HouseholdTask } from '@/types/orbit';

function assigneeNames(task: HouseholdTask): string[] {
  if (task.assignees?.length) return task.assignees.filter(Boolean);
  return task.assignee ? [task.assignee] : [];
}

/** People who show on Member load (devices / guests stay out). */
export function healthLoadMembers(members: HouseholdMember[]): HouseholdMember[] {
  return members.filter(
    (m) =>
      m.status === 'active' &&
      m.role !== 'guest' &&
      !isSharedDeviceRole(m.role)
  );
}

export type MemberLoadRow = {
  member: HouseholdMember;
  openCount: number;
  loadShare: number;
};

/**
 * Live load share from open assigned tasks. Falls back to weekXp weights when
 * nobody has open chores, then equal shares.
 */
export function computeLiveMemberLoad(
  members: HouseholdMember[],
  tasks: HouseholdTask[]
): MemberLoadRow[] {
  const people = healthLoadMembers(members);
  if (!people.length) return [];

  const byName = new Map(people.map((m) => [m.name.toLowerCase(), m]));
  /** Weighted load for share bars (co-assignees split 1 task). */
  const weights = new Map<string, number>(people.map((m) => [m.id, 0]));
  /** Raw open assignments for the meta line. */
  const openCounts = new Map<string, number>(people.map((m) => [m.id, 0]));

  for (const task of tasks) {
    if (!isOpenTask(task)) continue;
    const names = assigneeNames(task);
    if (!names.length) continue;
    const matched = names
      .map((name) => byName.get(name.toLowerCase()))
      .filter((m): m is HouseholdMember => Boolean(m));
    if (!matched.length) continue;
    const weight = 1 / matched.length;
    for (const member of matched) {
      weights.set(member.id, (weights.get(member.id) ?? 0) + weight);
      openCounts.set(member.id, (openCounts.get(member.id) ?? 0) + 1);
    }
  }

  let total = [...weights.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) {
    // No open chores — weigh by this week's XP so the bars still mean something.
    for (const member of people) {
      weights.set(member.id, Math.max(0, member.weekXp ?? 0));
    }
    total = [...weights.values()].reduce((a, b) => a + b, 0);
  }
  if (total <= 0) {
    const equal = Math.round(100 / people.length);
    return people.map((member, index) => ({
      member,
      openCount: 0,
      loadShare:
        index === people.length - 1
          ? 100 - equal * (people.length - 1)
          : equal,
    }));
  }

  const raw = people.map((member) => {
    const weight = weights.get(member.id) ?? 0;
    return {
      member,
      openCount: openCounts.get(member.id) ?? 0,
      loadShare: (weight / total) * 100,
    };
  });
  // Round to integers that sum to 100.
  const floored = raw.map((row) => ({
    ...row,
    loadShare: Math.floor(row.loadShare),
  }));
  let leftover = 100 - floored.reduce((sum, row) => sum + row.loadShare, 0);
  const order = [...floored].sort(
    (a, b) => b.openCount - a.openCount || a.member.name.localeCompare(b.member.name)
  );
  for (const row of order) {
    if (leftover <= 0) break;
    row.loadShare += 1;
    leftover -= 1;
  }
  return floored.sort((a, b) => b.loadShare - a.loadShare);
}

export type RoomCleanStat = {
  room: HouseholdRoom;
  completed: number;
  open: number;
  lastTitle?: string;
};

function taskMatchesRoom(task: HouseholdTask, room: HouseholdRoom): boolean {
  if (task.roomId && task.roomId === room.id) return true;
  const hay = `${task.title} ${task.category}`.toLowerCase();
  const roomToken = room.name.split(' ')[0]!.toLowerCase();
  if (hay.includes(roomToken)) return true;
  const kindHints: Record<string, string[]> = {
    kitchen: ['kitchen', 'dish', 'sink', 'stove', 'fridge'],
    living: ['living', 'lounge', 'sofa', 'couch'],
    bathroom: ['bath', 'toilet', 'shower'],
    bedroom: ['bed', 'bedroom'],
    laundry: ['laundry', 'washer', 'dryer', 'clothes'],
    outdoor: ['outdoor', 'yard', 'garden', 'garage', 'trash', 'bins'],
  };
  const hints = kindHints[room.kind] ?? [];
  return hints.some((h) => hay.includes(h));
}

/** Prefer household rooms; if none synced, use the default set so the strip isn't empty. */
export function resolveHealthRooms(rooms: HouseholdRoom[] | undefined | null): HouseholdRoom[] {
  if (rooms?.length) return rooms;
  return DEFAULT_HOUSEHOLD_ROOMS;
}

export function computeCleaningByRoom(
  tasks: HouseholdTask[],
  rooms: HouseholdRoom[] | undefined | null
): RoomCleanStat[] {
  const list = resolveHealthRooms(rooms);
  return list.map((room) => {
    const roomTasks = tasks.filter((task) => taskMatchesRoom(task, room));
    const completedTasks = roomTasks.filter((task) => task.status === 'Completed');
    const open = roomTasks.filter((task) => isOpenTask(task)).length;
    const last = completedTasks[0];
    return {
      room,
      completed: completedTasks.length,
      open,
      lastTitle: last?.title,
    };
  });
}

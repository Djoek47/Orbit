import { mockHousehold } from '@/data/mock-household';
import { mapTaskRow, taskRepeatToDb, taskStatusToDb } from '@/lib/mappers/orbit-mappers';
import {
  assertUniqueOccurrenceInsert,
  dedupeOccurrences,
} from '@/lib/tasks/occurrence-dedupe';
import {
  buildShares,
  formatAssigneeLabel,
  getTaskAssignees,
  isSplitTask,
} from '@/lib/tasks/split-assign';
import { isTaskLate } from '@/lib/tasks/xp';
import { createLocalId, getConfiguredSupabase, isMockMode, mapDbError } from '@/repositories/repository-utils';
import type { CreateTaskInput, HouseholdTask } from '@/types/orbit';

let mockTasksState: HouseholdTask[] = clone(mockHousehold.tasks);

/** Test / mock continuity — replace in-memory task list. */
export function __setMockTasksStateForTests(tasks: HouseholdTask[]) {
  mockTasksState = clone(tasks);
}

export function __resetTasksMockStateForTests() {
  mockTasksState = clone(mockHousehold.tasks);
}

/**
 * Columns known to exist on the live TestFlight Supabase project.
 * Extended v2 columns (definition_id, verification, …) ship via migration
 * 20260803010000 — omit them from writes until that migration is applied,
 * otherwise inserts fail and Assign appears to do nothing on device.
 */
function buildCoreTaskInsert(input: {
  householdId: string;
  task: HouseholdTask;
  assigneeMemberId: string | null;
}) {
  return {
    household_id: input.householdId,
    title: input.task.title,
    description: input.task.description ?? null,
    category: input.task.category,
    assignee_name: input.task.assignee,
    assignee_member_id: input.assigneeMemberId,
    due_label: input.task.due,
    due_at: input.task.dueAt ?? null,
    xp_value: input.task.xp,
    repeat_rule: taskRepeatToDb(input.task.repeat),
    status: 'pending' as const,
    weight: input.task.weight ?? null,
    difficulty: input.task.difficulty ?? null,
    proof_required: input.task.proofRequired ?? false,
    room_id: input.task.roomId ?? null,
  };
}

function buildCoreTaskUpdate(task: HouseholdTask) {
  return {
    title: task.title,
    description: task.description ?? null,
    category: task.category,
    assignee_name: task.assignee,
    due_label: task.due,
    due_at: task.dueAt ?? null,
    xp_value: task.xp,
    repeat_rule: taskRepeatToDb(task.repeat),
    status: taskStatusToDb(task.status),
    room_id: task.roomId ?? null,
    weight: task.weight ?? null,
    difficulty: task.difficulty ?? null,
    proof_required: task.proofRequired ?? false,
    proof_uri: task.proofUri ?? null,
    proof_status: task.proofStatus ?? null,
  };
}

/** Merge DB row with client-only / not-yet-migrated fields. */
function mergeTaskRow(data: Parameters<typeof mapTaskRow>[0], local: HouseholdTask): HouseholdTask {
  const mapped = mapTaskRow(data);
  return {
    ...mapped,
    roomId: local.roomId ?? mapped.roomId,
    weight: local.weight ?? mapped.weight,
    difficulty: local.difficulty ?? mapped.difficulty,
    proofRequired: local.proofRequired ?? mapped.proofRequired,
    tracking: local.tracking,
    definitionId: local.definitionId,
    occurrenceDate: local.occurrenceDate,
    verification: local.verification,
    awardedXp: local.awardedXp,
    completedAt: local.completedAt,
    completedLate: local.completedLate,
    proofPhotoUrls: local.proofPhotoUrls,
    proofRounds: local.proofRounds,
    verifiedBy: local.verifiedBy,
    verifiedAt: local.verifiedAt,
    assignees: local.assignees,
    shares: local.shares,
    splitXpEach: local.splitXpEach,
    splitBonusXp: local.splitBonusXp,
    splitPenaltyXp: local.splitPenaltyXp,
    sharedDeviceId: local.sharedDeviceId,
    xpEligible: local.xpEligible,
    baseXp: local.baseXp,
  };
}

export const taskRepository = {
  async getTasks(householdId: string | null | undefined): Promise<HouseholdTask[]> {
    if (isMockMode()) {
      return clone(mockTasksState);
    }

    if (!householdId) {
      return [];
    }

    const supabase = getConfiguredSupabase('taskRepository.getTasks');
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });
    mapDbError('taskRepository.getTasks', error);

    return (data ?? []).map((row) => mapTaskRow(row));
  },

  async createTask(householdId: string | null | undefined, input: CreateTaskInput): Promise<HouseholdTask> {
    const assigneeNames = (input.assignees?.length ? input.assignees : [input.assignee])
      .map((name) => name.trim())
      .filter(Boolean);
    const uniqueNames = [...new Set(assigneeNames)];
    const split = uniqueNames.length > 1;

    const task: HouseholdTask = {
      id: createLocalId('task'),
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      category: input.category,
      assignee: split ? formatAssigneeLabel(uniqueNames) : uniqueNames[0] ?? input.assignee,
      assignees: split ? uniqueNames : undefined,
      shares: split ? buildShares(uniqueNames, input.proofRequired) : undefined,
      splitXpEach: split ? input.splitXpEach ?? input.xp : undefined,
      splitBonusXp: split ? input.splitBonusXp : undefined,
      splitPenaltyXp: split ? input.splitPenaltyXp : undefined,
      due: input.due.trim(),
      xp: input.xp,
      baseXp: input.baseXp ?? input.xp,
      xpEligible: input.xpEligible,
      weight: input.weight,
      difficulty: input.difficulty,
      tracking: input.tracking,
      proofRequired: input.proofRequired,
      proofStatus: input.proofRequired && !split ? 'none' : undefined,
      verification: input.proofRequired ? 'not_required' : 'not_required',
      dueAt: input.dueAt,
      roomId: input.roomId,
      sharedDeviceId: input.sharedDeviceId,
      definitionId: input.definitionId,
      occurrenceDate: input.occurrenceDate,
      repeat: input.repeat,
      status: 'Pending',
    };

    if (isMockMode()) {
      assertUniqueOccurrenceInsert(mockTasksState, task);
      mockTasksState = [task, ...mockTasksState];
      return task;
    }

    if (!householdId) {
      throw new Error('taskRepository.createTask: householdId is required in Supabase mode.');
    }

    const supabase = getConfiguredSupabase('taskRepository.createTask');

    // Resolve member by first assignee name (split labels are not a single display_name).
    const lookupName = uniqueNames[0] ?? input.assignee.trim();
    const { data: member } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', householdId)
      .ilike('display_name', lookupName)
      .maybeSingle();

    const corePayload = buildCoreTaskInsert({
      householdId,
      task,
      assigneeMemberId: member?.id ?? null,
    });

    // Write only columns that exist on production today. Extended v2 columns
    // (definition_id / occurrence_date / verification) are kept on the client
    // object until migration 20260803010000 is applied to Supabase.
    const { data, error } = await supabase
      .from('tasks')
      .insert(corePayload as never)
      .select('*')
      .single();

    mapDbError('taskRepository.createTask', error);

    if (!data) {
      throw new Error('taskRepository.createTask: Insert returned no row.');
    }

    return mergeTaskRow(data, task);
  },

  async updateTask(task: HouseholdTask): Promise<HouseholdTask> {
    const next: HouseholdTask = {
      ...task,
      title: task.title.trim(),
      description: task.description?.trim() || undefined,
      due: task.due.trim(),
    };

    if (isMockMode()) {
      mockTasksState = mockTasksState.map((item) => (item.id === next.id ? next : item));
      return next;
    }

    const supabase = getConfiguredSupabase('taskRepository.updateTask');
    const corePayload = buildCoreTaskUpdate(next);

    // Same as create — core columns only until the occurrence migration is live.
    const { data, error } = await supabase
      .from('tasks')
      .update(corePayload as never)
      .eq('id', next.id)
      .select('*')
      .single();

    mapDbError('taskRepository.updateTask', error);

    return data ? mergeTaskRow(data, next) : next;
  },

  async deleteTask(taskId: string): Promise<void> {
    if (isMockMode()) {
      mockTasksState = mockTasksState.filter((item) => item.id !== taskId);
      return;
    }

    const supabase = getConfiguredSupabase('taskRepository.deleteTask');
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    mapDbError('taskRepository.deleteTask', error);
  },

  async completeTask(
    task: HouseholdTask,
    householdId?: string | null
  ): Promise<HouseholdTask> {
    const completedAt = task.completedAt ?? new Date().toISOString();
    const completed: HouseholdTask = {
      ...task,
      due: 'Completed today',
      status: 'Completed',
      awardedXp: task.awardedXp,
      completedAt,
      // Keep prior proof status (usually 'none') — attach happens after complete.
      proofStatus: task.proofStatus,
    };

    if (isMockMode()) {
      mockTasksState = mockTasksState.map((item) => (item.id === completed.id ? completed : item));
      return completed;
    }

    const supabase = getConfiguredSupabase('taskRepository.completeTask');
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        due_label: 'Completed today',
      })
      .eq('id', task.id)
      .select('*')
      .single();
    mapDbError('taskRepository.completeTask', error);

    const resolvedHouseholdId = householdId ?? data?.household_id;
    const xpToAward = task.awardedXp ?? 0;
    if (resolvedHouseholdId && xpToAward > 0) {
      await awardTaskXp(supabase, resolvedHouseholdId, data ?? null, {
        ...task,
        awardedXp: xpToAward,
      });
    }

    return data
      ? { ...mapTaskRow(data), awardedXp: task.awardedXp, completedAt }
      : completed;
  },

  /**
   * Award a pre-resolved XP snapshot to a named member (split shares).
   * Does not re-run resolveCompletionXp — caller owns the snapshot.
   */
  async awardMemberXp(input: {
    householdId: string;
    memberName: string;
    amount: number;
    reason: string;
    taskId?: string;
  }): Promise<void> {
    if (isMockMode() || input.amount <= 0) {
      return;
    }
    const supabase = getConfiguredSupabase('taskRepository.awardMemberXp');
    const { data: member } = await supabase
      .from('household_members')
      .select('id, xp, week_xp')
      .eq('household_id', input.householdId)
      .ilike('display_name', input.memberName)
      .maybeSingle();
    if (!member) return;

    const { error: xpError } = await supabase
      .from('household_members')
      .update({
        xp: (member.xp ?? 0) + input.amount,
        week_xp: (member.week_xp ?? 0) + input.amount,
      })
      .eq('id', member.id);
    mapDbError('taskRepository.awardMemberXp.memberXp', xpError);

    const { data: authData } = await supabase.auth.getUser();
    const { error: txError } = await supabase.from('xp_transactions').insert({
      household_id: input.householdId,
      user_id: authData.user?.id ?? null,
      member_id: member.id,
      amount: input.amount,
      reason: input.reason,
      related_task_id: input.taskId ?? null,
    });
    mapDbError('taskRepository.awardMemberXp.xpTransaction', txError);
  },

  async updateMemberStreak(input: {
    householdId: string;
    memberId: string;
    streak: number;
  }): Promise<void> {
    if (isMockMode()) return;
    const supabase = getConfiguredSupabase('taskRepository.updateMemberStreak');
    const { error } = await supabase
      .from('household_members')
      .update({ streak: input.streak })
      .eq('id', input.memberId)
      .eq('household_id', input.householdId);
    mapDbError('taskRepository.updateMemberStreak', error);
  },

  /**
   * Rev F §1.2.b — occurrence insert as upsert on conflict do nothing.
   * Returns the existing row when (definitionId, occurrenceDate) already exists.
   */
  async upsertOccurrence(
    householdId: string | null | undefined,
    input: CreateTaskInput
  ): Promise<{ task: HouseholdTask; inserted: boolean }> {
    if (!input.definitionId || !input.occurrenceDate) {
      const task = await taskRepository.createTask(householdId, input);
      return { task, inserted: true };
    }

    if (isMockMode()) {
      const existing = mockTasksState.find(
        (t) =>
          t.definitionId === input.definitionId && t.occurrenceDate === input.occurrenceDate
      );
      if (existing) {
        return { task: existing, inserted: false };
      }
      try {
        const task = await taskRepository.createTask(householdId, input);
        return { task, inserted: true };
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('UNIQUE_VIOLATION')) {
          const again = mockTasksState.find(
            (t) =>
              t.definitionId === input.definitionId && t.occurrenceDate === input.occurrenceDate
          );
          if (again) return { task: again, inserted: false };
        }
        throw error;
      }
    }

    // Supabase: try insert; unique index rejects duplicates.
    try {
      const task = await taskRepository.createTask(householdId, input);
      return { task, inserted: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/duplicate|unique|23505/i.test(message) && householdId) {
        const all = await taskRepository.getTasks(householdId);
        const existing = all.find(
          (t) =>
            t.definitionId === input.definitionId && t.occurrenceDate === input.occurrenceDate
        );
        if (existing) return { task: existing, inserted: false };
      }
      throw error;
    }
  },

  /** Rev F §1.2.d — apply in-memory dedupe (mock / catch-up). */
  applyOccurrenceDedupe(): { deletedCount: number; xpReconciled: number } {
    const report = dedupeOccurrences(mockTasksState);
    mockTasksState = report.kept;
    return { deletedCount: report.deletedCount, xpReconciled: report.xpReconciled };
  },
};

/**
 * Award XP using the completion snapshot on `task.awardedXp`.
 * Never re-resolves mode/late math — that would double-penalize.
 */
async function awardTaskXp(
  supabase: ReturnType<typeof getConfiguredSupabase>,
  householdId: string,
  taskRow: { assignee_member_id: string | null; assignee_name: string; id: string } | null,
  task: HouseholdTask
) {
  const awarded = task.awardedXp ?? 0;
  if (awarded <= 0) {
    return;
  }

  let memberId = taskRow?.assignee_member_id ?? null;
  const late = isTaskLate(task);
  const reason = late
    ? `Completed task (late): ${task.title}`
    : `Completed task: ${task.title}`;

  if (!memberId) {
    const { data: member } = await supabase
      .from('household_members')
      .select('id, xp, week_xp')
      .eq('household_id', householdId)
      .ilike('display_name', task.assignee)
      .maybeSingle();

    if (member) {
      memberId = member.id;
      const { error: xpError } = await supabase
        .from('household_members')
        .update({
          xp: (member.xp ?? 0) + awarded,
          week_xp: (member.week_xp ?? 0) + awarded,
        })
        .eq('id', member.id);
      mapDbError('taskRepository.completeTask.memberXp', xpError);
    }
  } else {
    const { data: member } = await supabase
      .from('household_members')
      .select('id, xp, week_xp')
      .eq('id', memberId)
      .maybeSingle();

    if (member) {
      const { error: xpError } = await supabase
        .from('household_members')
        .update({
          xp: (member.xp ?? 0) + awarded,
          week_xp: (member.week_xp ?? 0) + awarded,
        })
        .eq('id', member.id);
      mapDbError('taskRepository.completeTask.memberXp', xpError);
    }
  }

  const { data: authData } = await supabase.auth.getUser();
  const { error: txError } = await supabase.from('xp_transactions').insert({
    household_id: householdId,
    user_id: authData.user?.id ?? null,
    member_id: memberId,
    amount: awarded,
    reason,
    related_task_id: task.id,
  });
  mapDbError('taskRepository.completeTask.xpTransaction', txError);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

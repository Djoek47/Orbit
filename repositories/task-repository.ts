import { mockHousehold } from '@/data/mock-household';
import { mapTaskRow, taskRepeatToDb, taskStatusToDb } from '@/lib/mappers/orbit-mappers';
import { createLocalId, getConfiguredSupabase, isMockMode, mapDbError } from '@/repositories/repository-utils';
import type { CreateTaskInput, HouseholdTask } from '@/types/orbit';

let mockTasksState: HouseholdTask[] = clone(mockHousehold.tasks);

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
    const task: HouseholdTask = {
      id: createLocalId('task'),
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      category: input.category,
      assignee: input.assignee,
      due: input.due.trim(),
      xp: input.xp,
      repeat: input.repeat,
      status: 'Pending',
    };

    if (isMockMode()) {
      mockTasksState = [task, ...mockTasksState];
      return task;
    }

    if (!householdId) {
      throw new Error('taskRepository.createTask: householdId is required in Supabase mode.');
    }

    const supabase = getConfiguredSupabase('taskRepository.createTask');

    const { data: member } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', householdId)
      .ilike('display_name', input.assignee.trim())
      .maybeSingle();

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        household_id: householdId,
        title: task.title,
        description: task.description ?? null,
        category: task.category,
        assignee_name: task.assignee,
        assignee_member_id: member?.id ?? null,
        due_label: task.due,
        xp_value: task.xp,
        repeat_rule: taskRepeatToDb(task.repeat),
        status: 'pending',
      })
      .select('*')
      .single();
    mapDbError('taskRepository.createTask', error);

    if (!data) {
      throw new Error('taskRepository.createTask: Insert returned no row.');
    }

    return mapTaskRow(data);
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
    const { data, error } = await supabase
      .from('tasks')
      .update({
        title: next.title,
        description: next.description ?? null,
        category: next.category,
        assignee_name: next.assignee,
        due_label: next.due,
        xp_value: next.xp,
        repeat_rule: taskRepeatToDb(next.repeat),
        status: taskStatusToDb(next.status),
      })
      .eq('id', next.id)
      .select('*')
      .single();
    mapDbError('taskRepository.updateTask', error);

    return data ? mapTaskRow(data) : next;
  },

  async completeTask(
    task: HouseholdTask,
    householdId?: string | null
  ): Promise<HouseholdTask> {
    const completed: HouseholdTask = {
      ...task,
      due: 'Completed today',
      status: 'Completed',
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
    if (resolvedHouseholdId && task.xp > 0) {
      await awardTaskXp(supabase, resolvedHouseholdId, data ?? null, task);
    }

    return data ? mapTaskRow(data) : completed;
  },
};

async function awardTaskXp(
  supabase: ReturnType<typeof getConfiguredSupabase>,
  householdId: string,
  taskRow: { assignee_member_id: string | null; assignee_name: string; id: string } | null,
  task: HouseholdTask
) {
  let memberId = taskRow?.assignee_member_id ?? null;

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
          xp: (member.xp ?? 0) + task.xp,
          week_xp: (member.week_xp ?? 0) + task.xp,
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
          xp: (member.xp ?? 0) + task.xp,
          week_xp: (member.week_xp ?? 0) + task.xp,
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
    amount: task.xp,
    reason: `Completed task: ${task.title}`,
    related_task_id: task.id,
  });
  mapDbError('taskRepository.completeTask.xpTransaction', txError);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

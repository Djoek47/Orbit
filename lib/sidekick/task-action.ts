/**
 * Sidekick / profile-code device writes (no Supabase JWT).
 */

import { mapTaskRow, mapEventRow, mapGroceryRow } from '@/lib/mappers/orbit-mappers';
import { loadSidekickSession } from '@/lib/sidekick/session';
import { getSupabaseClient } from '@/lib/supabase/client';
import { dataMode } from '@/config/data-mode';
import type { CreateEventInput, CreateGroceryInput, CreateTaskInput, GroceryItem, HouseholdEvent, HouseholdTask } from '@/types/orbit';

export async function usesProfileCodeAuth(): Promise<{ code: string; memberId: string } | null> {
  if (dataMode !== 'supabase') return null;
  const session = await loadSidekickSession();
  if (!session?.profileInviteCode?.trim()) return null;
  return {
    code: session.profileInviteCode.trim().toUpperCase(),
    memberId: session.memberId,
  };
}

function mapSidekickTaskRow(row: Record<string, unknown>, local: HouseholdTask): HouseholdTask {
  const mapped = mapTaskRow(row as Parameters<typeof mapTaskRow>[0]);
  return {
    ...mapped,
    awardedXp: local.awardedXp ?? mapped.awardedXp,
    completedAt: local.completedAt ?? mapped.completedAt,
    completedLate: local.completedLate ?? mapped.completedLate,
    verification: local.verification ?? mapped.verification,
    proofStatus: local.proofStatus ?? mapped.proofStatus,
    proofUri: local.proofUri ?? mapped.proofUri,
    shares: local.shares,
    assignees: local.assignees,
    splitXpEach: local.splitXpEach,
    splitBonusXp: local.splitBonusXp,
    splitPenaltyXp: local.splitPenaltyXp,
  };
}

export async function sidekickCompleteTask(input: {
  code: string;
  taskId: string;
  task: HouseholdTask;
  awardedXp: number;
  completedAt: string;
  completedLate: boolean;
  verification: HouseholdTask['verification'];
  taskStatus?: 'completed' | 'in_progress';
  dueLabel?: string;
  bonusAwards?: { memberId: string; amount: number; reason?: string }[];
}): Promise<HouseholdTask> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client unavailable');
  }

  const { data, error } = await supabase.functions.invoke('sidekick-task-action', {
    body: {
      action: 'complete',
      code: input.code,
      taskId: input.taskId,
      awardedXp: input.awardedXp,
      completedAt: input.completedAt,
      completedLate: input.completedLate,
      verification: input.verification ?? 'not_required',
      taskStatus: input.taskStatus ?? 'completed',
      dueLabel: input.dueLabel ?? 'Completed today',
      bonusAwards: input.bonusAwards ?? [],
    },
  });

  if (error) {
    throw new Error(error.message || 'sidekickCompleteTask failed');
  }

  const payload = data as { error?: string; task?: Record<string, unknown> };
  if (payload?.error || !payload?.task) {
    throw new Error(payload?.error ?? 'sidekickCompleteTask empty response');
  }

  return mapSidekickTaskRow(payload.task, input.task);
}

export async function sidekickSubmitTaskProof(input: {
  code: string;
  taskId: string;
  task: HouseholdTask;
  proofUri: string;
}): Promise<HouseholdTask> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client unavailable');
  }

  const { data, error } = await supabase.functions.invoke('sidekick-task-action', {
    body: {
      action: 'submit_proof',
      code: input.code,
      taskId: input.taskId,
      proofUri: input.proofUri,
    },
  });

  if (error) {
    throw new Error(error.message || 'sidekickSubmitTaskProof failed');
  }

  const payload = data as { error?: string; task?: Record<string, unknown> };
  if (payload?.error || !payload?.task) {
    throw new Error(payload?.error ?? 'sidekickSubmitTaskProof empty response');
  }

  return mapSidekickTaskRow(payload.task, {
    ...input.task,
    proofUri: input.proofUri,
    proofStatus: 'submitted',
  });
}

async function invokeSidekickFunction<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client unavailable');
  }
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) {
    throw new Error(error.message || `${functionName} failed`);
  }
  const payload = data as { error?: string } & T;
  if (payload?.error) {
    throw new Error(payload.error);
  }
  return payload;
}

export async function sidekickCreateHomework(input: {
  code: string;
  task: CreateTaskInput;
}): Promise<HouseholdTask> {
  const payload = await invokeSidekickFunction<{ task: Record<string, unknown> }>(
    'sidekick-task-action',
    {
      action: 'create_homework',
      code: input.code,
      title: input.task.title,
      category: input.task.category,
      homeworkSubject: input.task.homeworkSubject,
      xp: input.task.xp,
      dueLabel: input.task.due,
      proofRequired: input.task.proofRequired,
    }
  );
  if (!payload.task) {
    throw new Error('sidekickCreateHomework empty response');
  }
  return mapTaskRow(payload.task as Parameters<typeof mapTaskRow>[0]);
}

export async function sidekickAddGrocery(input: {
  code: string;
  item: CreateGroceryInput;
}): Promise<GroceryItem> {
  const payload = await invokeSidekickFunction<{ item: Record<string, unknown> }>(
    'sidekick-grocery-action',
    {
      action: 'add_item',
      code: input.code,
      name: input.item.name,
      category: input.item.category,
      quantity: input.item.quantity,
      location: input.item.location?.toLowerCase(),
      note: input.item.note,
    }
  );
  if (!payload.item) {
    throw new Error('sidekickAddGrocery empty response');
  }
  return mapGroceryRow(payload.item as Parameters<typeof mapGroceryRow>[0]);
}

export async function sidekickCreateEvent(input: {
  code: string;
  event: CreateEventInput;
  memberName: string;
  memberId: string;
}): Promise<HouseholdEvent> {
  const payload = await invokeSidekickFunction<{
    event: Record<string, unknown>;
    attendeeMemberIds?: string[];
  }>('sidekick-event-action', {
    action: 'create_event',
    code: input.code,
    title: input.event.title,
    category: input.event.category,
    date: input.event.date,
    time: input.event.time,
    location: input.event.location,
    householdWide: input.event.householdWide,
    startsAt: input.event.startsAt,
    approvalStatus: input.event.approvalStatus,
    attendeeMemberIds: input.event.attendeeMemberIds ?? [input.memberId],
  });
  if (!payload.event) {
    throw new Error('sidekickCreateEvent empty response');
  }
  const mapped = mapEventRow(payload.event as Parameters<typeof mapEventRow>[0]);
  return {
    ...mapped,
    responsible: input.event.responsible ?? input.memberName,
    responsibleMemberId: input.event.responsibleMemberId ?? input.memberId,
    attendeeMemberIds: payload.attendeeMemberIds ?? input.event.attendeeMemberIds,
  };
}

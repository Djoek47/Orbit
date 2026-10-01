/**
 * Sidekick / profile-code device writes (no Supabase JWT).
 */

import { mapTaskRow, mapEventRow, mapGroceryRow } from '@/lib/mappers/orbit-mappers';
import { isSidekickLocalUserId, loadSidekickSession } from '@/lib/sidekick/session';
import { getSupabaseClient } from '@/lib/supabase/client';
import { dataMode } from '@/config/data-mode';
import type { CreateEventInput, CreateGroceryInput, CreateTaskInput, GroceryItem, HouseholdEvent, HouseholdTask } from '@/types/orbit';

/**
 * Profile-code auth for Sidekick devices only.
 * Real JWT sessions (admin / co-admin) win over leftover Sidekick storage.
 */
export async function usesProfileCodeAuth(): Promise<{ code: string; memberId: string } | null> {
  if (dataMode !== 'supabase') return null;

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (userId && !isSidekickLocalUserId(userId)) {
      return null;
    }
  }

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
    const detail = await edgeErrorMessage(error, 'sidekickCompleteTask failed');
    // Older edge builds returned 409 already_completed — treat as success locally.
    if (/already_completed|already completed|409/i.test(detail)) {
      return mapSidekickTaskRow(
        {
          id: input.taskId,
          status: 'completed',
          awarded_xp: input.awardedXp,
          completed_at: input.completedAt,
          completed_late: input.completedLate,
          verification: input.verification ?? 'not_required',
        },
        input.task
      );
    }
    throw new Error(detail);
  }

  const payload = data as {
    error?: string;
    task?: Record<string, unknown>;
    alreadyCompleted?: boolean;
  };
  if (payload?.error || !payload?.task) {
    throw new Error(payload?.error ?? 'sidekickCompleteTask empty response');
  }

  return mapSidekickTaskRow(payload.task, input.task);
}

/** supabase-js hides the server's reason behind "non-2xx status code"; dig it out of the response. */
export async function edgeErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as Response).json === 'function') {
    try {
      const body = (await (context as Response).clone().json()) as { error?: unknown };
      if (typeof body?.error === 'string' && body.error) return body.error;
    } catch {
      // body wasn't JSON — fall through
    }
  }
  return (error as { message?: string } | null)?.message || fallback;
}

async function invokeSidekickTaskAction(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client unavailable');
  }
  const { data, error } = await supabase.functions.invoke('sidekick-task-action', { body });
  if (error) {
    throw new Error(await edgeErrorMessage(error, 'sidekick-task-action failed'));
  }
  const payload = (data ?? {}) as Record<string, unknown>;
  if (typeof payload.error === 'string' && payload.error) {
    throw new Error(payload.error);
  }
  return payload;
}

/**
 * Upload a local proof photo to Storage via a signed URL from the edge function
 * (Sidekick devices have no Storage JWT). Falls back to base64 in submit_proof.
 */
async function uploadSidekickProofBytes(input: {
  code: string;
  taskId: string;
  localUri: string;
}): Promise<{ proofUri?: string; proofBase64?: string; proofMime?: string; proofExt?: string }> {
  const {
    needsProofUpload,
    proofBytesForEdge,
    proofBytesFromBase64,
  } = await import('@/lib/tasks/upload-proof');

  if (!needsProofUpload(input.localUri)) {
    return { proofUri: input.localUri.trim() };
  }

  const bytes = await proofBytesForEdge(input.localUri);
  if (!bytes.proofBase64 || bytes.byteLength < 32) {
    throw new Error('Could not read the photo. Try taking it again.');
  }

  try {
    const prep = await invokeSidekickTaskAction({
      action: 'prepare_proof_upload',
      code: input.code,
      taskId: input.taskId,
      proofExt: bytes.proofExt,
      proofMime: bytes.proofMime,
    });
    const signedUrl = typeof prep.signedUrl === 'string' ? prep.signedUrl : '';
    const publicUrl = typeof prep.publicUrl === 'string' ? prep.publicUrl : '';
    if (signedUrl && publicUrl) {
      const raw = proofBytesFromBase64(bytes.proofBase64);
      const copy = new ArrayBuffer(raw.byteLength);
      new Uint8Array(copy).set(raw);
      const put = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': bytes.proofMime,
          'x-upsert': 'true',
        },
        body: copy,
      });
      if (put.ok) {
        return { proofUri: publicUrl };
      }
    }
  } catch {
    // Fall through to base64 on the submit call.
  }

  return {
    proofBase64: bytes.proofBase64,
    proofMime: bytes.proofMime,
    proofExt: bytes.proofExt,
  };
}

export async function sidekickSubmitTaskProof(input: {
  code: string;
  taskId: string;
  task: HouseholdTask;
  proofUri: string;
}): Promise<HouseholdTask> {
  if (!input.proofUri?.trim()) {
    throw new Error('proof_uri_required');
  }

  const uploaded = await uploadSidekickProofBytes({
    code: input.code,
    taskId: input.taskId,
    localUri: input.proofUri,
  });

  const body: Record<string, unknown> = {
    action: 'submit_proof',
    code: input.code,
    taskId: input.taskId,
  };
  if (uploaded.proofUri) body.proofUri = uploaded.proofUri;
  if (uploaded.proofBase64) {
    body.proofBase64 = uploaded.proofBase64;
    body.proofMime = uploaded.proofMime;
    body.proofExt = uploaded.proofExt;
  }

  if (!body.proofUri && !body.proofBase64) {
    throw new Error('Could not prepare the photo for upload. Try again.');
  }

  const payload = await invokeSidekickTaskAction(body);
  const taskRow = payload.task as Record<string, unknown> | undefined;
  if (!taskRow) {
    throw new Error('sidekickSubmitTaskProof empty response');
  }

  const remoteUri =
    typeof taskRow.proof_uri === 'string' && taskRow.proof_uri.trim()
      ? taskRow.proof_uri.trim()
      : uploaded.proofUri ?? input.proofUri;

  return mapSidekickTaskRow(taskRow, {
    ...input.task,
    proofUri: remoteUri,
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

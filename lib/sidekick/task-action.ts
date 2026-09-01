/**
 * Sidekick / profile-code device writes (no Supabase JWT).
 */

import { mapTaskRow } from '@/lib/mappers/orbit-mappers';
import { loadSidekickSession } from '@/lib/sidekick/session';
import { getSupabaseClient } from '@/lib/supabase/client';
import { dataMode } from '@/config/data-mode';
import type { HouseholdTask } from '@/types/orbit';

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

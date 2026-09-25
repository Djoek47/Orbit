/**
 * Handle Approve / Change on an IUI act notification.
 * Approve → same commitIuiBeat path as the stage. Change → frozen continuity restore.
 */
import { router } from 'expo-router';

import {
  IUI_ACT_APPROVE,
  IUI_ACT_CHANGE,
} from '@/lib/notifications/iui-act-category';
import { commitIuiBeat, type IuiCommitWrites } from '@/lib/poppins/iui-commit';
import {
  continuityFromIuiAct,
  loadIuiContinuity,
  saveIuiContinuity,
} from '@/lib/poppins/iui-continuity';
import {
  IUI_ACT_KIND,
  isIuiActExpired,
  isNotificationApprovable,
  parseIuiActBeat,
} from '@/lib/poppins/iui-act-notification';

export type IuiActResponseResult =
  | { handled: false }
  | { handled: true; action: 'expired' | 'approve' | 'change' | 'open' };

export async function handleIuiActNotificationResponse(input: {
  actionIdentifier: string;
  data: Record<string, unknown>;
  writes: IuiCommitWrites;
  /** Optional hook after Approve (act tokens now charged in commitIuiBeat). */
  onApproved?: () => void | Promise<void>;
  defaultActionId?: string;
}): Promise<IuiActResponseResult> {
  if (input.data.kind !== IUI_ACT_KIND) return { handled: false };

  const beat = parseIuiActBeat(input.data);
  if (!beat) return { handled: false };

  const householdId =
    typeof input.data.householdId === 'string' ? input.data.householdId : '';
  const defaultId = input.defaultActionId ?? 'expo.modules.notifications.actions.DEFAULT';
  const action = input.actionIdentifier;

  if (isIuiActExpired(input.data)) {
    if (action === IUI_ACT_CHANGE || action === defaultId) {
      await openChange(householdId, beat);
      return { handled: true, action: 'expired' };
    }
    return { handled: true, action: 'expired' };
  }

  const recipientName = input.writes.currentMember?.name;
  const approvable =
    input.data.approvable === true ||
    (input.data.approvable !== false && isNotificationApprovable(beat, recipientName));

  if (action === IUI_ACT_APPROVE) {
    if (!approvable) {
      await openChange(householdId, beat);
      return { handled: true, action: 'change' };
    }
    try {
      await commitIuiBeat(beat, input.writes);
    } catch (error) {
      const { ActRejectedError, clearRejectedSlot } = await import('@/lib/poppins/validate-act');
      if (error instanceof ActRejectedError) {
        const cleared = {
          ...beat,
          payload: clearRejectedSlot(beat.payload, error.validation.slot),
        };
        await openChange(householdId, cleared);
        return { handled: true, action: 'change' };
      }
      throw error;
    }
    await input.onApproved?.();
    return { handled: true, action: 'approve' };
  }

  if (action === IUI_ACT_CHANGE || action === defaultId) {
    await openChange(householdId, beat);
    return { handled: true, action: action === IUI_ACT_CHANGE ? 'change' : 'open' };
  }

  return { handled: false };
}

async function openChange(householdId: string, beat: ReturnType<typeof parseIuiActBeat>) {
  if (!beat || !householdId) {
    router.push('/(tabs)/poppins' as never);
    return;
  }
  const prior = await loadIuiContinuity(householdId);
  await saveIuiContinuity(continuityFromIuiAct({ householdId, beat, prior }));
  router.push('/(tabs)/poppins' as never);
}

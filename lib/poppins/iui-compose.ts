/**
 * IUI compose — one missing fact per beat.
 * WO12 §C: order follows the sentence via slotOrder / focusSlot.
 */

import type { IuiPayload } from '@/lib/poppins/ui-scenes';
import {
  applySlotOrder,
  deriveFocusSlot,
  type SlotKey,
} from '@/lib/poppins/slot-order';

export type IuiComposeStep = 'who' | 'category' | 'task' | 'when' | 'ready';

export const COMPOSE_STEPS: IuiComposeStep[] = ['who', 'category', 'task', 'when', 'ready'];

function focusToComposeStep(focus: SlotKey | null): IuiComposeStep {
  if (focus === 'assignee') return 'who';
  if (focus === 'category') return 'category';
  if (focus === 'title') return 'task';
  if (focus === 'due') return 'when';
  return 'ready';
}

export function nextComposeStep(payload: IuiPayload): IuiComposeStep {
  // Speech-ordered turns follow focusSlot (WO12 §C).
  if (payload.slotOrder?.length || payload.sourceUtterance?.trim()) {
    const ordered = applySlotOrder(payload);
    const focus = ordered.focusSlot ?? deriveFocusSlot(ordered);
    if (focus != null) return focusToComposeStep(focus);
    return 'ready';
  }
  // Legacy walk when nothing was spoken yet: who → category → task → when.
  if (!payload.assignee?.trim()) return 'who';
  if (!payload.title?.trim() && !payload.libraryTaskId?.trim()) {
    if (!payload.category?.trim() && !payload.selectedChipId?.trim()) return 'category';
    return 'task';
  }
  if (!payload.due?.trim()) return 'when';
  return 'ready';
}

export function isComposeReady(payload: IuiPayload): boolean {
  return nextComposeStep(payload) === 'ready';
}

export function composeStepLabel(step: IuiComposeStep): string {
  switch (step) {
    case 'who':
      return 'Who';
    case 'category':
      return 'Category';
    case 'task':
      return 'Task';
    case 'when':
      return 'When';
    case 'ready':
      return 'Hold';
  }
}

export function withComposeProgress(payload: IuiPayload): IuiPayload {
  const withSlots = applySlotOrder(payload);
  const step = nextComposeStep(withSlots);
  return {
    ...withSlots,
    composeStep: step,
    composeReady: step === 'ready',
    focusSlot: withSlots.focusSlot ?? null,
  };
}

export const IUI_DUE_CHIPS = [
  { id: 'Today', label: 'Today' },
  { id: 'Tomorrow', label: 'Tomorrow' },
  { id: 'This week', label: 'This week' },
  { id: 'Daily', label: 'Daily' },
] as const;

export const IUI_CREATED_CHIP_ID = 'created';

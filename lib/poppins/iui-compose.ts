/**
 * IUI compose — one missing fact per beat (who → category → task → when).
 */

import type { IuiPayload } from '@/lib/poppins/ui-scenes';

export type IuiComposeStep = 'who' | 'category' | 'task' | 'when' | 'ready';

export const COMPOSE_STEPS: IuiComposeStep[] = ['who', 'category', 'task', 'when', 'ready'];

export function nextComposeStep(payload: IuiPayload): IuiComposeStep {
  if (!payload.assignee?.trim()) return 'who';
  if (!payload.title?.trim() && !payload.libraryTaskId?.trim()) {
    if (!payload.category?.trim() && !payload.selectedChipId?.trim()) return 'category';
    return 'task';
  }
  if (payload.title?.trim() && !payload.libraryTaskId?.trim() && !payload.due?.trim()) {
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
  const step = nextComposeStep(payload);
  return {
    ...payload,
    composeStep: step,
    composeReady: step === 'ready',
  };
}

export const IUI_DUE_CHIPS = [
  { id: 'Today', label: 'Today' },
  { id: 'Tomorrow', label: 'Tomorrow' },
  { id: 'This week', label: 'This week' },
  { id: 'Daily', label: 'Daily' },
] as const;

export const IUI_CREATED_CHIP_ID = 'created';

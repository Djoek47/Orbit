/**
 * Homework IUI — who (child) → subject → when (no Daily/Weekly repeat).
 */

import type { IuiPayload } from '@/lib/poppins/ui-scenes';

export type HomeworkComposeStep = 'who' | 'subject' | 'when' | 'ready';

export const HOMEWORK_COMPOSE_STEPS: HomeworkComposeStep[] = ['who', 'subject', 'when', 'ready'];

export const HOMEWORK_DUE_CHIPS = [
  { id: 'Today', label: 'Today' },
  { id: 'Tomorrow', label: 'Tomorrow' },
  { id: 'This week', label: 'This week' },
] as const;

export const HOMEWORK_SUBJECT_CHIPS = [
  { id: 'math', label: 'Math', emoji: '🔢' },
  { id: 'english', label: 'English', emoji: '📖' },
  { id: 'science', label: 'Science', emoji: '🧪' },
  { id: 'history', label: 'History', emoji: '🏛️' },
  { id: 'reading', label: 'Reading', emoji: '📚' },
] as const;

export function nextHomeworkComposeStep(payload: IuiPayload): HomeworkComposeStep {
  if (!payload.assignee?.trim()) return 'who';
  if (!payload.title?.trim() && !payload.libraryTaskId?.trim()) return 'subject';
  if (!payload.due?.trim()) return 'when';
  return 'ready';
}

export function isHomeworkComposeReady(payload: IuiPayload): boolean {
  return nextHomeworkComposeStep(payload) === 'ready';
}

export function homeworkComposeStepLabel(step: HomeworkComposeStep): string {
  switch (step) {
    case 'who':
      return 'Who';
    case 'subject':
      return 'Subject';
    case 'when':
      return 'When';
    case 'ready':
      return 'Hold';
  }
}

export function withHomeworkComposeProgress(payload: IuiPayload): IuiPayload {
  const step = nextHomeworkComposeStep(payload);
  return {
    ...payload,
    composeStep: step,
    composeReady: step === 'ready',
    category: 'homework_education',
  };
}

export function isHomeworkPayload(payload: IuiPayload): boolean {
  return payload.category === 'homework_education' || payload.composeKind === 'homework';
}

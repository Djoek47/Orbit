/**
 * The tour's demonstrations, and which step button opens which.
 *
 * A demonstration is never a screen the tour navigates to. It plays in a panel inside the tour's
 * own overlay, the tour waits on the step that opened it, and it moves on only once the panel is
 * closed. Opening them as routes pushed a screen and, in the same moment, navigated to the next
 * step's tab — iOS stacked a second copy of the app on top of the demo.
 */
import type { TourStep } from '@/lib/tour/tour-types';

export type TourDemoId =
  | 'proof_chore'
  | 'proof_homework'
  | 'mock_assign'
  | 'mock_homework'
  | 'mock_sidekick'
  | 'poppins';

const DEMO_FOR_ACTION: Record<string, TourDemoId> = {
  open_proof_walkthrough: 'proof_chore',
  open_homework_walkthrough: 'proof_homework',
  open_mock_assign: 'mock_assign',
  open_mock_homework: 'mock_homework',
  open_mock_sidekick: 'mock_sidekick',
  open_poppins_demo: 'poppins',
};

/** The demo a step's primary button plays, or null for an ordinary Next. */
export function demoForStep(step: Pick<TourStep, 'primaryAction'> | null | undefined): TourDemoId | null {
  const action = step?.primaryAction;
  if (!action) return null;
  return DEMO_FOR_ACTION[action] ?? null;
}

export const TOUR_DEMO_IDS: readonly TourDemoId[] = [
  'proof_chore',
  'proof_homework',
  'mock_assign',
  'mock_homework',
  'mock_sidekick',
  'poppins',
];

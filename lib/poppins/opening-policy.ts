/**
 * When Speak opens, decide whether Poppins talks first.
 * Default is listen. Never a self-introduction.
 */

import { hasOpenAct, isContinuityFresh, type IuiContinuity } from '@/lib/poppins/iui-continuity';

export type OpeningMode = 'listen' | 'presence' | 'situation';

export type DeskHint = {
  overdueSample?: Array<{ title?: string; assignee?: string }>;
  missingGroceries?: string[];
  overdueCount?: number;
};

export type OpeningDecision = {
  mode: OpeningMode;
  /** Sent as response.create instructions. Null means do not speak first. */
  instructions: string | null;
};

/** Do not situation-open more often than this. */
export const SITUATION_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export function situationLine(desk: DeskHint | null | undefined): string | null {
  const overdue = desk?.overdueSample?.[0];
  if (overdue?.title && overdue.assignee) {
    return `${overdue.assignee} still has ${overdue.title}. Want a reminder?`;
  }
  if (overdue?.title) {
    return `${overdue.title} is still open. Want a reminder?`;
  }
  const grocery = desk?.missingGroceries?.[0];
  if (grocery) {
    return `${grocery} is still missing. Want a reminder?`;
  }
  return null;
}

const PRESENCE_INSTRUCTIONS =
  'You are already with this household. One short presence line that you are here and listening. Do not introduce yourself. Do not say your name or role. Then listen.';

export function situationInstructions(line: string): string {
  return `Do not introduce yourself. Speak this situation in one short sentence, then listen: ${line}`;
}

export function decideOpening(input: {
  continuity?: IuiContinuity | null;
  householdId?: string | null;
  hasMetHousehold?: boolean;
  lastSituationAt?: number | null;
  desk?: DeskHint | null;
  userSpeaking?: boolean;
  now?: number;
}): OpeningDecision {
  const now = input.now ?? Date.now();
  const id = input.householdId?.trim();

  if (input.userSpeaking) {
    return { mode: 'listen', instructions: null };
  }
  if (hasOpenAct(input.continuity)) {
    return { mode: 'listen', instructions: null };
  }
  if (id && isContinuityFresh(input.continuity) && input.continuity?.householdId === id) {
    return { mode: 'listen', instructions: null };
  }

  const line = situationLine(input.desk);
  const cooled =
    !input.lastSituationAt || now - input.lastSituationAt >= SITUATION_COOLDOWN_MS;
  if (input.hasMetHousehold && line && cooled) {
    return { mode: 'situation', instructions: situationInstructions(line) };
  }

  if (!input.hasMetHousehold) {
    return { mode: 'presence', instructions: PRESENCE_INSTRUCTIONS };
  }

  return { mode: 'listen', instructions: null };
}

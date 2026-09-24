/**
 * WO15 §2 — Base utterance resolution without requiring the chat model for acts.
 */
import { hearAndDrive, isLocalHowTo } from '@/lib/poppins/aiuic';
import {
  confirmationForLocalWrite,
  findLocalWriteBeat,
} from '@/lib/poppins/local-act-confirm';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import type { HouseholdTask } from '@/types/orbit';

export type AskPoppinsFn = (question: string) => Promise<{
  answer?: string;
  error_code?: string | null;
  source?: string;
  actions?: { label: string }[];
  ui_actions?: unknown[];
}>;

export type BaseUtteranceResult = {
  tookLocal: boolean;
  answer: string;
  calledModel: boolean;
  localConfirm: string | null;
};

/**
 * Resolve a Base (Quiet) utterance.
 * Local grammar wins for acts; the model is only called when grammar misses.
 * If `ask` throws and a local confirm exists, the confirm is still returned.
 */
export async function resolveBaseUtterance(
  text: string,
  opts: {
    memberNames: string[];
    selfName?: string;
    existingTasks?: HouseholdTask[];
    kid?: boolean;
    ask: AskPoppinsFn;
  }
): Promise<BaseUtteranceResult> {
  const trimmed = text.trim();
  const tookLocal = hearAndDrive(trimmed, opts.memberNames, {
    kid: opts.kid,
    selfName: opts.selfName,
    existingTasks: opts.existingTasks,
  });
  const state = poppinsUiOrchestrator.getState();
  const localWrite = findLocalWriteBeat(state.playlist, state.index);
  const localConfirm = localWrite ? confirmationForLocalWrite(localWrite) : null;

  if (tookLocal && localConfirm) {
    return { tookLocal: true, answer: localConfirm, calledModel: false, localConfirm };
  }

  const liveBeat = state.playlist[state.index];
  if (tookLocal && (liveBeat?.scene === 'coach_steps' || isLocalHowTo(trimmed))) {
    const answer =
      liveBeat?.payload.coachLine ?? liveBeat?.payload.subtitle ?? 'Here is how.';
    return { tookLocal: true, answer, calledModel: false, localConfirm: null };
  }

  try {
    const result = await opts.ask(trimmed);
    const offline =
      Boolean(result.error_code) ||
      result.source === 'openai_error' ||
      /could not answer|is offline right now/i.test(result.answer ?? '');
    const answer =
      offline && localConfirm ? localConfirm : result.answer || localConfirm || '';
    return {
      tookLocal,
      answer,
      calledModel: !offline,
      localConfirm,
    };
  } catch {
    if (localConfirm) {
      return { tookLocal, answer: localConfirm, calledModel: false, localConfirm };
    }
    throw new Error('model_unavailable');
  }
}

/**
 * WO15 §2 — Base utterance resolution without requiring the chat model for acts.
 * Used by PoppinsScreen.submitUtterance — do not leave this as an unused twin.
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

export type BaseUtteranceKind = 'local_write' | 'coach' | 'model' | 'offline_local' | 'model_error';

export type BaseUtteranceResult = {
  tookLocal: boolean;
  answer: string;
  calledModel: boolean;
  localConfirm: string | null;
  kind: BaseUtteranceKind;
  /** Present when kind is `model` and the model returned UI actions. */
  actions?: { label: string }[];
  ui_actions?: unknown[];
  modelAnswer?: string;
  offline?: boolean;
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
    return {
      tookLocal: true,
      answer: localConfirm,
      calledModel: false,
      localConfirm,
      kind: 'local_write',
    };
  }

  const liveBeat = state.playlist[state.index];
  if (tookLocal && (liveBeat?.scene === 'coach_steps' || isLocalHowTo(trimmed))) {
    const answer =
      liveBeat?.payload.coachLine ?? liveBeat?.payload.subtitle ?? 'Here is how.';
    return {
      tookLocal: true,
      answer,
      calledModel: false,
      localConfirm: null,
      kind: 'coach',
    };
  }

  try {
    const result = await opts.ask(trimmed);
    const offline =
      Boolean(result.error_code) ||
      result.source === 'openai_error' ||
      /could not answer|is offline right now/i.test(result.answer ?? '');
    if (offline && (localConfirm || tookLocal)) {
      poppinsUiOrchestrator.flagModelOffline();
    }
    const answer =
      offline && localConfirm ? localConfirm : result.answer || localConfirm || '';
    return {
      tookLocal,
      answer,
      calledModel: !offline,
      localConfirm,
      kind: offline && localConfirm ? 'offline_local' : offline ? 'model_error' : 'model',
      actions: result.actions,
      ui_actions: result.ui_actions,
      modelAnswer: result.answer,
      offline,
    };
  } catch {
    if (localConfirm) {
      poppinsUiOrchestrator.flagModelOffline();
      return {
        tookLocal,
        answer: localConfirm,
        calledModel: false,
        localConfirm,
        kind: 'offline_local',
        offline: true,
      };
    }
    throw new Error('model_unavailable');
  }
}

/**
 * AIUIC (Artificial Intelligence Interface Control) — also called IUI / EUI.
 *
 * Universal UI, AI-controlled UX: Poppins/Nova owns a single overlay and
 * brings widgets up / takes them away. It does the act on the stage.
 * Coach-navigate only when the person asked to drive the full human screen.
 */

import { getAdHocTourHooks } from '@/lib/tour/ad-hoc-tour';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import {
  parseHouseMemoryUtterance,
  rememberActiveFact,
  type HouseFact,
  type HouseFactKind,
} from '@/lib/poppins/house-memory';
import { howToUiAction, matchHowTo } from '@/lib/poppins/how-to';
import { parseCompoundHouseholdIntent } from '@/lib/poppins/clause-segment';
import { rewriteAiuicActions, type HouseholdIntentOpts } from '@/lib/poppins/ui-intent';

export { rewriteAiuicActions } from '@/lib/poppins/ui-intent';

function persistMemoryActions(actions: Array<Record<string, unknown>>) {
  for (const action of actions) {
    if (String(action.type) !== 'remember_house_fact') continue;
    const kindRaw = String(action.kind ?? 'note');
    const kind: HouseFactKind =
      kindRaw === 'like' || kindRaw === 'dislike' || kindRaw === 'routine' || kindRaw === 'note'
        ? kindRaw
        : 'note';
    const text = String(action.text ?? '').trim();
    if (!text) continue;
    const fact: Omit<HouseFact, 'id' | 'updatedAt'> = {
      kind,
      subject: String(action.subject ?? 'house'),
      text,
      source: 'spoken',
    };
    void rememberActiveFact(fact);
  }
}

export function driveAiuic(
  actions: Array<Record<string, unknown>> | undefined,
  utterance: string,
  opts?: { kid?: boolean; replace?: boolean } & HouseholdIntentOpts
) {
  const next = rewriteAiuicActions(actions ?? [], utterance, {
    existingTasks: opts?.existingTasks,
    memberNames: opts?.memberNames,
    selfName: opts?.selfName,
  });
  persistMemoryActions(next);
  // memory_note paints on stage; persist already happened above.
  if (!next.length) return false;
  poppinsUiOrchestrator.drive(next, opts);
  return true;
}

/**
 * Genie loop: paint what was just said, then merge into the live beat.
 * Do not wait for Luna — local intent starts the stage; tools refine it.
 */
export function hearAndDrive(
  text: string,
  memberNames: string[] = [],
  opts?: {
    kid?: boolean;
    selfName?: string;
    /** Defence in depth — refuse assistant/echo turns even if AEC fails. */
    userOriginated?: boolean;
  } & HouseholdIntentOpts
) {
  if (opts?.userOriginated === false) return false;
  // Strip leading STT disfluency / echo residue before parsing.
  const cleaned = text
    .replace(/^(oh+|uh+|um+|ah+|hmm+|il will|i l will)\s+/i, '')
    .replace(/^(oh[, ]+)?i['’]?ll\s+/i, '')
    .trim();
  if (!cleaned) return false;

  // Ad-hoc coach tour: "do it for me" / "stop" — never re-ask the model.
  const adHoc = getAdHocTourHooks();
  if (adHoc?.isAdHocActive() && adHoc.handleSpeech(cleaned)) {
    poppinsUiOrchestrator.syncSpoken(cleaned, memberNames);
    return true;
  }

  // Local how-to match — paint coach_steps, never call the chat model.
  const howTo = matchHowTo(cleaned);
  if (howTo) {
    driveAiuic([howToUiAction(howTo, cleaned)], cleaned, {
      kid: opts?.kid,
      replace: true,
      existingTasks: opts?.existingTasks,
      memberNames,
      selfName: opts?.selfName,
    });
    poppinsUiOrchestrator.syncSpoken(cleaned, memberNames);
    return true;
  }

  const memory = parseHouseMemoryUtterance(cleaned);
  if (memory) void rememberActiveFact(memory);
  const steered = poppinsUiOrchestrator.applySpeech(cleaned, memberNames, { selfName: opts?.selfName });
  if (!steered) {
    const inferred = parseCompoundHouseholdIntent(cleaned, {
      memberNames,
      selfName: opts?.selfName,
      existingTasks: opts?.existingTasks,
    });
    if (inferred.length) {
      driveAiuic(inferred, cleaned, {
        kid: opts?.kid,
        replace: true,
        existingTasks: opts?.existingTasks,
        memberNames,
        selfName: opts?.selfName,
      });
    } else if (memory) {
      // Memory-only utterance — paint the note strip (fact already persisted).
      driveAiuic(
        [
          {
            type: 'remember_house_fact',
            kind: memory.kind,
            subject: memory.subject,
            text: memory.text,
          },
        ],
        cleaned,
        {
          kid: opts?.kid,
          replace: true,
          memberNames,
          selfName: opts?.selfName,
        }
      );
    }
  }
  poppinsUiOrchestrator.syncSpoken(cleaned, memberNames);
  return steered || poppinsUiOrchestrator.getState().live;
}

/** True when the utterance is teaching — callers must not ask the chat model. */
export function isLocalHowTo(text: string): boolean {
  return matchHowTo(text) != null;
}

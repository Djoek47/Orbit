/**
 * AIUIC (Artificial Intelligence Interface Control) — also called IUI / EUI.
 *
 * Universal UI, AI-controlled UX: Poppins/Nova owns a single overlay and
 * brings widgets up / takes them away. It does the act on the stage.
 * Coach-navigate only when the person asked to drive the full human screen.
 */

import { isRenameSpeech } from '@/lib/poppins/card-speech';
import { getAdHocTourHooks } from '@/lib/tour/ad-hoc-tour';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import {
  parseHouseMemoryUtterance,
  rememberActiveFact,
  type HouseFact,
  type HouseFactKind,
} from '@/lib/poppins/house-memory';
import { howToUiAction, isTeachingQuestion, matchHowTo } from '@/lib/poppins/how-to';
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

/**
 * Stage a plan. `source: 'model'` marks a plan from the chat/realtime model: for any act
 * family this turn already owns it only refines the live beat (see turn-ownership.ts).
 * Local plans (the grammar, coach "do it for me") omit it.
 */
export function driveAiuic(
  actions: Array<Record<string, unknown>> | undefined,
  utterance: string,
  opts?: { kid?: boolean; replace?: boolean; source?: 'local' | 'model' } & HouseholdIntentOpts
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

  const memory = parseHouseMemoryUtterance(cleaned);
  if (memory) void rememberActiveFact(memory);

  const liveBeatId = () => {
    const s = poppinsUiOrchestrator.getState();
    return s.live ? (s.playlist[s.index]?.id ?? null) : null;
  };
  const cardBefore = liveBeatId();
  /**
   * A sentence's names and dates belong on the card on screen only when the sentence was
   * about that card: a correction to it ("…to Mia"), a yes, or the card this sentence just
   * put there. A sentence that added a different act ("and walk the dog for Mia") keeps its
   * names to itself.
   */
  const finish = (steer: string | false, handled: boolean) => {
    const cardAfter = liveBeatId();
    const aboutCard =
      steer === 'revise' || steer === 'confirm' || (cardAfter != null && cardAfter !== cardBefore);
    // "Call it Big Wednesday" is a name — its words must not re-read as a day or a person.
    poppinsUiOrchestrator.syncSpoken(cleaned, memberNames, { patchCard: aboutCard && !isRenameSpeech(cleaned) });
    return handled || steer !== false || poppinsUiOrchestrator.getState().live;
  };

  // A how-question teaches — before the act grammar can read its verbs as a chore.
  if (isTeachingQuestion(cleaned)) {
    const lesson = matchHowTo(cleaned);
    if (lesson) {
      driveAiuic([howToUiAction(lesson, cleaned)], cleaned, {
        kid: opts?.kid,
        replace: true,
        existingTasks: opts?.existingTasks,
        memberNames,
        selfName: opts?.selfName,
      });
      return finish(false, true);
    }
    // No lesson for it: not an act either. The caller may ask the model for a written answer.
    return false;
  }

  const steer = poppinsUiOrchestrator.applySpeech(cleaned, memberNames, { selfName: opts?.selfName });
  if (!steer) {
    // WO16 §2.3 — act grammar before how-to so Pass A capabilities are not shadowed.
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
      return finish(false, true);
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
      return finish(false, true);
    }

    if (memory) {
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
  return finish(steer, false);
}

/** True when the utterance is teaching — callers must not ask the chat model. */
export function isLocalHowTo(text: string): boolean {
  return matchHowTo(text) != null;
}

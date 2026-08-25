/**
 * AIUIC (Artificial Intelligence Interface Control) — also called IUI / EUI.
 *
 * Universal UI, AI-controlled UX: Poppins/Nova owns a single overlay and
 * brings widgets up / takes them away. It does the act on the stage.
 * Coach-navigate only when the person asked to drive the full human screen.
 */

import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import {
  parseHouseMemoryUtterance,
  rememberActiveFact,
  type HouseFact,
  type HouseFactKind,
} from '@/lib/poppins/house-memory';
import { parseHouseholdIntent, rewriteAiuicActions } from '@/lib/poppins/ui-intent';

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
  opts?: { kid?: boolean; replace?: boolean }
) {
  const next = rewriteAiuicActions(actions ?? [], utterance);
  persistMemoryActions(next);
  const stage = next.filter((action) => String(action.type) !== 'remember_house_fact');
  if (!stage.length) return false;
  poppinsUiOrchestrator.drive(stage, opts);
  return true;
}

/**
 * Genie loop: paint what was just said, then merge into the live beat.
 * Do not wait for Luna — local intent starts the stage; tools refine it.
 */
export function hearAndDrive(
  text: string,
  memberNames: string[] = [],
  opts?: { kid?: boolean }
) {
  const memory = parseHouseMemoryUtterance(text);
  if (memory) void rememberActiveFact(memory);
  const steered = poppinsUiOrchestrator.applySpeech(text, memberNames);
  if (!steered) {
    const inferred = parseHouseholdIntent(text);
    if (inferred.length) driveAiuic(inferred, text, { kid: opts?.kid, replace: true });
  }
  poppinsUiOrchestrator.syncSpoken(text, memberNames);
  return steered || poppinsUiOrchestrator.getState().live;
}

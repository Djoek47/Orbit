/**
 * AIUIC (Artificial Intelligence Interface Control) — also called IUI / EUI.
 *
 * Universal UI, AI-controlled UX: Poppins/Nova owns a single overlay and
 * brings widgets up / takes them away. It does the act on the stage.
 * Coach-navigate only when the person asked to drive the full human screen.
 */

import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import { parseHouseholdIntent, rewriteAiuicActions } from '@/lib/poppins/ui-intent';

export { rewriteAiuicActions } from '@/lib/poppins/ui-intent';

export function driveAiuic(
  actions: Array<Record<string, unknown>> | undefined,
  utterance: string,
  opts?: { kid?: boolean; replace?: boolean }
) {
  const next = rewriteAiuicActions(actions ?? [], utterance);
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
  opts?: { kid?: boolean }
) {
  const steered = poppinsUiOrchestrator.applySpeech(text, memberNames);
  if (!steered) {
    const inferred = parseHouseholdIntent(text);
    if (inferred.length) driveAiuic(inferred, text, { kid: opts?.kid, replace: true });
  }
  poppinsUiOrchestrator.syncSpoken(text, memberNames);
  return steered || poppinsUiOrchestrator.getState().live;
}

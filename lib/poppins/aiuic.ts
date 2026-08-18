/**
 * AIUIC (Artificial Intelligence Interface Control) — also called IUI / EUI.
 *
 * Universal UI, AI-controlled UX: Poppins/Nova owns a single overlay and
 * brings widgets up / takes them away. It does the act on the stage.
 * Coach-navigate only when the person asked to drive the full human screen.
 */

import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import { rewriteAiuicActions } from '@/lib/poppins/ui-intent';

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

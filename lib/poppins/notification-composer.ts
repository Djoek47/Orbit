/**
 * Luna writer for inbox copy. Policy already decided send/merge; Luna only rewrites sentences.
 * If the edge is down, the policy card stays — never a spinner.
 */

import { useLivePoppinsAi } from '@/config/poppins-ai-mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { parseComposerJson, type ComposeDecision, type HouseholdFact } from '@/lib/poppins/notification-policy';

export const POPPINS_NOTIFY_SYSTEM = `You are Poppins, the calm household co-manager in Choremaxx.
Write ONE notification that contacts a person. Facts are already chosen; you only write the sentence.

Rules:
- Name the person. Report what happened. Do not counsel, praise, or tell anyone how to feel.
- No emoji. No exclamation marks. No internal jargon (mint, ledger, origin, EXAMPLE).
- Prefer one sentence. Summarize bursts instead of listing every XP tick.
- Never invent events that are not in the facts.
- Reply JSON only: {"title":"Poppins · …","body":"…","cta":"Open Rewards|Open Task|Ask Poppins|View"}`;

export { parseComposerJson } from '@/lib/poppins/notification-policy';

export async function composeWithLuna(
  facts: HouseholdFact[],
  fallback: ComposeDecision,
  context: { householdId: string; role?: string; unreadCount?: number }
): Promise<ComposeDecision> {
  if (!useLivePoppinsAi || !context.householdId) return fallback;
  const supabase = getSupabaseClient();
  if (!supabase) return fallback;

  try {
    const { data, error } = await supabase.functions.invoke('poppins-notify', {
      body: {
        householdId: context.householdId,
        facts,
        fallback,
        role: context.role,
        unreadCount: context.unreadCount,
      },
    });
    if (error || !data) return fallback;
    return parseComposerJson(data, fallback);
  } catch {
    return fallback;
  }
}

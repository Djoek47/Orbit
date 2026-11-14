/**
 * The Poppins orb's real level for the trips surfaces — same inputs as the Poppins tab
 * (use-poppins-controller): act events → summarizeActUsage → personalActTokens /
 * allowanceFraction. Returns undefined fields until usage is known, so PoppinsOrb keeps
 * its own default.
 */
import { useEffect, useMemo, useState } from 'react';

import { TOKENS_PER_DAY } from '@/constants/poppins-ai-rates';
import { personalActTokens, summarizeActUsage } from '@/lib/ai/act-events';
import { allowanceFraction, currentMonthlyAllowance } from '@/lib/billing/allowance-state';
import { subscribeTokenGrants } from '@/lib/billing/token-grants';
import { clamp01 } from '@/lib/poppins/orb-levels';
import { useOrbit } from '@/store/orbit-store';

export function useTripOrbLevel(): { dailyFill?: number; monthGlow?: number } {
  const { household, currentMember, permissions, actEvents } = useOrbit();
  const [topUpBalance, setTopUpBalance] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { loadTokenGrants, topUpBalanceFromGrants } = await import('@/lib/billing/token-grants');
        const grants = await loadTokenGrants(household.id);
        if (!cancelled) setTopUpBalance(topUpBalanceFromGrants(grants));
      } catch {
        // keep 0
      }
    })();
    const unsubscribe = subscribeTokenGrants((id, balance) => {
      if (!cancelled && id === household.id) setTopUpBalance(balance);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [household.id]);

  return useMemo(() => {
    if (!actEvents || TOKENS_PER_DAY <= 0) return {};
    const summary = summarizeActUsage(
      actEvents,
      household.members.map((member) => ({ id: member.id, name: member.name })),
      { topUpBalance }
    );
    const dailyFill = clamp01((TOKENS_PER_DAY - personalActTokens(summary, currentMember?.id)) / TOKENS_PER_DAY);
    const monthGlow = permissions.canManageHousehold
      ? currentMonthlyAllowance() > 0
        ? 1 - allowanceFraction(summary.tokensUsedThisPeriod)
        : summary.topUpBalance > 0
          ? 1
          : 0
      : dailyFill;
    return { dailyFill, monthGlow };
  }, [actEvents, household.members, topUpBalance, currentMember?.id, permissions.canManageHousehold]);
}

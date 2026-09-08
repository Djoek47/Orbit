/**
 * Household capability flags for Sidekick edge enforcement.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type HouseholdSettings = {
  sidekickGroceryAdd: boolean;
  memberCapabilities: {
    allowRewardRedeem: boolean;
    allowSpecialRewardRequest: boolean;
    allowAllowance: boolean;
    allowGroceryAdd: boolean;
    allowCalendarCreate: boolean;
    requireSidekickEventApproval: boolean;
  };
};

const DEFAULT_CAPS = {
  allowRewardRedeem: true,
  allowSpecialRewardRequest: false,
  allowAllowance: true,
  allowGroceryAdd: false,
  allowCalendarCreate: false,
  requireSidekickEventApproval: true,
};

export async function loadHouseholdSettings(
  admin: SupabaseClient,
  householdId: string
): Promise<HouseholdSettings | null> {
  const { data, error } = await admin
    .from('households')
    .select('sidekick_grocery_add, member_capabilities')
    .eq('id', householdId)
    .maybeSingle();

  if (error || !data) return null;

  const raw = (data.member_capabilities ?? {}) as Record<string, boolean>;
  return {
    sidekickGroceryAdd: Boolean(data.sidekick_grocery_add),
    memberCapabilities: {
      ...DEFAULT_CAPS,
      ...raw,
    },
  };
}

export function assertCapability(
  settings: HouseholdSettings,
  key: keyof HouseholdSettings['memberCapabilities']
): Response | null {
  if (settings.memberCapabilities[key]) return null;
  return new Response(JSON.stringify({ error: `capability_disabled:${key}` }), {
    status: 403,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

/** Server-side event approval — mirrors client resolveEventApprovalStatus. */
export function resolveSidekickEventApproval(
  settings: HouseholdSettings,
  category: string
): 'pending' | 'approved' {
  if (!settings.memberCapabilities.requireSidekickEventApproval) return 'approved';
  const normalized = category.toLowerCase();
  if (
    normalized === 'school' ||
    normalized === 'activity' ||
    normalized === 'appointment' ||
    normalized === 'family'
  ) {
    return 'pending';
  }
  return 'approved';
}

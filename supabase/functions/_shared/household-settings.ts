/**
 * Household capability flags for Sidekick edge enforcement.
 * Supports household defaults plus optional per-member overrides in
 * `member_capabilities.byMemberId`.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type MemberCapabilityFlags = {
  allowRewardRedeem: boolean;
  allowSpecialRewardRequest: boolean;
  allowAllowance: boolean;
  allowGroceryAdd: boolean;
  allowCalendarCreate: boolean;
  requireSidekickEventApproval: boolean;
};

export type HouseholdSettings = {
  sidekickGroceryAdd: boolean;
  sidekickPoppinsAi: boolean;
  memberCapabilities: MemberCapabilityFlags;
  byMemberId: Record<string, Partial<MemberCapabilityFlags>>;
};

const DEFAULT_CAPS: MemberCapabilityFlags = {
  allowRewardRedeem: true,
  allowSpecialRewardRequest: false,
  allowAllowance: true,
  allowGroceryAdd: false,
  allowCalendarCreate: false,
  requireSidekickEventApproval: true,
};

const FLAG_KEYS = Object.keys(DEFAULT_CAPS) as (keyof MemberCapabilityFlags)[];

function pickFlags(raw: Record<string, unknown> | null | undefined): Partial<MemberCapabilityFlags> {
  if (!raw) return {};
  const out: Partial<MemberCapabilityFlags> = {};
  for (const key of FLAG_KEYS) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key] as boolean;
  }
  return out;
}

function readOverrides(
  raw: Record<string, unknown> | null | undefined
): Record<string, Partial<MemberCapabilityFlags>> {
  const map = raw?.byMemberId;
  if (!map || typeof map !== 'object') return {};
  const out: Record<string, Partial<MemberCapabilityFlags>> = {};
  for (const [memberId, patch] of Object.entries(map as Record<string, unknown>)) {
    if (!memberId || !patch || typeof patch !== 'object') continue;
    out[memberId] = pickFlags(patch as Record<string, unknown>);
  }
  return out;
}

export async function loadHouseholdSettings(
  admin: SupabaseClient,
  householdId: string
): Promise<HouseholdSettings | null> {
  const { data, error } = await admin
    .from('households')
    .select('sidekick_grocery_add, sidekick_poppins_ai, member_capabilities')
    .eq('id', householdId)
    .maybeSingle();

  if (error || !data) return null;

  const raw = (data.member_capabilities ?? {}) as Record<string, unknown>;
  const flags = pickFlags(raw);
  const sidekickGroceryAdd = Boolean(data.sidekick_grocery_add);
  return {
    sidekickGroceryAdd,
    sidekickPoppinsAi: Boolean(data.sidekick_poppins_ai),
    memberCapabilities: {
      ...DEFAULT_CAPS,
      ...flags,
      allowGroceryAdd: sidekickGroceryAdd || flags.allowGroceryAdd === true,
    },
    byMemberId: readOverrides(raw),
  };
}

export function resolveMemberCapability(
  settings: HouseholdSettings,
  memberId: string | null | undefined,
  key: keyof MemberCapabilityFlags
): boolean {
  if (memberId) {
    const override = settings.byMemberId[memberId]?.[key];
    if (typeof override === 'boolean') return override;
  }
  if (key === 'allowGroceryAdd') {
    return settings.sidekickGroceryAdd || settings.memberCapabilities.allowGroceryAdd;
  }
  return settings.memberCapabilities[key];
}

export function assertCapability(
  settings: HouseholdSettings,
  key: keyof MemberCapabilityFlags,
  memberId?: string | null
): Response | null {
  if (resolveMemberCapability(settings, memberId, key)) return null;
  return new Response(JSON.stringify({ error: `capability_disabled:${key}` }), {
    status: 403,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

/** Server-side event approval — mirrors client resolveEventApprovalStatus. */
export function resolveSidekickEventApproval(
  settings: HouseholdSettings,
  category: string,
  memberId?: string | null
): 'pending' | 'approved' {
  if (!resolveMemberCapability(settings, memberId, 'requireSidekickEventApproval')) {
    return 'approved';
  }
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

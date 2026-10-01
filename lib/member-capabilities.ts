import type { HouseholdSnapshot, MemberCapabilities } from '@/types/orbit';

export type { MemberCapabilities };

/** Household defaults + optional per-Sidekick overrides (stored inside member_capabilities JSON). */
export type MemberCapabilitiesDocument = MemberCapabilities & {
  byMemberId?: Record<string, Partial<MemberCapabilities>>;
};

export const DEFAULT_MEMBER_CAPABILITIES: MemberCapabilities = {
  allowRewardRedeem: true,
  allowSpecialRewardRequest: false,
  allowAllowance: true,
  allowGroceryAdd: false,
  allowCalendarCreate: false,
  requireSidekickEventApproval: true,
};

const FLAG_KEYS: (keyof MemberCapabilities)[] = [
  'allowRewardRedeem',
  'allowSpecialRewardRequest',
  'allowAllowance',
  'allowGroceryAdd',
  'allowCalendarCreate',
  'requireSidekickEventApproval',
];

/** Pull only boolean capability flags — ignore `byMemberId` and junk keys. */
export function pickCapabilityFlags(
  raw: Partial<MemberCapabilitiesDocument> | null | undefined
): Partial<MemberCapabilities> {
  if (!raw) return {};
  const out: Partial<MemberCapabilities> = {};
  for (const key of FLAG_KEYS) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key];
  }
  return out;
}

export function readCapabilityOverrides(
  raw: Partial<MemberCapabilitiesDocument> | null | undefined
): Record<string, Partial<MemberCapabilities>> {
  const map = raw?.byMemberId;
  if (!map || typeof map !== 'object') return {};
  const out: Record<string, Partial<MemberCapabilities>> = {};
  for (const [memberId, patch] of Object.entries(map)) {
    if (!memberId || !patch || typeof patch !== 'object') continue;
    out[memberId] = pickCapabilityFlags(patch);
  }
  return out;
}

/** Household-wide defaults (Everyone scope). Grocery mirrors `sidekickGroceryAdd` when set. */
export function resolveMemberCapabilities(
  household: Pick<HouseholdSnapshot, 'memberCapabilities' | 'sidekickGroceryAdd'> | null | undefined
): MemberCapabilities {
  const flags = pickCapabilityFlags(household?.memberCapabilities);
  const grocery =
    household?.sidekickGroceryAdd != null
      ? household.sidekickGroceryAdd === true
      : flags.allowGroceryAdd === true;
  return {
    ...DEFAULT_MEMBER_CAPABILITIES,
    ...flags,
    allowGroceryAdd: grocery,
  };
}

/**
 * Effective permissions for one Sidekick.
 * Per-member override wins when set; otherwise household defaults
 * (`sidekickGroceryAdd` for grocery).
 */
export function resolveCapabilitiesForMember(
  household: Pick<HouseholdSnapshot, 'memberCapabilities' | 'sidekickGroceryAdd'> | null | undefined,
  memberId: string | null | undefined
): MemberCapabilities {
  const base = resolveMemberCapabilities(household);
  if (!memberId) return base;
  const override = readCapabilityOverrides(household?.memberCapabilities)[memberId];
  if (!override || Object.keys(override).length === 0) return base;
  return {
    ...base,
    ...override,
    allowGroceryAdd:
      typeof override.allowGroceryAdd === 'boolean'
        ? override.allowGroceryAdd
        : base.allowGroceryAdd,
  };
}

/** Build the JSON document to persist (flags + overrides). */
export function buildCapabilitiesDocument(
  flags: MemberCapabilities,
  byMemberId: Record<string, Partial<MemberCapabilities>>
): MemberCapabilitiesDocument {
  const cleaned: Record<string, Partial<MemberCapabilities>> = {};
  for (const [id, patch] of Object.entries(byMemberId)) {
    const picked = pickCapabilityFlags(patch);
    if (Object.keys(picked).length > 0) cleaned[id] = picked;
  }
  return {
    ...pickCapabilityFlags(flags),
    allowRewardRedeem: flags.allowRewardRedeem,
    allowSpecialRewardRequest: flags.allowSpecialRewardRequest,
    allowAllowance: flags.allowAllowance,
    allowGroceryAdd: flags.allowGroceryAdd,
    allowCalendarCreate: flags.allowCalendarCreate,
    requireSidekickEventApproval: flags.requireSidekickEventApproval,
    ...(Object.keys(cleaned).length > 0 ? { byMemberId: cleaned } : {}),
  } as MemberCapabilitiesDocument;
}

/** True when this Sidekick may add grocery items. */
export function memberMayAddGrocery(
  household: Pick<HouseholdSnapshot, 'memberCapabilities' | 'sidekickGroceryAdd'> | null | undefined,
  memberId: string | null | undefined
): boolean {
  return resolveCapabilitiesForMember(household, memberId).allowGroceryAdd;
}

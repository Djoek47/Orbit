import type { HouseholdSnapshot, MemberCapabilities } from '@/types/orbit';

export type { MemberCapabilities };

export const DEFAULT_MEMBER_CAPABILITIES: MemberCapabilities = {
  allowRewardRedeem: true,
  allowSpecialRewardRequest: false,
  allowAllowance: true,
  allowGroceryAdd: false,
  allowCalendarCreate: false,
};

export function resolveMemberCapabilities(
  household: Pick<HouseholdSnapshot, 'memberCapabilities'> | null | undefined,
): MemberCapabilities {
  return {
    ...DEFAULT_MEMBER_CAPABILITIES,
    ...(household?.memberCapabilities ?? {}),
  };
}

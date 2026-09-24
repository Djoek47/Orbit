/**
 * WO14 §7 — merge duplicate grocery permission sources.
 * Screen of truth: Sidekick permissions → `sidekickGroceryAdd`.
 * Legacy: `memberCapabilities.allowGroceryAdd`.
 *
 * If both were ever set and disagree → permissive (OR).
 * Otherwise take Sidekick permissions (`sidekickGroceryAdd`).
 */
import type { HouseholdSnapshot, MemberCapabilities } from '@/types/orbit';

export type GroceryPermissionSources = {
  sidekickGroceryAdd?: boolean | null;
  allowGroceryAdd?: boolean | null;
  /** True when allowGroceryAdd was explicitly present on the household (not just defaulted). */
  allowGroceryAddWasSet?: boolean;
  /** True when sidekickGroceryAdd was explicitly present. */
  sidekickGroceryAddWasSet?: boolean;
};

export function mergeGroceryPermission(sources: GroceryPermissionSources): boolean {
  const sidekickSet = sources.sidekickGroceryAddWasSet ?? sources.sidekickGroceryAdd != null;
  const capsSet = sources.allowGroceryAddWasSet ?? sources.allowGroceryAdd != null;
  const sidekick = sources.sidekickGroceryAdd === true;
  const caps = sources.allowGroceryAdd === true;

  if (sidekickSet && capsSet && sidekick !== caps) {
    return sidekick || caps;
  }
  if (sidekickSet) return sidekick;
  if (capsSet) return caps;
  return sidekick;
}

/** Apply merge onto a household snapshot (syncs both fields to the merged value).
 * After WO14 the Sidekick-permissions screen owns `sidekickGroceryAdd` — do not
 * re-OR it with legacy caps on every Settings mount (audit WO14 P2).
 */
export function applyGroceryPermissionMerge(
  household: Pick<HouseholdSnapshot, 'sidekickGroceryAdd' | 'memberCapabilities'>
): { sidekickGroceryAdd: boolean; memberCapabilities: MemberCapabilities | undefined } {
  const caps = household.memberCapabilities;
  const sidekick = household.sidekickGroceryAdd === true;
  return {
    sidekickGroceryAdd: sidekick,
    memberCapabilities: caps
      ? { ...caps, allowGroceryAdd: sidekick }
      : undefined,
  };
}

/** TestFlight / release gates — set via EAS env. */
export function isHouseholdSwitchDisabled(): boolean {
  return process.env.EXPO_PUBLIC_DISABLE_HOUSEHOLD_SWITCH === '1';
}

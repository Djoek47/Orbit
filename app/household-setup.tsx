import { Redirect } from 'expo-router';

/** Household setup is part of the unified welcome onboarding flow. */
export default function HouseholdSetupRedirect() {
  return <Redirect href="/welcome" />;
}

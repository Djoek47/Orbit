import { Redirect } from 'expo-router';

/** Legacy route — fused into the single welcome onboarding flow. */
export default function OnboardingRedirect() {
  return <Redirect href="/welcome" />;
}

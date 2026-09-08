import { Redirect } from 'expo-router';

/** Account creation lives in the unified welcome onboarding flow. */
export default function SignUpRedirect() {
  return <Redirect href="/welcome" />;
}

import { Redirect } from 'expo-router';

/** Profile setup is part of the unified welcome onboarding flow. */
export default function CreateProfileRedirect() {
  return <Redirect href="/welcome" />;
}

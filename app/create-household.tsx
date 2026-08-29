import { Redirect } from 'expo-router';

/** Legacy route — unified onboarding lives on /welcome. */
export default function CreateHouseholdScreen() {
  return <Redirect href="/welcome" />;
}

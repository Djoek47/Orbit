import { Redirect } from 'expo-router';

import { useOrbit } from '@/store/orbit-store';

/** Soft splash / entry: route into the right first screen. */
export default function SplashEntry() {
  const { isLoading, isSignedIn, hasHousehold } = useOrbit();

  if (isLoading) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/welcome" />;
  }

  if (!hasHousehold) {
    return <Redirect href="/household-setup" />;
  }

  return <Redirect href="/(tabs)" />;
}

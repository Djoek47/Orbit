import { Redirect } from 'expo-router';

import { useOrbit } from '@/store/orbit-store';

/** Soft splash / entry: route into the right first screen. */
export default function SplashEntry() {
  const { isLoading, isSignedIn, hasHousehold, isPendingMember } = useOrbit();

  if (isLoading) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/welcome" />;
  }

  if (!hasHousehold) {
    return <Redirect href="/welcome" />;
  }

  if (isPendingMember) {
    return <Redirect href="/pending-approval" />;
  }

  return <Redirect href="/(tabs)" />;
}

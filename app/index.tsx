import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { loadDeviceSession } from '@/lib/device/device-session';
import { useOrbit } from '@/store/orbit-store';

/** Soft splash / entry: route into the right first screen. */
export default function SplashEntry() {
  const { isLoading, isSignedIn, hasHousehold, isPendingMember } = useOrbit();
  const [needsPick, setNeedsPick] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    loadDeviceSession().then((session) => {
      if (!mounted) return;
      const shouldPick =
        session.mode === 'shared' &&
        session.needsProfilePick &&
        session.profileMemberIds.length > 0;
      setNeedsPick(shouldPick);
    });
    return () => {
      mounted = false;
    };
  }, [isSignedIn, hasHousehold]);

  if (isLoading || needsPick === null) {
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

  if (needsPick) {
    return <Redirect href="/select-profile" />;
  }

  return <Redirect href="/(tabs)" />;
}

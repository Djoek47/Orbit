import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { loadDeviceSession } from '@/lib/device/device-session';
import { peekInviteCode } from '@/lib/invite/invite-code-store';
import {
  classifyInviteCode,
  inviteHref,
  nextInviteDestination,
} from '@/lib/invites/invite-intent';
import { useOrbit } from '@/store/orbit-store';

/** Soft splash / entry: route into the right first screen. */
export default function SplashEntry() {
  const { isLoading, isSignedIn, hasHousehold, isPendingMember } = useOrbit();
  const [needsPick, setNeedsPick] = useState<boolean | null>(null);
  const [inviteRoute, setInviteRoute] = useState<string | null | undefined>(undefined);

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

  useEffect(() => {
    let mounted = true;
    peekInviteCode()
      .then((code) => {
        if (!mounted) return;
        if (!code) {
          setInviteRoute(null);
          return;
        }
        const kind = classifyInviteCode(code) ?? 'household';
        const dest = nextInviteDestination(kind, {
          isSignedIn,
          isPendingMember,
          hasHousehold,
        });
        setInviteRoute(inviteHref(dest, code));
      })
      .catch(() => {
        if (mounted) setInviteRoute(null);
      });
    return () => {
      mounted = false;
    };
  }, [hasHousehold, isPendingMember, isSignedIn]);

  if (isLoading || needsPick === null || inviteRoute === undefined) {
    return null;
  }

  if (isPendingMember) {
    return <Redirect href="/pending-approval" />;
  }

  if (inviteRoute) {
    return <Redirect href={inviteRoute as never} />;
  }

  if (!isSignedIn) {
    return <Redirect href="/welcome" />;
  }

  if (!hasHousehold) {
    return <Redirect href="/welcome" />;
  }

  if (needsPick) {
    return <Redirect href="/select-profile" />;
  }

  return <Redirect href="/(tabs)" />;
}

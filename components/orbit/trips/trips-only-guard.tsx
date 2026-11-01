import { Redirect } from 'expo-router';
import type { ComponentType } from 'react';

import { isSharedDeviceAccount } from '@/lib/household/shared-device';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import { useOrbit } from '@/store/orbit-store';

/**
 * Smart Trips, itineraries and My Places are for the adults running the house. Sidekicks and
 * shared devices never get them — a link, a notification or the tour can't open them either.
 */
export function useTripsAllowed(): boolean {
  const { currentMember, household } = useOrbit();
  return !isSidekickRole(currentMember?.role) && !isSharedDeviceAccount(currentMember, household.members);
}

export function tripsOnly<P extends object>(Screen: ComponentType<P>) {
  return function TripsOnly(props: P) {
    const allowed = useTripsAllowed();
    if (!allowed) return <Redirect href={'/(tabs)/plan' as never} />;
    return <Screen {...props} />;
  };
}

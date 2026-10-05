import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  isSharedTabletDeviceSession,
  reconcileHostedDeviceSession,
  type DeviceSession,
} from '@/lib/device/device-session';
import { tabFifthSlot, type TabFifthSlot } from '@/lib/navigation/tab-fifth-slot';
import type { HouseholdMember } from '@/types/orbit';

export function useTabFifthSlot(input: {
  role: HouseholdMember['role'] | undefined | null;
  members: HouseholdMember[];
  memberId?: string | null;
}): TabFifthSlot {
  const [session, setSession] = useState<DeviceSession | null>(null);

  const rosterKey = input.members
    .filter((m) => m.role === 'shared-device')
    .map((m) => `${m.id}:${(m.sharedWithMemberIds ?? []).join(',')}`)
    .join('|');

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void reconcileHostedDeviceSession(input.members).then((next) => {
        if (mounted) setSession(next);
      });
    };
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      mounted = false;
      sub.remove();
    };
    // members array identity churns; rosterKey captures shared-tablet links.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.memberId, rosterKey]);

  return tabFifthSlot({
    ...input,
    sharedTabletSession: isSharedTabletDeviceSession(session),
  });
}

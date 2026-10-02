import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  isSharedTabletDeviceSession,
  loadDeviceSession,
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

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void loadDeviceSession().then((next) => {
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
  }, [input.memberId]);

  return tabFifthSlot({
    ...input,
    sharedTabletSession: isSharedTabletDeviceSession(session),
  });
}

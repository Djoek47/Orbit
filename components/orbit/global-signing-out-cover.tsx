/**
 * Root-level Signing out cover — survives Settings modal unmount during leave.
 */
import { useEffect, useState } from 'react';

import { SigningOutOverlay } from '@/components/orbit/signing-out-overlay';
import {
  isSignOutInFlight,
  subscribeSignOutInFlight,
} from '@/lib/auth/sign-out-and-leave';

export function GlobalSigningOutCover() {
  const [visible, setVisible] = useState(() => isSignOutInFlight());

  useEffect(() => {
    setVisible(isSignOutInFlight());
    return subscribeSignOutInFlight(() => {
      setVisible(isSignOutInFlight());
    });
  }, []);

  return <SigningOutOverlay visible={visible} />;
}

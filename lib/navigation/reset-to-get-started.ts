import { router } from 'expo-router';

import {
  scheduleSignedOutRestart,
  type RestartNav,
} from '@/lib/navigation/session-restart';
import { teardownAllPoppinsVoice } from '@/lib/voice/poppins-voice-session';

export {
  cancelSignedOutRestart,
  restartSignedOutSession,
  SESSION_RESTART_ROUTE,
  SESSION_NAV_DELAY_MS,
  SESSION_REMOUNT_DELAY_MS,
} from '@/lib/navigation/session-restart';

function expoRestartNav(): RestartNav {
  return {
    canDismiss: () => {
      try {
        return Boolean(router.canDismiss());
      } catch {
        return false;
      }
    },
    dismissAll: () => {
      router.dismissAll();
    },
    replace: (href) => {
      router.replace(href);
    },
  };
}

export function resetToGetStarted(_navigation?: unknown): void {
  try {
    teardownAllPoppinsVoice();
  } catch {
    /* voice already down */
  }
  scheduleSignedOutRestart(expoRestartNav());
}

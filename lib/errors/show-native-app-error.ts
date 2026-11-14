/**
 * Error → Support feedback when a native Alert is required (Settings / Credits
 * under Expo presentation:modal). Same record + Send feedback loop as
 * showAppError / orbitAlert, without nesting an RN Modal.
 */
import { Alert } from 'react-native';
import { router } from 'expo-router';

import type { ErrorCategory } from '@/lib/errors/error-category';
import { recordAppError } from '@/lib/errors/error-log';
import { friendlyErrorMessage } from '@/lib/errors/friendly-error';
import { formatUnknownError } from '@/lib/errors/unknown-error';
import { SESSION_NAV_DELAY_MS } from '@/lib/navigation/session-restart';

export async function showNativeAppError(
  title: string,
  error: unknown,
  options?: {
    source?: string;
    category?: ErrorCategory;
    /** Skip feedback UI for user-cancelled purchases, etc. */
    silent?: boolean;
  }
): Promise<void> {
  if (options?.silent) return;

  const raw = formatUnknownError(error, title);
  const friendly = friendlyErrorMessage(raw);
  const entry = await recordAppError({
    title,
    message: raw,
    source: options?.source ?? 'native-alert',
    category: options?.category,
  });

  Alert.alert(title, friendly, [
    { text: 'Not now', style: 'cancel' },
    {
      text: 'Send feedback',
      onPress: () => {
        // Let the system alert finish dismissing before navigating.
        setTimeout(() => {
          try {
            router.push(`/support?errorId=${encodeURIComponent(entry.id)}` as never);
          } catch (navError) {
            console.warn('showNativeAppError.nav', navError);
          }
        }, SESSION_NAV_DELAY_MS);
      },
    },
  ]);
}

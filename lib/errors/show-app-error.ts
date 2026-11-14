/**
 * Preferred entry for recoverable failures — records, friendly copy, Send feedback.
 */
import { router } from 'expo-router';

import { orbitAlert } from '@/components/orbit/orbit-alert';
import type { ErrorCategory } from '@/lib/errors/error-category';
import { recordAppError } from '@/lib/errors/error-log';

export async function showAppError(
  title: string,
  message?: string,
  options?: {
    source?: string;
    category?: ErrorCategory;
    /** Extra buttons before Not now / Send feedback. */
    extraButtons?: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[];
  }
): Promise<void> {
  const entry = await recordAppError({
    title,
    message: message?.trim() || title,
    source: options?.source ?? 'showAppError',
    category: options?.category,
  });

  orbitAlert(
    title,
    message,
    [
      ...(options?.extraButtons ?? []),
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Send feedback',
        onPress: () => {
          router.push(`/support?errorId=${encodeURIComponent(entry.id)}` as never);
        },
      },
    ],
    { record: false, source: options?.source, category: options?.category }
  );
}

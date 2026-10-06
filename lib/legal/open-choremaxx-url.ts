/**
 * Open Choremaxx legal URLs in an in-app browser (Safari VC on iOS).
 * Callers that just closed an RN Modal must wait until Modal.onDismiss
 * (or ~SESSION_NAV_DELAY_MS) before invoking this — opening a browser during
 * Modal dismiss locks touch on iOS (same class as nesting orbitAlert).
 */
import { Linking, Platform } from 'react-native';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';

import { orbitAlert } from '@/components/orbit/orbit-alert';

export async function openChoremaxxUrl(url: string, label: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) {
    orbitAlert(
      `${label} unavailable`,
      'This link is missing. Use Support in Settings instead.',
      undefined,
      { source: 'legal-url', category: 'network' }
    );
    return;
  }

  try {
    if (trimmed.startsWith('mailto:') || Platform.OS === 'web') {
      const can = await Linking.canOpenURL(trimmed);
      if (!can && Platform.OS !== 'web') {
        throw new Error('cannot open mailto');
      }
      await Linking.openURL(trimmed);
      return;
    }

    await openBrowserAsync(trimmed, {
      presentationStyle: WebBrowserPresentationStyle.FULL_SCREEN,
      enableBarCollapsing: true,
      showTitle: true,
      createTask: false,
    });
    return;
  } catch {
    /* try system browser before alerting */
  }

  try {
    await Linking.openURL(trimmed);
    return;
  } catch {
    /* fall through */
  }

  // Deferred-safe: callers already closed any parent Modal.
  orbitAlert(
    `${label} unavailable`,
    'We could not open the Choremaxx website. Check your connection and try again, or use Support in Settings.',
    undefined,
    { source: 'legal-url', category: 'network' }
  );
}

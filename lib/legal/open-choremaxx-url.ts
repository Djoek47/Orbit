/**
 * Open Choremaxx legal URLs in the system browser.
 * Prefer Linking.openURL (Safari / Chrome) — matches “Policies open in your browser”
 * and survives Modal dismiss better than nesting SFSafariViewController.
 *
 * Callers that just closed an RN Modal must wait until Modal.onDismiss
 * (or ~LEGAL_OPEN_DELAY_MS) before invoking this.
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

  // System browser first — reliable after Settings / sheet dismiss on iOS.
  try {
    if (Platform.OS !== 'web') {
      const can = await Linking.canOpenURL(trimmed);
      if (can === false && trimmed.startsWith('mailto:')) {
        throw new Error('cannot open mailto');
      }
    }
    await Linking.openURL(trimmed);
    return;
  } catch {
    /* fall through to in-app browser */
  }

  if (!trimmed.startsWith('mailto:') && Platform.OS !== 'web') {
    try {
      await openBrowserAsync(trimmed, {
        presentationStyle: WebBrowserPresentationStyle.FULL_SCREEN,
        enableBarCollapsing: true,
        showTitle: true,
        createTask: false,
      });
      return;
    } catch {
      /* fall through */
    }
  }

  orbitAlert(
    `${label} unavailable`,
    'We could not open the Choremaxx website. Check your connection and try again, or use Support in Settings.',
    undefined,
    { source: 'legal-url', category: 'network' }
  );
}

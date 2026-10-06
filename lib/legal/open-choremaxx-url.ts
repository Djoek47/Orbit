/**
 * Open Choremaxx legal URLs in an in-app browser (Safari VC on iOS).
 * Surfaces a calm error when the site is down — yesterday's outage looked like a dead tap.
 */
import { Alert, Linking, Platform } from 'react-native';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';

export async function openChoremaxxUrl(url: string, label: string): Promise<void> {
  try {
    if (url.startsWith('mailto:') || Platform.OS === 'web') {
      await Linking.openURL(url);
      return;
    }
    const result = await openBrowserAsync(url, {
      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
      enableBarCollapsing: true,
    });
    if (result.type === 'cancel' || result.type === 'dismiss') return;
  } catch {
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* fall through */
    }
    Alert.alert(
      `${label} unavailable`,
      'We could not open the Choremaxx website. Check your connection and try again, or use Support in Settings.'
    );
  }
}

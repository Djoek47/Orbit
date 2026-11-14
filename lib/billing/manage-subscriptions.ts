/**
 * Apple's own manage-subscription sheet — the only place a subscription can be cancelled,
 * have renewal turned off, or switch plan. An app cannot cancel one itself.
 */
import { Linking } from 'react-native';

import { isNativeIapAvailable } from '@/lib/billing/iap';
import { formatUnknownError } from '@/lib/errors/unknown-error';

export const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

/**
 * Opens the sheet in the app (iOS 15+), falling back to the App Store's subscriptions page.
 * Resolves once the sheet closes, so the caller can re-read the status.
 */
export async function openManageSubscriptions(): Promise<void> {
  if (isNativeIapAvailable()) {
    try {
      const iap = await import('expo-iap');
      await iap.initConnection();
      await iap.showManageSubscriptionsIOS();
      return;
    } catch (error) {
      console.warn('showManageSubscriptionsIOS', formatUnknownError(error, 'sheet failed'));
    }
  }
  await Linking.openURL(MANAGE_SUBSCRIPTIONS_URL);
}

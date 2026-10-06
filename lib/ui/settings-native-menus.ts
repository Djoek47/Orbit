/**
 * Native menus for Settings (Expo Router modal).
 *
 * Never use orbitAlert (RN Modal) from Settings — nesting a Modal over
 * presentation: 'modal' can fail to present and leave an invisible touch
 * blocker after dismiss on iOS.
 */
import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';

import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';

function openUrl(url: string): void {
  void Linking.openURL(url).catch(() => undefined);
}

/** Privacy / Terms / Support — system action sheet or Alert, never orbitAlert. */
export function showPrivacyLegalMenu(): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Privacy & legal',
        message: 'Open Choremaxx legal pages',
        options: ['Privacy Policy', 'Terms of Service', 'Contact support', 'Cancel'],
        cancelButtonIndex: 3,
      },
      (index) => {
        if (index === 0) openUrl(CHOREMAXX_LEGAL.privacyUrl);
        else if (index === 1) openUrl(CHOREMAXX_LEGAL.termsUrl);
        else if (index === 2) openUrl(`mailto:${CHOREMAXX_LEGAL.supportEmail}`);
      }
    );
    return;
  }

  Alert.alert('Privacy & legal', 'Open Choremaxx legal pages', [
    { text: 'Privacy Policy', onPress: () => openUrl(CHOREMAXX_LEGAL.privacyUrl) },
    { text: 'Terms of Service', onPress: () => openUrl(CHOREMAXX_LEGAL.termsUrl) },
    {
      text: 'Contact support',
      onPress: () => openUrl(`mailto:${CHOREMAXX_LEGAL.supportEmail}`),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

/** Destructive leave confirm — system sheet/Alert so Settings never stacks RN Modal. */
export function confirmLeaveDevice(opts: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: opts.title,
        message: opts.message,
        options: [opts.confirmLabel, 'Cancel'],
        cancelButtonIndex: 1,
        destructiveButtonIndex: 0,
      },
      (index) => {
        if (index === 0) opts.onConfirm();
      }
    );
    return;
  }

  Alert.alert(opts.title, opts.message, [
    { text: 'Cancel', style: 'cancel' },
    { text: opts.confirmLabel, style: 'destructive', onPress: opts.onConfirm },
  ]);
}

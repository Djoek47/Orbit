/**
 * Native menus for Settings (Expo Router modal).
 *
 * Never use orbitAlert (RN Modal) from Settings — nesting a Modal over
 * presentation: 'modal' can fail to present and leave an invisible touch
 * blocker after dismiss on iOS.
 */
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { openLegalLinksSheet } from '@/lib/ui/legal-links-sheet-controller';

/**
 * Privacy / Terms / Support — root glass sheet + in-app browser, never orbitAlert.
 * Callers that are already inside Settings must dismiss Settings first
 * (`closeSettingsModal`) so this Modal is not nested under Expo presentation:modal.
 */
export function showPrivacyLegalMenu(): void {
  openLegalLinksSheet();
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

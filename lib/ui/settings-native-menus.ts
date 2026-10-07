/**
 * Native menus for Settings (Expo Router modal).
 *
 * Never use orbitAlert (RN Modal) from Settings — nesting a Modal over
 * presentation: 'modal' can fail to present and leave an invisible touch
 * blocker after dismiss on iOS.
 */
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { SESSION_NAV_DELAY_MS } from '@/lib/navigation/session-restart';
import { openLegalLinksSheet } from '@/lib/ui/legal-links-sheet-controller';
import { openTourChapterSheet } from '@/lib/ui/tour-chapter-sheet-controller';

let privacyOpenTimer: ReturnType<typeof setTimeout> | null = null;
let tourChapterOpenTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Privacy / Terms / Support — root glass sheet + in-app browser, never orbitAlert.
 * Callers that are already inside Settings must dismiss Settings first
 * (`closeSettingsModal`) so this Modal is not nested under Expo presentation:modal.
 */
export function showPrivacyLegalMenu(): void {
  openLegalLinksSheet();
}

/**
 * After `closeSettingsModal()`, wait for the Expo modal dismiss animation before
 * presenting the root legal sheet. A single rAF was too early and left a touch
 * blocker (same class as nesting orbitAlert over Settings).
 */
export function showPrivacyLegalMenuAfterSettingsDismiss(): void {
  if (privacyOpenTimer) {
    clearTimeout(privacyOpenTimer);
    privacyOpenTimer = null;
  }
  privacyOpenTimer = setTimeout(() => {
    privacyOpenTimer = null;
    openLegalLinksSheet();
  }, SESSION_NAV_DELAY_MS);
}

/**
 * After Settings dismisses, open the frosted “Replay a part” chapter picker.
 * Same timing as Privacy — never nest under Expo presentation:modal.
 */
export function showTourChapterSheetAfterSettingsDismiss(): void {
  if (tourChapterOpenTimer) {
    clearTimeout(tourChapterOpenTimer);
    tourChapterOpenTimer = null;
  }
  tourChapterOpenTimer = setTimeout(() => {
    tourChapterOpenTimer = null;
    openTourChapterSheet();
  }, SESSION_NAV_DELAY_MS);
}

/** Native confirm for credit packs — safe under Settings modal stack (no RN Modal). */
export function confirmCreditPackPurchase(opts: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}): void {
  Alert.alert(opts.title, opts.message, [
    { text: 'Cancel', style: 'cancel' },
    { text: opts.confirmLabel, onPress: opts.onConfirm },
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

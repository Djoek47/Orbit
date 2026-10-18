/**
 * Notification category for IUI act assent (Approve / Change).
 * Register once at push setup; iOS/Android action buttons.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const IUI_ACT_CATEGORY = 'choremaxx.iui_act';
export const IUI_ACT_APPROVE = 'iui_approve';
export const IUI_ACT_CHANGE = 'iui_change';

let registered = false;

export async function registerIuiActNotificationCategory(): Promise<void> {
  if (registered) return;
  try {
    await Notifications.setNotificationCategoryAsync(IUI_ACT_CATEGORY, [
      {
        identifier: IUI_ACT_APPROVE,
        buttonTitle: 'Approve',
        options: { opensAppToForeground: true },
      },
      {
        identifier: IUI_ACT_CHANGE,
        buttonTitle: 'Change',
        options: { opensAppToForeground: true },
      },
    ]);
    registered = true;
  } catch (error) {
    console.warn('IUI act notification category skipped', error);
  }
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('orbit-iui-acts', {
        name: 'Poppins actions',
        importance: Notifications.AndroidImportance.HIGH,
      });
    } catch {
      /* ignore */
    }
  }
}

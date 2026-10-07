/**
 * Whether the shopping run shows on the Lock Screen. On by default; the switch lives on the
 * shopping screen itself, next to the run's name.
 */
const KEY = 'choremaxx.shopping.lockScreen.v1';

export async function loadShoppingBannerEnabled(): Promise<boolean> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    return (await AsyncStorage.getItem(KEY)) !== '0';
  } catch {
    return true;
  }
}

export async function saveShoppingBannerEnabled(on: boolean): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* best effort */
  }
}

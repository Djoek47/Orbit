/**
 * Tell the server this device just signed in, so a new device gets a security email
 * (supabase/functions/login-alert). Fire-and-forget: a failure never blocks signing in.
 *
 * The device id is random, made once per install and kept in the Keychain — never a hardware
 * identifier, so it cannot follow a person across apps.
 */
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { getSupabaseClient } from '@/lib/supabase/client';

const KEY = 'choremaxx.loginDeviceId.v1';

async function deviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing) return existing;
    const fresh = Crypto.randomUUID();
    await SecureStore.setItemAsync(KEY, fresh);
    return fresh;
  } catch {
    return Crypto.randomUUID();
  }
}

export function reportSignIn(): void {
  void (async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const deviceName = Device.modelName ?? Device.deviceName ?? (Platform.OS === 'ios' ? 'iPhone' : 'Phone');
      const platform = `${Platform.OS === 'ios' ? (Platform.isPad ? 'iPadOS' : 'iOS') : Platform.OS} ${String(Platform.Version)}`;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await supabase.functions.invoke('login-alert', {
        body: { deviceId: await deviceId(), deviceName, platform, timeZone },
      });
    } catch {
      // Best effort: the alert is a courtesy, never a gate.
    }
  })();
}

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { NotificationInbox } from '@/components/orbit/notification-inbox';
import { useOrbit } from '@/store/orbit-store';

/**
 * Unified household inbox — alerts (synced notifications) + Poppins activity.
 * Opened from the header bell, settings, or Poppins hourglass.
 */
export default function NotificationsScreen() {
  const { from, tab } = useLocalSearchParams<{ tab?: string; from?: string }>();
  const { orbitPalette } = useOrbit();
  const initialSegment = tab === 'activity' ? 'activity' : 'alerts';

  return (
    <View style={[styles.shell, { backgroundColor: orbitPalette.backgroundSoft }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <NotificationInbox
        initialSegment={initialSegment}
        hidePoppinsLaunch={from === 'poppins'}
        onClose={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
});

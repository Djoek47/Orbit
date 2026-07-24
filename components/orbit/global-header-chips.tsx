import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOrbit } from '@/store/orbit-store';

/**
 * Make App.tsx Settings chip + always-available Notifications bell.
 * Shown on every primary tab screen.
 */
export function GlobalHeaderChips() {
  const insets = useSafeAreaInsets();
  const { accentTheme, unreadNotificationCount } = useOrbit();
  const badge = Math.min(unreadNotificationCount, 9);
  const accent = accentTheme.primary;

  return (
    <View style={[styles.row, { top: insets.top + 8 }]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={() => router.push('/notifications' as never)}
        style={[styles.bell, { borderColor: `${accent}33` }]}>
        <MaterialIcons name="notifications-none" size={16} color={accent} />
        {badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => router.push('/settings' as never)}
        style={[styles.settings, { borderColor: `${accent}33` }]}>
        <MaterialIcons name="settings" size={13} color={accent} />
        <Text style={[styles.settingsLabel, { color: accent }]}>Settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    right: 16,
    zIndex: 80,
    elevation: 8,
  },
  bell: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: '#F87171',
    borderRadius: 8,
    height: 16,
    justifyContent: 'center',
    minWidth: 16,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -4,
    top: -4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  settings: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  settingsLabel: {
    color: '#7C9CC0',
    fontSize: 11,
    fontWeight: '600',
  },
});

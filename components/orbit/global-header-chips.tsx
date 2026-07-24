import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { useOrbit } from '@/store/orbit-store';

/** Fixed chrome row height below the status bar (logo + chips). */
export const TAB_CHROME_BODY = 52;

/**
 * Sticky tab chrome: larger Choremaxx mark + Notifications/Settings.
 * Mounted once on the tab shell — does not scroll with page content.
 */
export function GlobalHeaderChips() {
  const insets = useSafeAreaInsets();
  const { accentTheme, orbitPalette, unreadNotificationCount } = useOrbit();
  const badge = Math.min(unreadNotificationCount, 9);
  const accent = accentTheme.primary;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.chrome,
        {
          backgroundColor: orbitPalette.background,
          paddingTop: insets.top + 6,
        },
      ]}>
      <View style={styles.row}>
        <ChoremaxxBadge size="xl" />
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={8}
            onPress={() => router.push('/notifications' as never)}
            style={[styles.bell, { borderColor: `${accent}33`, backgroundColor: `${accent}12` }]}>
            <MaterialIcons name="notifications-none" size={18} color={accent} />
            {badge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={8}
            onPress={() => router.push('/settings' as never)}
            style={[styles.settings, { borderColor: `${accent}33`, backgroundColor: `${accent}12` }]}>
            <MaterialIcons name="settings" size={14} color={accent} />
            <Text style={[styles.settingsLabel, { color: accent }]}>Settings</Text>
          </Pressable>
        </View>
      </View>
      <View style={[styles.hairline, { backgroundColor: orbitPalette.border }]} />
    </View>
  );
}

/** Total sticky offset for ScrollView content under GlobalHeaderChips. */
export function useTabChromePaddingTop(extra = 12) {
  const insets = useSafeAreaInsets();
  return insets.top + 6 + TAB_CHROME_BODY + extra;
}

const styles = StyleSheet.create({
  chrome: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
    elevation: 12,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: TAB_CHROME_BODY,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.9,
    width: '100%',
  },
  bell: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
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
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  settingsLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});

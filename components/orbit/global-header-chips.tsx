import { BlurView } from 'expo-blur';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { useOrbit } from '@/store/orbit-store';

/** Fixed chrome row height below the status bar (logo + chips). */
export const TAB_CHROME_BODY = 52;

/**
 * Shared breathing room between the sticky chrome hairline and first page content
 * (Home date, Tasks title, Plan chips, etc.). Keep identical on every chrome tab.
 */
export const TAB_CHROME_CONTENT_GAP = 14;

/**
 * Sticky tab chrome: larger Choremaxx mark + Notifications/Settings.
 * Apple-style frosted glass tinted with the active accent theme.
 */
export function GlobalHeaderChips() {
  const insets = useSafeAreaInsets();
  const { accentTheme, orbitPalette, unreadNotificationCount } = useOrbit();
  const badge = Math.min(unreadNotificationCount, 9);
  const accent = accentTheme.primary;
  const secondary = accentTheme.secondary;
  const isDark = orbitPalette.isDark;
  const blurTint = isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight';
  const blurFallback = isDark ? 'dark' : 'light';

  return (
    <View
      pointerEvents="box-none"
      style={[styles.chrome, { paddingTop: insets.top + 6 }]}>
      {/* Frosted material — blur + vivid theme wash (not clear glass). */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BlurView
          intensity={Platform.OS === 'ios' ? 72 : 90}
          tint={Platform.OS === 'ios' ? blurTint : blurFallback}
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[
            `${accent}${isDark ? 'CC' : 'D9'}`,
            `${secondary}${isDark ? 'A8' : 'B8'}`,
            `${orbitPalette.background}${isDark ? 'E6' : 'F2'}`,
          ]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark ? 'rgba(7,13,28,0.28)' : 'rgba(255,255,255,0.22)',
            },
          ]}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.logoWrap}>
          <ChoremaxxBadge size="xl" />
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={8}
            onPress={() => router.push('/notifications' as never)}
            style={[
              styles.bell,
              {
                borderColor: `${accent}55`,
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.45)',
              },
            ]}>
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
            style={[
              styles.settings,
              {
                borderColor: `${accent}55`,
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.45)',
              },
            ]}>
            <MaterialIcons name="settings" size={14} color={accent} />
            <Text style={[styles.settingsLabel, { color: accent }]}>Settings</Text>
          </Pressable>
        </View>
      </View>
      <View style={[styles.hairline, { backgroundColor: `${accent}66` }]} />
    </View>
  );
}

/**
 * Total sticky offset for ScrollView / header content under GlobalHeaderChips.
 * Always use the default so Home, Tasks, Plan, Rewards, Poppins, Groceries share one gap.
 */
export function useTabChromePaddingTop(extra = TAB_CHROME_CONTENT_GAP) {
  const insets = useSafeAreaInsets();
  return insets.top + 6 + TAB_CHROME_BODY + extra;
}

const styles = StyleSheet.create({
  chrome: {
    left: 0,
    overflow: 'hidden',
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
    zIndex: 1,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  hairline: {
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.85,
    width: '100%',
    zIndex: 1,
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

import { BlurView } from 'expo-blur';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { PoppinsActivitySheet } from '@/components/orbit/poppins-activity-sheet';
import { buildSheetNotifications, needsAttentionCount } from '@/lib/poppins/notification-buckets';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

/** Fixed chrome row height below the status bar (logo + chips). */
export const TAB_CHROME_BODY = 52;

/**
 * Shared breathing room between the sticky chrome hairline and first page content
 * (Home date, Tasks title, Plan chips, etc.). Keep identical on every chrome tab.
 */
export const TAB_CHROME_CONTENT_GAP = 14;

/**
 * Sticky tab chrome: larger Choremaxx mark + Notifications/Settings.
 * Bell opens the dual inbox sheet (Notifications + Poppins Activity).
 * Apple-style frosted glass tinted with the active accent theme.
 */
export function GlobalHeaderChips() {
  const insets = useSafeAreaInsets();
  const {
    accentTheme,
    household,
    markNotificationRead,
    metrics,
    notifications,
    orbitPalette,
    poppinsBriefing,
    poppinsMonitorActions,
    poppinsWeeklyBriefing,
    unreadNotificationCount,
  } = useOrbit();
  const [inboxOpen, setInboxOpen] = useState(false);
  const badge = Math.min(
    Math.max(
      unreadNotificationCount,
      needsAttentionCount(buildSheetNotifications(notifications, poppinsBriefing))
    ),
    9
  );
  const accent = accentTheme.primary;
  const secondary = accentTheme.secondary;
  const isDark = orbitPalette.isDark;
  const blurTint = isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight';
  const blurFallback = isDark ? 'dark' : 'light';

  const monitorFeed = useMemo(
    () =>
      [...poppinsMonitorActions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [poppinsMonitorActions]
  );

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
            accessibilityLabel="Notifications and Poppins Activity"
            hitSlop={8}
            onPress={() => setInboxOpen(true)}
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

      <PoppinsActivitySheet
        visible={inboxOpen}
        onClose={() => setInboxOpen(false)}
        variant="inbox"
        notifications={notifications}
        monitorActions={monitorFeed}
        briefing={poppinsBriefing}
        weekly={poppinsWeeklyBriefing}
        metrics={metrics}
        poppinsActive={monitorFeed.length > 0}
        taskCompletedFallback={household.tasks.filter((t) => t.status === 'Completed').length}
        onDismissNotification={(id) => markNotificationRead(id)}
      />
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    overflow: 'hidden',
  },
  row: {
    height: TAB_CHROME_BODY,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoWrap: {
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  settings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  settingsLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
});

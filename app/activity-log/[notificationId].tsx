import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AdminOnlyNotice,
  BackRow,
  useActivityNames,
  useIsHouseholdAdmin,
  useToneColor,
  type MaterialIconName,
} from '@/components/orbit/activity-log/activity-log-parts';
import { AppText as Text } from '@/components/orbit/app-text';
import { EmptyState } from '@/components/orbit/empty-state';
import { GlassCard } from '@/components/orbit/glass-card';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { orbitScreen, space, typography } from '@/constants/orbit-theme';
import { readActivityLog, type ActivityEntry } from '@/lib/activity/activity-log';
import {
  describeActivity,
  formatActivityTimestamp,
  summarizeNotifications,
  timelineForNotification,
} from '@/lib/activity/activity-timeline';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

/** One notification's history: Created → Sent → Received → Opened → Read → Dismissed / Deleted. */
export default function NotificationHistoryScreen() {
  const { notificationId } = useLocalSearchParams<{ notificationId: string }>();
  const insets = useSafeAreaInsets();
  const { household } = useOrbit();
  const { c } = useOrbitColors();
  const isAdmin = useIsHouseholdAdmin();
  const names = useActivityNames();
  const toneColor = useToneColor();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isAdmin || !household.id || !notificationId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    const rows = await readActivityLog({ householdId: household.id, notificationId });
    setEntries(timelineForNotification(rows, notificationId));
    setLoading(false);
  }, [household.id, isAdmin, notificationId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const summary = useMemo(() => summarizeNotifications(entries)[0] ?? null, [entries]);

  return (
    <ScrollView
      style={[orbitScreen.container, { backgroundColor: c.background }]}
      contentContainerStyle={[
        orbitScreen.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
      ]}>
      <Stack.Screen options={{ headerShown: false }} />
      <BackRow />

      <View style={orbitScreen.header}>
        <PageEyebrow>Notification history</PageEyebrow>
        <Text style={[typography.title2, { color: c.text }]} accessibilityRole="header">
          {summary?.title ?? 'Notification'}
        </Text>
        {summary?.body ? (
          <Text style={[typography.body, { color: c.textSoft }]}>{summary.body}</Text>
        ) : null}
      </View>

      {!isAdmin ? (
        <AdminOnlyNotice />
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: space.lg }} color={c.textMuted} />
      ) : entries.length === 0 ? (
        <EmptyState
          tone="noResults"
          icon="history"
          title="No history for this alert"
          caption="It was created before the activity log existed, or on a device that has not synced."
        />
      ) : (
        <GlassCard style={styles.timeline}>
          {entries.map((entry, index) => {
            const described = describeActivity(entry, names);
            const color = toneColor(described.tone);
            const last = index === entries.length - 1;
            return (
              <View key={entry.id} style={styles.row}>
                <View style={styles.rail}>
                  <View style={[styles.node, { backgroundColor: `${color}22`, borderColor: color }]}>
                    <MaterialIcons name={described.icon as MaterialIconName} size={14} color={color} />
                  </View>
                  {!last ? <View style={[styles.line, { backgroundColor: `${c.textFaint}55` }]} /> : null}
                </View>
                <View style={[styles.copy, !last && styles.copyGap]}>
                  <Text style={[typography.subheadline, { color: c.text, fontWeight: '700' }]}>
                    {described.label}
                  </Text>
                  {described.sublabel ? (
                    <Text style={[typography.caption1, { color: c.textMuted }]}>
                      {described.sublabel}
                    </Text>
                  ) : null}
                  <Text style={[styles.time, { color: c.textSubtle }]}>
                    {formatActivityTimestamp(entry.createdAt)}
                    {entry.source === 'local' ? ' · this device' : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </GlassCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  timeline: { gap: 0 },
  row: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 28 },
  node: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  line: { flex: 1, marginVertical: 2, width: 2 },
  copy: { flex: 1, gap: 2, paddingTop: 4 },
  copyGap: { paddingBottom: 14 },
  time: { fontSize: 11 },
});

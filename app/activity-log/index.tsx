import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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
import { SegmentedControl } from '@/components/orbit/segmented-control';
import { orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import {
  ASSISTANT_KINDS,
  readActivityLog,
  type ActivityEntry,
} from '@/lib/activity/activity-log';
import {
  describeActivity,
  formatActivityTimestamp,
  summarizeNotifications,
  type NotificationActivitySummary,
} from '@/lib/activity/activity-timeline';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

type Filter = 'notifications' | 'assistant';

/**
 * Admin activity log — every notification's history (incl. deleted ones,
 * which only exist here) plus assistant errors and "you're wrong" reports.
 */
export default function ActivityLogScreen() {
  const insets = useSafeAreaInsets();
  const { household } = useOrbit();
  const { c } = useOrbitColors();
  const isAdmin = useIsHouseholdAdmin();
  const [filter, setFilter] = useState<Filter>('notifications');
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin || !household.id) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setEntries(await readActivityLog({ householdId: household.id }));
    setLoading(false);
  }, [household.id, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const summaries = useMemo(() => summarizeNotifications(entries), [entries]);
  const assistantRows = useMemo(
    () => entries.filter((entry) => ASSISTANT_KINDS.includes(entry.kind)),
    [entries]
  );

  return (
    <ScrollView
      style={[orbitScreen.container, { backgroundColor: c.background }]}
      contentContainerStyle={[
        orbitScreen.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
      ]}
      refreshControl={
        isAdmin ? <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} /> : undefined
      }>
      <Stack.Screen options={{ headerShown: false }} />
      <BackRow />

      <View style={orbitScreen.header}>
        <PageEyebrow>Household</PageEyebrow>
        <Text style={[typography.title1, { color: c.text }]} accessibilityRole="header">
          Activity log
        </Text>
        <Text style={[typography.body, { color: c.textSoft }]}>
          When each alert was created, sent, received, opened, and cleared — kept even if the alert
          is deleted.
        </Text>
      </View>

      {!isAdmin ? (
        <AdminOnlyNotice />
      ) : (
        <>
          <SegmentedControl
            options={[
              { value: 'notifications' as const, label: 'Notifications' },
              {
                value: 'assistant' as const,
                label: assistantRows.length > 0 ? `Assistant errors (${assistantRows.length})` : 'Assistant errors',
              },
            ]}
            value={filter}
            onChange={setFilter}
          />

          {loading ? (
            <ActivityIndicator style={{ marginTop: space.lg }} color={c.textMuted} />
          ) : filter === 'notifications' ? (
            summaries.length === 0 ? (
              <EmptyState
                tone="noneYet"
                icon="history"
                title="No history yet"
                caption="New alerts are tracked from now on — sent, received, opened, read, and dismissed."
              />
            ) : (
              <View style={styles.list}>
                {summaries.map((summary) => (
                  <NotificationSummaryRow key={summary.notificationId} summary={summary} />
                ))}
              </View>
            )
          ) : assistantRows.length === 0 ? (
            <EmptyState
              tone="allClear"
              title="No assistant problems"
              caption="Errors and times someone said the assistant got it wrong show up here, with what was said."
            />
          ) : (
            <View style={styles.list}>
              {assistantRows.map((entry) => (
                <AssistantRow key={entry.id} entry={entry} />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const STEPS: { key: keyof NotificationActivitySummary; icon: MaterialIconName; label: string }[] = [
  { key: 'sent', icon: 'send', label: 'Sent' },
  { key: 'received', icon: 'phone-iphone', label: 'Received' },
  { key: 'opened', icon: 'touch-app', label: 'Opened' },
  { key: 'read', icon: 'done-all', label: 'Read' },
];

function NotificationSummaryRow({ summary }: { summary: NotificationActivitySummary }) {
  const { accentTheme } = useOrbit();
  const { c, glass } = useOrbitColors();

  return (
    <Pressable
      onPress={() => router.push(`/activity-log/${summary.notificationId}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`History for ${summary.title}`}>
      <GlassCard style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={[typography.headline, { color: c.text, flex: 1 }]} numberOfLines={2}>
            {summary.title}
          </Text>
          {summary.deleted ? (
            <View style={[styles.pill, { backgroundColor: `${c.danger}22` }]}>
              <Text style={[styles.pillText, { color: c.danger }]}>Deleted</Text>
            </View>
          ) : summary.dismissed ? (
            <View style={[styles.pill, { backgroundColor: `${c.warning}22` }]}>
              <Text style={[styles.pillText, { color: c.warning }]}>Dismissed</Text>
            </View>
          ) : null}
          <MaterialIcons name="chevron-right" size={20} color={c.textSubtle} />
        </View>
        {summary.body ? (
          <Text style={[typography.footnote, { color: c.textSoft }]} numberOfLines={2}>
            {summary.body}
          </Text>
        ) : null}
        <View style={styles.steps}>
          {STEPS.map((step) => {
            const done = Boolean(summary[step.key]);
            return (
              <View
                key={step.key}
                style={[styles.step, { backgroundColor: done ? `${accentTheme.primary}18` : glass(0.04) }]}
                accessibilityLabel={`${step.label}: ${done ? 'yes' : 'no record'}`}>
                <MaterialIcons
                  name={step.icon}
                  size={12}
                  color={done ? accentTheme.primary : c.textFaint}
                />
                <Text
                  style={[
                    typography.caption2,
                    { color: done ? accentTheme.primary : c.textFaint, fontWeight: '700' },
                  ]}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={[styles.time, { color: c.textSubtle }]}>
          {formatActivityTimestamp(summary.firstAt)}
        </Text>
      </GlassCard>
    </Pressable>
  );
}

function AssistantRow({ entry }: { entry: ActivityEntry }) {
  const { c, glass } = useOrbitColors();
  const names = useActivityNames();
  const toneColor = useToneColor();
  const described = describeActivity(entry, names);
  const color = toneColor(described.tone);
  const transcript =
    typeof entry.detail.transcript === 'string' ? entry.detail.transcript : entry.body;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.iconDot, { backgroundColor: `${color}1F` }]}>
          <MaterialIcons name={described.icon as MaterialIconName} size={16} color={color} />
        </View>
        <Text style={[typography.subheadline, { color: c.text, flex: 1, fontWeight: '700' }]}>
          {described.label}
        </Text>
      </View>
      {described.sublabel ? (
        <Text style={[typography.caption1, { color: c.textMuted }]}>{described.sublabel}</Text>
      ) : null}
      {transcript ? (
        <View style={[styles.quote, { backgroundColor: glass(0.05), borderLeftColor: color }]}>
          <Text style={[typography.footnote, { color: c.textSoft }]}>{`"${transcript}"`}</Text>
        </View>
      ) : null}
      <Text style={[styles.time, { color: c.textSubtle }]}>
        {formatActivityTimestamp(entry.createdAt)}
        {entry.device ? ` · ${entry.device}` : ''}
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  card: { gap: 8 },
  cardHead: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  step: {
    alignItems: 'center',
    borderRadius: radius.control,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  iconDot: {
    alignItems: 'center',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  quote: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  time: { fontSize: 11 },
});

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  buildHomeHealthMetrics,
  resolveHomeHealthRole,
} from '@/lib/home-health-metrics';
import {
  computeCleaningByRoom,
  computeLiveMemberLoad,
} from '@/lib/household/health-dashboard';
import { isSharedDeviceAccount } from '@/lib/household/shared-device';
import { groupHouseholdEvents } from '@/lib/calendar/event-groups';
import { isOpenTask } from '@/lib/tasks/cancel';
import { useOrbit } from '@/store/orbit-store';
import { CompletionBreakdown } from '@/components/orbit/completion/completion-breakdown';
import {
  GlassDetailPopover,
  type GlassDetailLine,
} from '@/components/orbit/health/glass-detail-popover';
import { MemberGlyph } from '@/components/orbit/member-glyph';
import { Moji } from '@/components/orbit/moji/moji';
import { AppText as Text } from '@/components/orbit/app-text';

type SheetDetail = {
  title: string;
  subtitle?: string;
  accent: string;
  lines: GlassDetailLine[];
  emptyLabel?: string;
};

/**
 * Home → Household Health: one unified sheet.
 * Live streak + completion, full task breakdown, member load, cleaning by room.
 * Tasks → Completed still opens /completed-breakdown (task charts only).
 */
export default function HouseholdBalanceScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, household, metrics, currentMember, permissions, orbitPalette } = useOrbit();
  const [sheetDetail, setSheetDetail] = useState<SheetDetail | null>(null);

  const sharedKidMode =
    isSharedDeviceAccount(currentMember, household.members) || currentMember?.role === 'child';
  const healthRole = resolveHomeHealthRole(currentMember, {
    isAdmin: permissions.canManageHousehold,
  });
  const healthItems = useMemo(
    () =>
      buildHomeHealthMetrics({
        role: healthRole,
        metrics,
        household,
        currentMember,
      }),
    [healthRole, metrics, household, currentMember]
  );

  const memberLoad = useMemo(
    () => computeLiveMemberLoad(household.members, household.tasks),
    [household.members, household.tasks]
  );

  const cleaningByRoom = useMemo(
    () => computeCleaningByRoom(household.tasks, household.rooms),
    [household.tasks, household.rooms]
  );

  const hero = healthItems.map((item) => ({
    key: item.key,
    label: item.label,
    value: item.valueLabel,
    hint:
      item.kind === 'pct'
        ? 'Score'
        : item.kind === 'streak'
          ? 'Days in a row'
          : item.kind === 'trophy'
            ? 'Toward next trophy'
            : 'Count',
    color: item.color,
  }));

  const openTasks = metrics.openTasks ?? 0;
  const missingGroceries = metrics.missingGroceries ?? 0;
  const upcomingEvents = metrics.upcomingEvents ?? 0;
  const groceryReadiness = metrics.groceryReadiness ?? 0;

  const openTaskLines = useMemo<GlassDetailLine[]>(
    () =>
      household.tasks
        .filter((task) => isOpenTask(task))
        .slice(0, 24)
        .map((task) => ({
          label: task.title,
          meta: task.assignee || task.due || task.status,
        })),
    [household.tasks]
  );

  const groceryLines = useMemo<GlassDetailLine[]>(() => {
    const low = household.groceries.filter((item) => item.status === 'Low');
    const missing = household.groceries.filter((item) => item.status === 'Missing');
    const ready = household.groceries.filter(
      (item) => item.status === 'Available' || item.status === 'Purchased'
    );
    const lines: GlassDetailLine[] = [
      {
        label: `${ready.length} ready`,
        meta: `${groceryReadiness}%`,
      },
      {
        label: `${low.length} running low`,
        meta: low.length ? low.slice(0, 3).map((item) => item.name).join(', ') : '—',
      },
      {
        label: `${missing.length} missing`,
        meta: missing.length ? 'Need shop' : 'Clear',
      },
    ];
    for (const item of [...low, ...missing].slice(0, 18)) {
      lines.push({ label: item.name, meta: item.status });
    }
    return lines;
  }, [household.groceries, groceryReadiness]);

  const missingLines = useMemo<GlassDetailLine[]>(
    () =>
      household.groceries
        .filter((item) => item.status === 'Missing')
        .slice(0, 24)
        .map((item) => ({
          label: item.name,
          meta: item.quantity || item.category,
        })),
    [household.groceries]
  );

  const eventLines = useMemo<GlassDetailLine[]>(() => {
    const groups = groupHouseholdEvents(household.events);
    return groups
      .filter((group) => group.key === 'Today' || group.key === 'Tomorrow')
      .flatMap((group) =>
        group.events.map((event) => ({
          label: event.title,
          meta: [group.key, event.time].filter(Boolean).join(' · ') || event.responsible,
        }))
      )
      .slice(0, 16);
  }, [household.events]);

  // Hero already shows Completion + Streak — keep the pulse thin.
  const livePulse = !sharedKidMode
    ? [
        {
          key: 'open' as const,
          icon: 'assignment' as const,
          color: accentTheme.primary,
          label: `${openTasks} open task${openTasks === 1 ? '' : 's'}`,
          detail: {
            title: 'Open tasks',
            subtitle: `${openTasks} still need attention`,
            accent: accentTheme.primary,
            lines: openTaskLines,
            emptyLabel: 'No open tasks right now.',
          } satisfies SheetDetail,
        },
        {
          key: 'grocery' as const,
          icon: 'shopping-cart' as const,
          color: '#38BDF8',
          label: `${groceryReadiness}% groceries ready`,
          detail: {
            title: 'Grocery readiness',
            subtitle: `${groceryReadiness}% of the list is ready`,
            accent: '#38BDF8',
            lines: groceryLines,
            emptyLabel: 'Grocery list is empty.',
          } satisfies SheetDetail,
        },
        ...(upcomingEvents > 0
          ? [
              {
                key: 'events' as const,
                icon: 'event' as const,
                color: '#A78BFA',
                label: `${upcomingEvents} upcoming`,
                detail: {
                  title: 'Upcoming',
                  subtitle: `${upcomingEvents} on the calendar soon`,
                  accent: '#A78BFA',
                  lines: eventLines,
                  emptyLabel: 'Nothing upcoming.',
                } satisfies SheetDetail,
              },
            ]
          : []),
        ...(missingGroceries > 0
          ? [
              {
                key: 'missing' as const,
                icon: 'playlist-add-check' as const,
                color: '#F472B6',
                label: `${missingGroceries} missing`,
                detail: {
                  title: 'Missing groceries',
                  subtitle: `${missingGroceries} item${missingGroceries === 1 ? '' : 's'} to pick up`,
                  accent: '#F472B6',
                  lines: missingLines,
                  emptyLabel: 'Nothing marked missing.',
                } satisfies SheetDetail,
              },
            ]
          : []),
      ]
    : [];

  const roomsQuiet = cleaningByRoom.every((row) => row.open === 0 && row.completed === 0);

  const roleLabel = (role: string) => {
    if (role === 'child') return 'Sidekick';
    if (role === 'owner' || role === 'admin') return 'Admin';
    if (role === 'adult') return 'Adult';
    return role;
  };

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, backgroundColor: orbitPalette.backgroundSoft },
      ]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.handle} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="close" size={18} color={orbitPalette.textMuted} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.kicker, { color: orbitPalette.textMuted }]}>
            {sharedKidMode ? 'You' : 'Household'}
          </Text>
          <Text style={[styles.title, { color: orbitPalette.text }]}>
            {sharedKidMode ? 'My progress' : 'Household Health'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroRow}>
          {hero.map((item) => (
            <View key={item.key} style={[styles.heroCard, { borderColor: `${item.color}33` }]}>
              <Text style={[styles.heroLabel, { color: item.color }]}>{item.label}</Text>
              <Text style={[styles.heroValue, { color: orbitPalette.text }]}>{item.value}</Text>
              <Text style={[styles.heroHint, { color: orbitPalette.textSubtle }]}>{item.hint}</Text>
            </View>
          ))}
        </View>

        {livePulse.length > 0 ? (
          <View style={styles.liveStrip}>
            {livePulse.map((chip) => (
              <Pressable
                key={chip.key}
                onPress={() => setSheetDetail(chip.detail)}
                style={[
                  styles.liveChip,
                  {
                    backgroundColor: `${chip.color}22`,
                    borderColor: `${chip.color}55`,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${chip.label}. Show details`}
                accessibilityHint="Opens a short glass summary">
                <MaterialIcons name={chip.icon} size={14} color={chip.color} />
                <Text style={[styles.liveChipText, { color: orbitPalette.text }]}>{chip.label}</Text>
                <MaterialIcons name="expand-more" size={14} color={`${chip.color}CC`} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={[styles.section, { color: orbitPalette.textMuted }]}>
          {sharedKidMode ? 'Your completions' : 'Task breakdown'}
        </Text>
        <View style={styles.breakdownWrap}>
          <CompletionBreakdown
            embedded
            bottomInset={0}
            onOpenDetail={setSheetDetail}
          />
        </View>

        {!sharedKidMode ? (
          <>
            <Text style={[styles.section, { color: orbitPalette.textMuted }]}>Member load</Text>
            <Text style={[styles.sectionHint, { color: orbitPalette.textSubtle }]}>
              {memberLoad.some((row) => row.openCount > 0)
                ? 'Share of open chores right now — updates live as tasks move.'
                : 'No open chores — bars show this week’s XP so load still reads.'}
            </Text>
            {memberLoad.length === 0 ? (
              <Text style={[styles.emptyHint, { color: orbitPalette.textSubtle }]}>
                No active members to balance yet.
              </Text>
            ) : (
              memberLoad.map(({ member, loadShare, openCount }) => (
                <View key={member.id} style={styles.memberCard}>
                  <View style={[styles.avatar, { backgroundColor: `${accentTheme.primary}22` }]}>
                    <MemberGlyph member={member} size={18} />
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: orbitPalette.text }]}>{member.name}</Text>
                    <Text style={[styles.memberMeta, { color: orbitPalette.textMuted }]}>
                      {roleLabel(member.role)} · {member.xp} XP
                      {openCount > 0 ? ` · ${openCount} open` : ''}
                    </Text>
                    <View style={styles.loadTrack}>
                      <View
                        style={[
                          styles.loadFill,
                          {
                            width: `${Math.min(100, Math.max(loadShare > 0 ? 4 : 0, loadShare))}%`,
                            backgroundColor: accentTheme.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={[styles.loadText, { color: accentTheme.primary }]}>{loadShare}%</Text>
                </View>
              ))
            )}

            <Text style={[styles.section, { color: orbitPalette.textMuted }]}>Cleaning by room</Text>
            {roomsQuiet ? (
              <Text style={[styles.emptyHint, { color: orbitPalette.textSubtle }]}>
                No room cleans logged yet — assign a kitchen or bathroom chore to start the map.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.roomStrip}>
                {cleaningByRoom.map(({ room, open, completed, lastTitle }) => (
                  <View key={room.id} style={styles.roomCard}>
                    <Moji emoji={room.emoji} size={18} />
                    <Text style={[styles.roomName, { color: orbitPalette.text }]}>{room.name}</Text>
                    <Text style={[styles.roomMeta, { color: orbitPalette.textMuted }]}>
                      {completed} done · {open} open
                    </Text>
                    <Text style={[styles.roomLast, { color: orbitPalette.textSubtle }]} numberOfLines={2}>
                      {lastTitle ? `Last: ${lastTitle}` : 'No completed cleans yet'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </>
        ) : null}
      </ScrollView>

      <GlassDetailPopover
        visible={sheetDetail != null}
        title={sheetDetail?.title ?? ''}
        subtitle={sheetDetail?.subtitle}
        accent={sheetDetail?.accent ?? accentTheme.primary}
        lines={sheetDetail?.lines ?? []}
        emptyLabel={sheetDetail?.emptyLabel}
        onClose={() => setSheetDetail(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerCopy: { alignItems: 'center', flex: 1 },
  iconBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: { fontSize: 18, fontWeight: '800' },
  content: { gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  heroRow: { flexDirection: 'row', gap: 10 },
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  heroLabel: { fontSize: 11, fontWeight: '700' },
  heroValue: { fontSize: 22, fontWeight: '800' },
  heroHint: { fontSize: 11 },
  liveStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  liveChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  liveChipText: { fontSize: 13, fontWeight: '700' },
  section: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  sectionHint: { fontSize: 12, marginTop: -6 },
  emptyHint: { fontSize: 13, paddingVertical: 4 },
  breakdownWrap: {
    marginHorizontal: -16,
    // CompletionBreakdown has its own horizontal padding; keep it flush in the sheet.
  },
  memberCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  memberInfo: { flex: 1, gap: 4 },
  memberName: { fontSize: 15, fontWeight: '700' },
  memberMeta: { fontSize: 12 },
  loadTrack: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 6,
    overflow: 'hidden',
  },
  loadFill: { borderRadius: 999, height: 6 },
  loadText: { fontSize: 13, fontWeight: '800' },
  roomStrip: { gap: 10, paddingVertical: 4 },
  roomCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    padding: 14,
    width: 140,
  },
  roomName: { fontSize: 14, fontWeight: '700' },
  roomMeta: { fontSize: 11 },
  roomLast: { fontSize: 11 },
});

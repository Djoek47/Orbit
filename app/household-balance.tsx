import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  buildHomeHealthMetrics,
  personalStreakDays,
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
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { AppText as Text } from '@/components/orbit/app-text';
import { radius, space, typography } from '@/constants/orbit-theme';

type SheetDetail = {
  title: string;
  subtitle?: string;
  accent: string;
  lines: GlassDetailLine[];
  emptyLabel?: string;
};

/**
 * Home → Household Health: one unified sheet.
 * Live personal streak (same as Today’s Tasks) + completion, task breakdown,
 * member load, cleaning by area.
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
    val: item.val,
    hint:
      item.kind === 'pct'
        ? 'Household score'
        : item.kind === 'streak'
          ? 'Your streak'
          : item.kind === 'trophy'
            ? 'Toward next trophy'
            : 'Open now',
    color: item.color,
    kind: item.kind,
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

  const openStreakDetail = () => {
    const mine = personalStreakDays(currentMember);
    const lines: GlassDetailLine[] = [
      {
        label: currentMember?.name?.split(' ')[0] || 'You',
        meta: `${mine} day${mine === 1 ? '' : 's'}`,
      },
      {
        label: 'Matches',
        meta: 'Today’s Tasks streak',
      },
      {
        label: 'House rules',
        meta: 'Personal · Rescue can save a miss',
      },
    ];
    if (!sharedKidMode) {
      for (const row of memberLoad.slice(0, 8)) {
        if (row.member.id === currentMember?.id) continue;
        const days = personalStreakDays(row.member);
        lines.push({
          label: row.member.name.split(' ')[0]!,
          meta: `${days}d`,
        });
      }
    }
    setSheetDetail({
      title: sharedKidMode ? 'My streak' : 'Streak',
      subtitle: 'Same number as Today’s Tasks',
      accent: '#FB923C',
      lines,
    });
  };

  const openCompletionDetail = () => {
    setSheetDetail({
      title: 'Completion',
      subtitle: 'Share of household tasks finished',
      accent: '#34D399',
      lines: [
        { label: 'Score', meta: `${metrics.taskCompletionRate}%` },
        { label: 'Open now', meta: String(openTasks) },
        {
          label: 'Finished',
          meta: String(
            household.tasks.filter((task) => task.status === 'Completed').length
          ),
        },
      ],
    });
  };

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, backgroundColor: orbitPalette.backgroundSoft },
      ]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.handle, { backgroundColor: orbitPalette.border }]} />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: orbitPalette.card }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <MaterialIcons name="close" size={18} color={orbitPalette.textMuted} />
        </Pressable>
        <View style={styles.headerCopy}>
          <PageEyebrow>{sharedKidMode ? 'You' : 'Household'}</PageEyebrow>
          <Text style={[typography.title2, { color: orbitPalette.text, textAlign: 'center' }]}>
            {sharedKidMode ? 'My progress' : 'Household Health'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroRow}>
          {hero.map((item) => {
            const showBar = item.kind === 'pct' || item.kind === 'trophy';
            const barWidth = Math.max(4, Math.min(100, item.val));
            return (
              <Pressable
                key={item.key}
                onPress={
                  item.kind === 'streak'
                    ? openStreakDetail
                    : item.kind === 'pct'
                      ? openCompletionDetail
                      : undefined
                }
                style={[styles.heroCard, { borderColor: `${item.color}40` }]}
                accessibilityRole={
                  item.kind === 'streak' || item.kind === 'pct' ? 'button' : undefined
                }
                accessibilityLabel={`${item.label} ${item.value}. ${item.hint}`}>
                <LinearGradient
                  colors={[`${item.color}28`, `${item.color}08`, 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={[typography.caption1, styles.heroLabel, { color: item.color }]}>
                  {item.label}
                </Text>
                <Text style={[typography.metricSmall, { color: orbitPalette.text }]}>
                  {item.value}
                </Text>
                <Text style={[typography.caption2, { color: orbitPalette.textMuted }]}>
                  {item.hint}
                </Text>
                {showBar ? (
                  <View style={[styles.heroTrack, { backgroundColor: `${item.color}22` }]}>
                    <View
                      style={[
                        styles.heroFill,
                        { width: `${barWidth}%`, backgroundColor: item.color },
                      ]}
                    />
                  </View>
                ) : (
                  <View style={styles.heroStreakRow}>
                    <MaterialIcons name="local-fire-department" size={14} color={item.color} />
                    <Text style={[typography.caption2, { color: orbitPalette.textSubtle }]}>
                      Same as Today
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
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
                    backgroundColor: `${chip.color}18`,
                    borderColor: `${chip.color}44`,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${chip.label}. Show details`}
                accessibilityHint="Opens a short glass summary">
                <MaterialIcons name={chip.icon} size={14} color={chip.color} />
                <Text style={[typography.footnote, { color: orbitPalette.text, fontWeight: '700' }]}>
                  {chip.label}
                </Text>
                <MaterialIcons name="expand-more" size={14} color={`${chip.color}CC`} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={[typography.eyebrow, { color: orbitPalette.textMuted, marginTop: 8 }]}>
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
            <Text style={[typography.eyebrow, { color: orbitPalette.textMuted, marginTop: 8 }]}>
              Member load
            </Text>
            <Text style={[typography.footnote, { color: orbitPalette.textSubtle, marginTop: -4 }]}>
              {memberLoad.some((row) => row.openCount > 0)
                ? 'Open chores and each person’s streak — updates live.'
                : 'No open chores — bars show this week’s XP. Streaks still update live.'}
            </Text>
            {memberLoad.length === 0 ? (
              <Text style={[typography.footnote, { color: orbitPalette.textSubtle }]}>
                No active members to balance yet.
              </Text>
            ) : (
              memberLoad.map(({ member, loadShare, openCount }) => {
                const streakDays = personalStreakDays(member);
                return (
                  <View
                    key={member.id}
                    style={[
                      styles.memberCard,
                      {
                        backgroundColor: orbitPalette.card,
                        borderColor: orbitPalette.border,
                      },
                    ]}>
                    <View style={[styles.avatar, { backgroundColor: `${accentTheme.primary}22` }]}>
                      <MemberGlyph member={member} size={18} />
                    </View>
                    <View style={styles.memberInfo}>
                      <View style={styles.memberNameRow}>
                        <Text style={[typography.headline, { color: orbitPalette.text, flex: 1 }]}>
                          {member.name}
                        </Text>
                        <View style={[styles.streakPill, { backgroundColor: '#FB923C22' }]}>
                          <MaterialIcons name="local-fire-department" size={12} color="#FB923C" />
                          <Text style={[typography.caption1, { color: '#FB923C', fontWeight: '700' }]}>
                            {streakDays}d
                          </Text>
                        </View>
                      </View>
                      <Text style={[typography.caption1, { color: orbitPalette.textMuted }]}>
                        {roleLabel(member.role)} · {member.xp} XP
                        {openCount > 0 ? ` · ${openCount} open` : ''}
                      </Text>
                      <View style={[styles.loadTrack, { backgroundColor: orbitPalette.cardMuted }]}>
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
                    <Text style={[typography.footnote, { color: accentTheme.primary, fontWeight: '800' }]}>
                      {loadShare}%
                    </Text>
                  </View>
                );
              })
            )}

            <Text style={[typography.eyebrow, { color: orbitPalette.textMuted, marginTop: 8 }]}>
              Areas
            </Text>
            <Text style={[typography.footnote, { color: orbitPalette.textSubtle, marginTop: -4 }]}>
              Cleaning load by room — open vs done.
            </Text>
            {roomsQuiet ? (
              <Text style={[typography.footnote, { color: orbitPalette.textSubtle }]}>
                No room cleans logged yet — assign a kitchen or bathroom chore to start the map.
              </Text>
            ) : (
              <View style={styles.roomGrid}>
                {cleaningByRoom.map(({ room, open, completed, lastTitle }) => {
                  const total = open + completed;
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                  const accent =
                    open === 0 && completed > 0
                      ? '#34D399'
                      : open > 0
                        ? accentTheme.primary
                        : orbitPalette.textSubtle;
                  return (
                    <View
                      key={room.id}
                      style={[
                        styles.roomCard,
                        {
                          backgroundColor: orbitPalette.card,
                          borderColor: orbitPalette.border,
                        },
                      ]}>
                      <LinearGradient
                        colors={[`${accent}22`, 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.roomGlow}
                      />
                      <View style={[styles.roomIcon, { backgroundColor: `${accent}22` }]}>
                        <Moji emoji={room.emoji} size={20} />
                      </View>
                      <Text
                        style={[typography.headline, { color: orbitPalette.text }]}
                        numberOfLines={1}>
                        {room.name}
                      </Text>
                      <View style={styles.roomStats}>
                        <View style={[styles.roomStatPill, { backgroundColor: '#34D39922' }]}>
                          <Text style={[typography.caption2, { color: '#34D399' }]}>
                            {completed} done
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.roomStatPill,
                            { backgroundColor: open > 0 ? `${accentTheme.primary}22` : orbitPalette.cardMuted },
                          ]}>
                          <Text
                            style={[
                              typography.caption2,
                              { color: open > 0 ? accentTheme.primary : orbitPalette.textMuted },
                            ]}>
                            {open} open
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.roomTrack, { backgroundColor: orbitPalette.cardMuted }]}>
                        <View
                          style={[
                            styles.roomFill,
                            {
                              width: `${Math.max(total > 0 ? 6 : 0, pct)}%`,
                              backgroundColor: accent,
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[typography.caption2, { color: orbitPalette.textSubtle }]}
                        numberOfLines={2}>
                        {lastTitle ? `Last: ${lastTitle}` : 'No completed cleans yet'}
                      </Text>
                    </View>
                  );
                })}
              </View>
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
    borderRadius: radius.full,
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  headerCopy: { alignItems: 'center', flex: 1, gap: 2 },
  iconBtn: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  content: { gap: space.sm, paddingHorizontal: space.md, paddingTop: space.xs },
  heroRow: { flexDirection: 'row', gap: 10 },
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    overflow: 'hidden',
    padding: space.sm + 2,
  },
  heroLabel: { fontWeight: '700' },
  heroTrack: {
    borderRadius: radius.full,
    height: 5,
    marginTop: 6,
    overflow: 'hidden',
  },
  heroFill: { borderRadius: radius.full, height: 5 },
  heroStreakRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  liveStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  liveChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  breakdownWrap: {
    marginHorizontal: -space.md,
  },
  memberCard: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
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
  memberNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  streakPill: {
    alignItems: 'center',
    borderRadius: radius.full,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  loadTrack: {
    borderRadius: radius.full,
    height: 6,
    overflow: 'hidden',
  },
  loadFill: { borderRadius: radius.full, height: 6 },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roomCard: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 8,
    overflow: 'hidden',
    padding: 14,
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    maxWidth: '49%',
  },
  roomGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.card,
  },
  roomIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  roomStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roomStatPill: {
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roomTrack: {
    borderRadius: radius.full,
    height: 5,
    overflow: 'hidden',
  },
  roomFill: { borderRadius: radius.full, height: 5 },
});

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, router } from 'expo-router';
import { useMemo } from 'react';
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
import { useOrbit } from '@/store/orbit-store';
import { CompletionBreakdown } from '@/components/orbit/completion/completion-breakdown';
import { MemberGlyph } from '@/components/orbit/member-glyph';
import { Moji } from '@/components/orbit/moji/moji';
import { AppText as Text } from '@/components/orbit/app-text';

/**
 * Home → Household Health: one unified sheet.
 * Live streak + completion, full task breakdown, member load, cleaning by room.
 * Tasks → Completed still opens /completed-breakdown (task charts only).
 */
export default function HouseholdBalanceScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, household, metrics, currentMember, permissions, orbitPalette } = useOrbit();

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
  const streakDays =
    typeof metrics.householdStreak === 'number'
      ? metrics.householdStreak
      : Number.parseInt(
          String(healthItems.find((item) => item.kind === 'streak')?.valueLabel ?? '0').replace(/\D/g, ''),
          10
        ) || 0;
  const liveStreakLabel = `${streakDays}d`;

  const livePulse = !sharedKidMode
    ? [
        {
          key: 'streak',
          icon: 'local-fire-department' as const,
          color: '#FB923C',
          label: `Live streak ${liveStreakLabel}`,
        },
        {
          key: 'open',
          icon: 'assignment' as const,
          color: accentTheme.primary,
          label: `${openTasks} open task${openTasks === 1 ? '' : 's'}`,
        },
        {
          key: 'grocery',
          icon: 'shopping-cart' as const,
          color: '#38BDF8',
          label: `${metrics.groceryReadiness ?? 0}% groceries ready`,
        },
        {
          key: 'missing',
          icon: 'playlist-add-check' as const,
          color: '#F472B6',
          label: `${metrics.missingGroceries ?? 0} missing`,
        },
        {
          key: 'events',
          icon: 'event' as const,
          color: '#A78BFA',
          label: `${metrics.upcomingEvents ?? 0} upcoming`,
        },
        {
          key: 'momentum',
          icon: 'bolt' as const,
          color: '#34D399',
          label: `${metrics.momentum ?? 0} momentum`,
        },
      ]
    : [];

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
              <View
                key={chip.key}
                style={[styles.liveChip, { backgroundColor: `${accentTheme.primary}18` }]}>
                <MaterialIcons name={chip.icon} size={14} color={chip.color} />
                <Text style={[styles.liveChipText, { color: orbitPalette.text }]}>{chip.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={[styles.section, { color: orbitPalette.textMuted }]}>
          {sharedKidMode ? 'Your completions' : 'Task breakdown'}
        </Text>
        <View style={styles.breakdownWrap}>
          <CompletionBreakdown embedded bottomInset={0} />
        </View>

        {!sharedKidMode ? (
          <>
            <Text style={[styles.section, { color: orbitPalette.textMuted }]}>Member load</Text>
            <Text style={[styles.sectionHint, { color: orbitPalette.textSubtle }]}>
              Share of open chores right now — updates live as tasks move.
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
                      {member.role} · {member.xp} XP
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
          </>
        ) : null}
      </ScrollView>
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

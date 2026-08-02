import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { memberDisplayEmoji } from '@/lib/game-levels';
import {
  buildHomeHealthMetrics,
  resolveHomeHealthRole,
} from '@/lib/home-health-metrics';
import { isSharedDeviceAccount } from '@/lib/household/shared-device';
import { useOrbit } from '@/store/orbit-store';

export default function HouseholdBalanceScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, household, metrics, currentMember, permissions, orbitPalette } = useOrbit();
  const sorted = useMemo(
    () => [...household.members].sort((a, b) => b.loadShare - a.loadShare),
    [household.members],
  );

  const sharedKidMode =
    isSharedDeviceAccount(currentMember, household.members) || currentMember?.role === 'child';
  const healthRole = resolveHomeHealthRole(currentMember, {
    householdType: household.householdType,
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
    [healthRole, metrics, household, currentMember],
  );

  const cleaningByRoom = useMemo(() => {
    const rooms = household.rooms ?? [];
    return rooms.map((room) => {
      const roomTasks = household.tasks.filter(
        (task) =>
          task.roomId === room.id ||
          (task.category.toLowerCase().includes('clean') &&
            task.title.toLowerCase().includes(room.name.split(' ')[0].toLowerCase())),
      );
      const overdue = roomTasks.filter((task) => task.status === 'Overdue' || task.status === 'Pending').length;
      const completed = roomTasks.filter((task) => task.status === 'Completed').length;
      const lastDone = roomTasks.find((task) => task.status === 'Completed');
      return {
        room,
        overdue,
        completed,
        lastTitle: lastDone?.title,
      };
    });
  }, [household.rooms, household.tasks]);

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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
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

        {!sharedKidMode ? (
          <>
            <Text style={[styles.section, { color: orbitPalette.textMuted }]}>Member load</Text>
            {sorted.map((member) => (
              <View key={member.id} style={styles.memberCard}>
                <View style={[styles.avatar, { backgroundColor: `${accentTheme.primary}22` }]}>
                  <Text style={styles.avatarEmoji}>{memberDisplayEmoji(member)}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: orbitPalette.text }]}>{member.name}</Text>
                  <Text style={[styles.memberMeta, { color: orbitPalette.textMuted }]}>
                    {member.role} · {member.xp} XP
                  </Text>
                  <View style={styles.loadTrack}>
                    <View
                      style={[
                        styles.loadFill,
                        {
                          width: `${Math.min(100, member.loadShare)}%`,
                          backgroundColor: accentTheme.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.loadText, { color: accentTheme.primary }]}>{member.loadShare}%</Text>
              </View>
            ))}

            <Text style={[styles.section, { color: orbitPalette.textMuted }]}>Cleaning by room</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomStrip}>
              {cleaningByRoom.map(({ room, overdue, completed, lastTitle }) => (
                <View key={room.id} style={styles.roomCard}>
                  <Text style={styles.roomEmoji}>{room.emoji}</Text>
                  <Text style={[styles.roomName, { color: orbitPalette.text }]}>{room.name}</Text>
                  <Text style={[styles.roomMeta, { color: orbitPalette.textMuted }]}>
                    {completed} done · {overdue} open
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
  section: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 8,
    textTransform: 'uppercase',
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
  avatarEmoji: { fontSize: 18 },
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
  roomEmoji: { fontSize: 22 },
  roomName: { fontSize: 14, fontWeight: '700' },
  roomMeta: { fontSize: 11 },
  roomLast: { fontSize: 11 },
});

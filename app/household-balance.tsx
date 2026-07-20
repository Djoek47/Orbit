import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { orbitColors } from '@/constants/orbit-theme';
import { memberDisplayEmoji } from '@/lib/game-levels';
import { useOrbit } from '@/store/orbit-store';

export default function HouseholdBalanceScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, household, metrics } = useOrbit();
  const sorted = useMemo(
    () => [...household.members].sort((a, b) => b.loadShare - a.loadShare),
    [household.members],
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

  const hero = [
    {
      key: 'completion',
      label: 'Completion',
      value: `${metrics.taskCompletionRate}%`,
      hint: 'Task completion',
      color: accentTheme.primary,
    },
    {
      key: 'grocery',
      label: 'Grocery Load',
      value: `${metrics.groceryReadiness}%`,
      hint: 'Stock readiness',
      color: orbitColors.novaCyan,
    },
    {
      key: 'plan',
      label: 'Plan Load',
      value: `${metrics.calendarCoverage}%`,
      hint: 'Schedule coverage',
      color: orbitColors.planPurple,
    },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.handle} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="close" size={18} color={orbitColors.textMuted} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Household</Text>
          <Text style={styles.title}>Household Health</Text>
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
              <Text style={styles.heroValue}>{item.value}</Text>
              <Text style={styles.heroHint}>{item.hint}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>Member load</Text>
        {sorted.map((member) => (
          <View key={member.id} style={styles.memberCard}>
            <View style={[styles.avatar, { backgroundColor: `${accentTheme.primary}22` }]}>
              <Text style={styles.avatarEmoji}>{memberDisplayEmoji(member)}</Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberMeta}>
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

        <Text style={styles.section}>Cleaning by room</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomStrip}>
          {cleaningByRoom.map(({ room, overdue, completed, lastTitle }) => (
            <View key={room.id} style={styles.roomCard}>
              <Text style={styles.roomEmoji}>{room.emoji}</Text>
              <Text style={styles.roomName}>{room.name}</Text>
              <Text style={styles.roomMeta}>
                {completed} done · {overdue} open
              </Text>
              <Text style={styles.roomLast} numberOfLines={2}>
                {lastTitle ? `Last: ${lastTitle}` : 'No completed cleans yet'}
              </Text>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A1525' },
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  kicker: {
    color: orbitColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { color: orbitColors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  content: { padding: 16, gap: 12 },
  heroRow: { flexDirection: 'row', gap: 10 },
  heroCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    gap: 4,
  },
  heroLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  heroValue: { color: orbitColors.text, fontSize: 22, fontWeight: '800' },
  heroHint: { color: orbitColors.textSubtle, fontSize: 11 },
  section: {
    color: orbitColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 22 },
  memberInfo: { flex: 1, gap: 6 },
  memberName: { color: orbitColors.text, fontSize: 15, fontWeight: '700' },
  memberMeta: { color: orbitColors.textMuted, fontSize: 12 },
  loadTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  loadFill: { height: 8, borderRadius: 999 },
  loadText: { fontSize: 14, fontWeight: '800' },
  roomStrip: { gap: 10, paddingVertical: 2 },
  roomCard: {
    width: 148,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 14,
    gap: 4,
  },
  roomEmoji: { fontSize: 22 },
  roomName: { color: orbitColors.text, fontSize: 14, fontWeight: '700' },
  roomMeta: { color: orbitColors.novaCyan, fontSize: 11, fontWeight: '700' },
  roomLast: { color: orbitColors.textSubtle, fontSize: 11, lineHeight: 15, marginTop: 2 },
});

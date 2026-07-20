import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from '@/components/orbit/glass-card';
import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { NovaOrb } from '@/components/orbit/nova-orb';
import { HEADER_CHIPS_GUTTER, orbitRadius, orbitScreen } from '@/constants/orbit-theme';
import { MEMBER_ACCENTS, isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { useOrbit } from '@/store/orbit-store';

const WEEK_XP_COLORS = ['#38BDF8', '#34D399', '#A78BFA', '#FB923C', '#F472B6'];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, household, metrics, novaBriefing, currentMember } = useOrbit();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const tasks = household.tasks.slice(0, 4);
  const doneTasks = household.tasks.filter((t) => t.status === 'Completed').length;
  const totalTasks = Math.max(1, household.tasks.length);
  const pct = Math.round((doneTasks / totalTasks) * 100);
  const groceryEmoji: Record<string, string> = {
    Milk: '🥛',
    Blueberries: '🫐',
    'Paper towels': '🧻',
    'Paper Towels': '🧻',
  };
  const groceryAlerts = household.groceries
    .filter((g) => g.status === 'Missing' || g.status === 'Low')
    .slice(0, 3);
  const events = [
    ...household.events.filter(
      (e) => e.date === 'Today' || (e.startsAt ?? '').startsWith(new Date().toISOString().slice(0, 10))
    ),
    ...household.events,
  ]
    .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
    .slice(0, 3);

  const weekLeaders = useMemo(() => {
    return household.members
      .filter((member) => member.status === 'active' && member.role !== 'guest')
      .slice()
      .sort((a, b) => (b.weekXp ?? 0) - (a.weekXp ?? 0));
  }, [household.members]);

  const maxWeekXp = Math.max(1, ...weekLeaders.map((member) => member.weekXp ?? 0));
  const headerAvatar = currentMember
    ? memberDisplayEmoji(currentMember)
    : household.greetingName.slice(0, 1);
  const headerIsPhoto = isAvatarImageUri(currentMember?.avatar);

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={[
        orbitScreen.content,
        styles.pageContent,
        { paddingTop: Math.max(44, insets.top + 40) },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      <View style={[styles.headerRow, { paddingRight: HEADER_CHIPS_GUTTER }]}>
        <View style={styles.headerCopy}>
          <ChoremaxxBadge />
          <Text style={[styles.eyebrow, { marginTop: 8 }]}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <Text style={styles.h1} numberOfLines={1}>
            {greeting}, {household.greetingName}
          </Text>
        </View>
        <LinearGradient
          colors={[accentTheme.primary, accentTheme.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}>
          {headerIsPhoto && currentMember?.avatar ? (
            <Image source={{ uri: currentMember.avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{headerAvatar}</Text>
          )}
        </LinearGradient>
      </View>

      <Pressable onPress={() => router.push('/(tabs)/nova' as never)} style={styles.fullBleed}>
        <LinearGradient
          colors={['rgba(14,165,233,0.18)', 'rgba(6,182,212,0.10)', 'rgba(129,140,248,0.10)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroTop}>
            <NovaOrb size={56} />
            <View style={styles.heroCopy}>
              <View style={styles.novaRow}>
                <View style={styles.liveDot} />
                <Text style={styles.novaLabel}>NOVA</Text>
              </View>
              <Text style={styles.heroBody} numberOfLines={3}>
                {novaBriefing.summary}
              </Text>
            </View>
          </View>

          <View style={styles.weekHead}>
            <Text style={styles.weekTitle}>Week XP</Text>
            <Text style={styles.eyebrow}>Each household member</Text>
          </View>

          <View style={styles.weekList}>
            {weekLeaders.map((member, index) => {
              const xp = member.weekXp ?? 0;
              const color =
                MEMBER_ACCENTS[member.name]?.color ?? WEEK_XP_COLORS[index % WEEK_XP_COLORS.length];
              const widthPct = Math.max(8, Math.round((xp / maxWeekXp) * 100));
              const photo = isAvatarImageUri(member.avatar);
              return (
                <View key={member.id} style={styles.weekRow}>
                  <View style={[styles.weekAvatar, { backgroundColor: `${color}33` }]}>
                    {photo ? (
                      <Image source={{ uri: member.avatar }} style={styles.weekAvatarImage} />
                    ) : (
                      <Text style={styles.weekAvatarEmoji}>{memberDisplayEmoji(member)}</Text>
                    )}
                  </View>
                  <View style={styles.weekMeta}>
                    <View style={styles.weekNameRow}>
                      <Text style={styles.weekName} numberOfLines={1}>
                        {member.name}
                      </Text>
                      <Text style={[styles.weekXp, { color }]}>{xp} XP</Text>
                    </View>
                    <View style={styles.weekTrack}>
                      <View style={[styles.weekFill, { width: `${widthPct}%`, backgroundColor: color }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </LinearGradient>
      </Pressable>

      <GlassCard style={styles.fullBleed}>
        <View style={styles.sectionHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Today&apos;s Tasks</Text>
            <Text style={styles.eyebrow}>
              {doneTasks} of {household.tasks.length} complete
            </Text>
          </View>
          <View style={styles.pctPill}>
            <Text style={styles.pctPillText}>{pct}%</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={['#38BDF8', '#34D399']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${pct}%` }]}
          />
        </View>
        {tasks.map((task) => {
          const done = task.status === 'Completed';
          return (
            <Pressable
              key={task.id}
              style={styles.taskRow}
              onPress={() => router.push(`/task/${task.id}` as never)}>
              <View style={[styles.check, done && styles.checkDone]}>
                {done ? <MaterialIcons name="check" size={12} color="#070D1C" /> : null}
              </View>
              <Text style={[styles.taskText, done && styles.taskDone]} numberOfLines={1}>
                {task.title}
              </Text>
              <Text style={styles.assignee}>{task.assignee[0]}</Text>
            </Pressable>
          );
        })}
      </GlassCard>

      <View style={styles.grid}>
        <Pressable style={styles.halfCard} onPress={() => router.push('/(tabs)/groceries' as never)}>
          <View style={styles.halfHead}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(56,189,248,0.15)' }]}>
              <MaterialIcons name="shopping-cart" size={14} color="#38BDF8" />
            </View>
            <Text style={styles.halfTitle}>Groceries</Text>
          </View>
          {groceryAlerts.length === 0 ? (
            <Text style={styles.eyebrow}>Stocked</Text>
          ) : (
            groceryAlerts.map((g) => (
              <View key={g.id} style={styles.groceryRow}>
                <Text style={{ fontSize: 16 }}>{groceryEmoji[g.name] ?? '🛒'}</Text>
                <Text style={styles.groceryName}>{g.name}</Text>
                {g.status === 'Missing' ? <View style={styles.critDot} /> : null}
              </View>
            ))
          )}
          <Text style={styles.linkBlue}>{household.groceries.length} items</Text>
        </Pressable>

        <Pressable style={styles.halfCard} onPress={() => router.push('/(tabs)/plan' as never)}>
          <View style={styles.halfHead}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(167,139,250,0.15)' }]}>
              <MaterialIcons name="calendar-today" size={14} color="#A78BFA" />
            </View>
            <Text style={styles.halfTitle}>Upcoming</Text>
          </View>
          {events.map((ev, i) => (
            <View key={ev.id} style={styles.eventRow}>
              <View
                style={[
                  styles.eventBar,
                  { backgroundColor: i === 0 ? '#38BDF8' : i === 1 ? '#34D399' : '#A78BFA' },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {ev.title}
                </Text>
                <Text style={styles.eyebrow}>{ev.time}</Text>
              </View>
            </View>
          ))}
        </Pressable>
      </View>

      <Pressable onPress={() => router.push('/household-balance' as never)} style={styles.fullBleed}>
        <GlassCard>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Household Health</Text>
            <MaterialIcons name="chevron-right" size={14} color="#4B6080" />
          </View>
          <View style={styles.healthRow}>
            {[
              {
                label: 'Completion',
                val: metrics.taskCompletionRate,
                color: '#34D399',
                icon: 'check-circle' as const,
              },
              {
                label: 'Grocery',
                val: metrics.groceryReadiness,
                color: '#38BDF8',
                icon: 'shopping-cart' as const,
              },
              {
                label: 'Plan',
                val: metrics.calendarCoverage,
                color: '#A78BFA',
                icon: 'event' as const,
              },
            ].map((item) => (
              <View key={item.label} style={styles.healthCol}>
                <View style={styles.healthLabelRow}>
                  <MaterialIcons name={item.icon} size={12} color={item.color} />
                  <Text style={styles.healthLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${item.val}%`, backgroundColor: item.color }]} />
                </View>
                <Text style={[styles.healthVal, { color: item.color }]}>{item.val}%</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  assignee: { color: '#4B6080', fontSize: 12 },
  avatar: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 40,
  },
  avatarImage: { height: 40, width: 40 },
  avatarText: { color: '#070D1C', fontSize: 14, fontWeight: '700' },
  check: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkDone: { backgroundColor: '#34D399', borderColor: '#34D399' },
  critDot: { backgroundColor: '#F87171', borderRadius: 3, height: 6, width: 6 },
  eventBar: { borderRadius: 2, height: 28, marginTop: 2, width: 4 },
  eventRow: { flexDirection: 'row', gap: 8 },
  eventTitle: { color: '#C8D8F0', fontSize: 12, lineHeight: 16 },
  eyebrow: { color: '#4B6080', fontSize: 12 },
  fullBleed: { alignSelf: 'stretch', width: '100%' },
  groceryName: { color: '#C8D8F0', flex: 1, fontSize: 12 },
  groceryRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  grid: { alignSelf: 'stretch', flexDirection: 'row', gap: 12, width: '100%' },
  h1: { color: '#EEF2FF', fontSize: 24, fontWeight: '700', lineHeight: 29 },
  halfCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minWidth: 0,
    padding: 16,
  },
  halfHead: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 4 },
  halfTitle: { color: '#EEF2FF', fontSize: 12, fontWeight: '600' },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 8 },
  headerRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  healthCol: { alignItems: 'stretch', flex: 1, gap: 6, minWidth: 0 },
  healthLabel: { color: '#7C9CC0', flexShrink: 1, fontSize: 11, fontWeight: '600' },
  healthLabelRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  healthRow: { alignSelf: 'stretch', flexDirection: 'row', gap: 10, width: '100%' },
  healthVal: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  hero: {
    alignSelf: 'stretch',
    borderColor: 'rgba(56,189,248,0.18)',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    gap: 14,
    overflow: 'hidden',
    padding: 16,
    width: '100%',
  },
  heroBody: { color: '#C8D8F0', fontSize: 14, lineHeight: 20 },
  heroCopy: { flex: 1, gap: 4, minWidth: 0 },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  iconBox: {
    alignItems: 'center',
    borderRadius: 12,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  linkBlue: { color: '#38BDF8', fontSize: 12, fontWeight: '600', marginTop: 4 },
  liveDot: { backgroundColor: '#34D399', borderRadius: 3, height: 6, width: 6 },
  novaLabel: { color: '#34D399', fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
  novaRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  pageContent: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
    width: '100%',
  },
  pctPill: {
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pctPillText: { color: '#34D399', fontSize: 12, fontWeight: '600' },
  progressFill: {
    backgroundColor: '#38BDF8',
    borderRadius: 999,
    height: '100%',
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    height: 6,
    overflow: 'hidden',
    width: '100%',
  },
  sectionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: { color: '#EEF2FF', fontSize: 14, fontWeight: '600' },
  taskDone: { color: '#4B6080', textDecorationLine: 'line-through' },
  taskRow: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 10 },
  taskText: { color: '#C8D8F0', flex: 1, fontSize: 14 },
  weekAvatar: {
    alignItems: 'center',
    borderRadius: 14,
    height: 36,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 36,
  },
  weekAvatarEmoji: { fontSize: 16 },
  weekAvatarImage: { height: 36, width: 36 },
  weekFill: { borderRadius: 999, height: '100%' },
  weekHead: { gap: 2 },
  weekList: { gap: 10 },
  weekMeta: { flex: 1, gap: 6, minWidth: 0 },
  weekName: { color: '#EEF2FF', flex: 1, fontSize: 13, fontWeight: '600' },
  weekNameRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  weekRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  weekTitle: { color: '#EEF2FF', fontSize: 14, fontWeight: '700' },
  weekTrack: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
    width: '100%',
  },
  weekXp: { fontSize: 13, fontWeight: '800' },
});

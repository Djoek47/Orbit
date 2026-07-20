import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { MomentumRing } from '@/components/orbit/momentum-ring';
import { NovaOrb } from '@/components/orbit/nova-orb';
import { orbitRadius, orbitScreen } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function HomeScreen() {
  const { household, metrics, novaBriefing, currentMember } = useOrbit();
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
    ...household.events.filter((e) => e.date === 'Today' || (e.startsAt ?? '').startsWith(new Date().toISOString().slice(0, 10))),
    ...household.events,
  ]
    .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
    .slice(0, 3);
  const tasksFrac = metrics.taskCompletionRate / 100;
  const energyFrac = metrics.groceryReadiness / 100;
  const harmonyFrac = metrics.calendarCoverage / 100;

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      {/* Make header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <Text style={styles.h1}>
            {greeting}, {household.greetingName}
          </Text>
        </View>
        <LinearGradient colors={['#38BDF8', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
          <Text style={styles.avatarText}>{(currentMember?.avatar || household.greetingName[0] || 'S').slice(0, 1)}</Text>
        </LinearGradient>
      </View>

      {/* Nova briefing + momentum hero — Make layout */}
      <Pressable onPress={() => router.push('/(tabs)/nova' as never)}>
        <LinearGradient
          colors={['rgba(14,165,233,0.18)', 'rgba(6,182,212,0.10)', 'rgba(129,140,248,0.10)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroRow}>
            <NovaOrb size={64} />
            <View style={styles.heroCopy}>
              <View style={styles.novaRow}>
                <View style={styles.liveDot} />
                <Text style={styles.novaLabel}>NOVA</Text>
              </View>
              <Text style={styles.heroBody}>{novaBriefing.summary}</Text>
            </View>
            {/* Make MomentumRing default ~128px */}
            <MomentumRing tasks={tasksFrac} energy={energyFrac} harmony={harmonyFrac} />
          </View>
          <View style={styles.metricRow}>
            {[
              { label: 'Tasks', value: `${metrics.taskCompletionRate}%`, color: '#38BDF8' },
              { label: 'Grocery', value: `${metrics.groceryReadiness}%`, color: '#34D399' },
              { label: 'Plan', value: `${metrics.calendarCoverage}%`, color: '#A78BFA' },
            ].map((m) => (
              <View key={m.label} style={styles.metricItem}>
                <View style={[styles.metricDot, { backgroundColor: m.color }]} />
                <Text style={styles.metricText}>
                  {m.label} <Text style={{ color: m.color, fontWeight: '600' }}>{m.value}</Text>
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </Pressable>

      {/* Today's Tasks */}
      <GlassCard>
        <View style={styles.sectionHead}>
          <View>
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

      {/* Groceries + Upcoming — 2-col Make grid */}
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

      {/* Household Health */}
      <Pressable onPress={() => router.push('/household-balance' as never)}>
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
                label: 'Grocery Load',
                val: metrics.groceryReadiness,
                color: '#38BDF8',
                icon: 'shopping-cart' as const,
              },
              {
                label: 'Plan Load',
                val: metrics.calendarCoverage,
                color: '#A78BFA',
                icon: 'event' as const,
              },
            ].map((item) => (
              <View key={item.label} style={{ flex: 1 }}>
                <View style={styles.healthLabelRow}>
                  <MaterialIcons name={item.icon} size={11} color={item.color} />
                  <Text style={styles.metricText}>{item.label}</Text>
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
    width: 40,
  },
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
  groceryName: { color: '#C8D8F0', flex: 1, fontSize: 12 },
  groceryRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  grid: { flexDirection: 'row', gap: 12 },
  h1: { color: '#EEF2FF', fontSize: 24, fontWeight: '700', lineHeight: 29 },
  halfCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    padding: 16,
  },
  halfHead: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 4 },
  halfTitle: { color: '#EEF2FF', fontSize: 12, fontWeight: '600' },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  healthLabelRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginBottom: 6 },
  healthRow: { flexDirection: 'row', gap: 12 },
  healthVal: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  hero: {
    borderColor: 'rgba(56,189,248,0.18)',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
    padding: 16,
  },
  heroBody: { color: '#C8D8F0', fontSize: 14, lineHeight: 20 },
  heroCopy: { flex: 1, gap: 4, minWidth: 0 },
  heroRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  iconBox: {
    alignItems: 'center',
    borderRadius: 12,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  linkBlue: { color: '#38BDF8', fontSize: 12, fontWeight: '600', marginTop: 4 },
  liveDot: { backgroundColor: '#34D399', borderRadius: 3, height: 6, width: 6 },
  metricDot: { borderRadius: 4, height: 8, width: 8 },
  metricItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricText: { color: '#7C9CC0', fontSize: 12 },
  novaLabel: { color: '#34D399', fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
  novaRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
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
});

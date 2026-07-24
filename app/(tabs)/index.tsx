import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { NovaOrb } from '@/components/orbit/nova-orb';
import { PersonaSwitchPopup } from '@/components/orbit/persona-switch-popup';
import { TodayTasksCard } from '@/components/orbit/today-tasks-card';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { orbitRadius, orbitScreen } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import {
  buildHomeHealthMetrics,
  resolveHomeHealthRole,
} from '@/lib/home-health-metrics';
import {
  findSharedDeviceForMember,
  isSharedDeviceAccount,
  isSharedDeviceRole,
} from '@/lib/household/shared-device';
import { useOrbit } from '@/store/orbit-store';

export default function HomeScreen() {
  const chromePad = useTabChromePaddingTop(8);
  const { accentTheme, awardDailyStreak, household, metrics, novaBriefing, currentMember, switchPersona, permissions } =
    useOrbit();
  const [personaSwitchOpen, setPersonaSwitchOpen] = useState(false);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = currentMember?.name ?? household.greetingName;
  const typeStyle = accentTheme.typeStyle;
  const sharedDevice = findSharedDeviceForMember(currentMember?.id, household.members);
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
      .filter(
        (member) =>
          member.status === 'active' &&
          member.role !== 'guest' &&
          !isSharedDeviceRole(member.role)
      )
      .slice()
      .sort((a, b) => (b.weekXp ?? 0) - (a.weekXp ?? 0));
  }, [household.members]);

  const maxWeekXp = Math.max(1, ...weekLeaders.map((member) => member.weekXp ?? 0));
  const headerAvatar = currentMember
    ? memberDisplayEmoji(currentMember)
    : household.greetingName.slice(0, 1);
  const headerIsPhoto = isAvatarImageUri(currentMember?.avatar);
  const personalWeekXp = currentMember?.weekXp ?? 0;
  const personalTotalXp = currentMember?.xp ?? 0;
  const personalStreak = currentMember?.streak ?? 0;

  return (
    <>
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={[
        orbitScreen.content,
        styles.pageContent,
        { paddingTop: chromePad },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      {/* Greeting under sticky brand chrome */}
      <View style={styles.brandBlock}>
        <Text
          style={[
            styles.dateLine,
            { fontWeight: typeStyle.captionWeight, letterSpacing: typeStyle.letterSpacing + 0.35 },
          ]}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        <Text
          style={[
            styles.greetingLine,
            {
              fontWeight: typeStyle.titleWeight,
              letterSpacing: typeStyle.letterSpacing,
            },
          ]}
          numberOfLines={1}>
          {greeting},{' '}
          <Text
            style={[
              styles.nameInline,
              { fontWeight: typeStyle.titleWeight, color: accentTheme.primary },
            ]}>
            {displayName}
          </Text>
        </Text>
        {sharedDevice ? (
          <Pressable
            onPress={() => {
              void import('@/lib/device/device-session').then(({ markNeedsProfilePick }) =>
                markNeedsProfilePick().then(() => router.push('/select-profile' as never))
              );
            }}
            style={[
              styles.deviceSwitchChip,
              {
                alignSelf: 'flex-start',
                marginTop: 6,
                backgroundColor: `${accentTheme.primary}22`,
                borderColor: `${accentTheme.primary}66`,
              },
            ]}>
            <Text style={styles.deviceSwitchEmoji}>{sharedDevice.avatar || '📱'}</Text>
            <Text style={[styles.deviceSwitchName, { color: accentTheme.primary }]}>
              Switch who&apos;s on · {displayName}
            </Text>
            <MaterialIcons name="expand-more" size={18} color={accentTheme.primary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.fullBleed}>
        <LinearGradient
          colors={['rgba(14,165,233,0.18)', 'rgba(6,182,212,0.10)', 'rgba(129,140,248,0.10)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroTop}>
            {/* Profile matches Nova orb size exactly and covers it. Tap to switch persona. */}
            <Pressable
              onPress={() => setPersonaSwitchOpen(true)}
              style={styles.heroIdentity}
              accessibilityRole="button"
              accessibilityLabel="Switch account">
              <NovaOrb size={56} />
              <LinearGradient
                colors={[accentTheme.primary, accentTheme.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.profileOnNova}>
                {headerIsPhoto && currentMember?.avatar ? (
                  <Image source={{ uri: currentMember.avatar }} style={styles.profileOnNovaImage} />
                ) : (
                  <Text style={styles.profileOnNovaText}>{headerAvatar}</Text>
                )}
              </LinearGradient>
            </Pressable>
            <Pressable
              style={styles.heroCopy}
              onPress={() => router.push('/(tabs)/nova' as never)}
              accessibilityRole="button"
              accessibilityLabel="Open Nova">
              <View style={styles.novaRow}>
                <View style={styles.liveDot} />
                <Text style={styles.novaLabel}>NOVA</Text>
              </View>
              <Text style={styles.heroBody} numberOfLines={3}>
                {novaBriefing.summary}
              </Text>
            </Pressable>
          </View>

          {sharedKidMode ? (
            <View style={styles.personalXpRow}>
              <View style={[styles.personalXpChip, { borderColor: `${accentTheme.primary}55` }]}>
                <Text style={styles.personalXpLabel}>This week</Text>
                <Text style={[styles.personalXpValue, { color: accentTheme.primary }]}>
                  {personalWeekXp} XP
                </Text>
              </View>
              <View style={[styles.personalXpChip, { borderColor: `${accentTheme.primary}55` }]}>
                <Text style={styles.personalXpLabel}>Total</Text>
                <Text style={[styles.personalXpValue, { color: accentTheme.primary }]}>
                  {personalTotalXp} XP
                </Text>
              </View>
              <View style={[styles.personalXpChip, { borderColor: `${accentTheme.primary}55` }]}>
                <Text style={styles.personalXpLabel}>Streak</Text>
                <Text style={[styles.personalXpValue, { color: accentTheme.primary }]}>
                  {personalStreak}d
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.weekBoard}>
              <View style={styles.weekHead}>
                <Text style={styles.weekTitle}>This week</Text>
                <Pressable onPress={() => router.push('/(tabs)/rewards' as never)} hitSlop={8}>
                  <Text style={[styles.weekLink, { color: accentTheme.primary }]}>Ranks</Text>
                </Pressable>
              </View>
              <View style={styles.weekList}>
                {weekLeaders.slice(0, 5).map((member, index) => {
                  const xp = member.weekXp ?? 0;
                  const widthPct = Math.max(6, Math.round((xp / maxWeekXp) * 100));
                  const photo = isAvatarImageUri(member.avatar);
                  const lead = index === 0;
                  return (
                    <View key={member.id} style={[styles.weekRow, lead && styles.weekRowLead]}>
                      <Text style={[styles.weekRank, lead && { color: accentTheme.primary }]}>
                        {index + 1}
                      </Text>
                      <View
                        style={[
                          styles.weekAvatar,
                          lead && { borderColor: `${accentTheme.primary}66`, borderWidth: 1.5 },
                        ]}>
                        {photo ? (
                          <Image source={{ uri: member.avatar }} style={styles.weekAvatarImage} />
                        ) : (
                          <Text style={styles.weekAvatarEmoji}>{memberDisplayEmoji(member)}</Text>
                        )}
                      </View>
                      <View style={styles.weekMeta}>
                        <Text style={[styles.weekName, lead && styles.weekNameLead]} numberOfLines={1}>
                          {member.name}
                        </Text>
                        <View style={styles.weekTrack}>
                          <View
                            style={[
                              styles.weekFill,
                              {
                                width: `${widthPct}%`,
                                backgroundColor: lead ? accentTheme.primary : 'rgba(255,255,255,0.28)',
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={[styles.weekXp, lead && { color: accentTheme.primary }]}>
                        {xp}
                        <Text style={styles.weekXpUnit}> XP</Text>
                      </Text>
                    </View>
                  );
                })}
              </View>
              {weekLeaders.length > 5 ? (
                <Text style={styles.weekMore}>+{weekLeaders.length - 5} more on Ranks</Text>
              ) : null}
            </View>
          )}
        </LinearGradient>
      </View>

      <TodayTasksCard
        tasks={household.tasks}
        members={household.members}
        currentMember={currentMember}
        accentTheme={accentTheme}
        mineOnly={sharedKidMode}
        streak={currentMember?.streak ?? 0}
        onAwardDailyStreak={() => {
          void awardDailyStreak();
        }}
      />

      {sharedKidMode ? (
        <>
          <Pressable onPress={() => router.push('/household-balance' as never)} style={styles.fullBleed}>
            <GlassCard>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>My progress</Text>
                <MaterialIcons name="chevron-right" size={14} color="#4B6080" />
              </View>
              <View style={styles.healthRow}>
                {healthItems.map((item) => (
                  <View key={item.key} style={styles.healthCol}>
                    <View style={styles.healthLabelRow}>
                      <MaterialIcons name={item.icon} size={12} color={item.color} />
                      <Text style={styles.healthLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.max(4, Math.min(100, item.val))}%`, backgroundColor: item.color },
                        ]}
                      />
                    </View>
                    <Text style={[styles.healthVal, { color: item.color }]}>{item.valueLabel}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/rewards' as never)}
            style={[styles.kidRewardCard, { borderColor: `${accentTheme.primary}44` }]}>
            <View style={[styles.kidRewardIcon, { backgroundColor: `${accentTheme.primary}22` }]}>
              <MaterialIcons name="card-giftcard" size={22} color={accentTheme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kidRewardTitle}>Rewards shop</Text>
              <Text style={styles.kidRewardBody}>
                Spend your XP on treats — you have {personalTotalXp} XP
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={accentTheme.primary} />
          </Pressable>
        </>
      ) : null}

      {!sharedKidMode ? (
        <>
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
                {healthItems.map((item) => (
                  <View key={item.key} style={styles.healthCol}>
                    <View style={styles.healthLabelRow}>
                      <MaterialIcons name={item.icon} size={12} color={item.color} />
                      <Text style={styles.healthLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.max(4, Math.min(100, item.val))}%`, backgroundColor: item.color },
                        ]}
                      />
                    </View>
                    <Text style={[styles.healthVal, { color: item.color }]}>{item.valueLabel}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          </Pressable>
        </>
      ) : null}
    </ScrollView>

    <PersonaSwitchPopup
      visible={personaSwitchOpen}
      onClose={() => setPersonaSwitchOpen(false)}
      members={household.members}
      currentMemberId={currentMember?.id ?? ''}
      onSwitch={switchPersona}
    />
    </>
  );
}

const styles = StyleSheet.create({
  assignee: { color: '#4B6080', fontSize: 12 },
  avatar: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 36,
  },
  avatarImage: { height: 36, width: 36 },
  avatarText: { color: '#070D1C', fontSize: 14, fontWeight: '700' },
  brandBlock: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    gap: 6,
    marginBottom: 4,
    width: '100%',
  },
  personalXpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  personalXpChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  kidRewardCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  kidRewardIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  kidRewardTitle: {
    color: '#EEF2FF',
    fontSize: 16,
    fontWeight: '700',
  },
  kidRewardBody: {
    color: '#7C9CC0',
    fontSize: 13,
    marginTop: 2,
  },
  personalXpLabel: {
    color: '#6B82A3',
    fontSize: 11,
    fontWeight: '600',
  },
  personalXpValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  deviceSwitchChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deviceSwitchEmoji: { fontSize: 16 },
  deviceSwitchName: {
    color: '#C8D8F0',
    fontSize: 12,
    fontWeight: '700',
  },
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
  dateLine: {
    color: '#6B82A3',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.35,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  eventBar: { borderRadius: 2, height: 28, marginTop: 2, width: 4 },
  eventRow: { flexDirection: 'row', gap: 8 },
  eventTitle: { color: '#C8D8F0', fontSize: 12, lineHeight: 16 },
  eyebrow: { color: '#4B6080', fontSize: 12 },
  fullBleed: { alignSelf: 'stretch', width: '100%' },
  greetingLine: {
    color: '#C5D4E8',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  groceryName: { color: '#C8D8F0', flex: 1, fontSize: 12 },
  groceryRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  grid: { alignSelf: 'stretch', flexDirection: 'row', gap: 12, width: '100%' },
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
  nameInline: {
    color: '#F4F7FF',
    fontWeight: '800',
  },
  heroIdentity: {
    alignItems: 'center',
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  profileOnNova: {
    alignItems: 'center',
    borderColor: 'rgba(6,182,212,0.55)',
    borderRadius: 28,
    borderWidth: 2,
    height: 56,
    justifyContent: 'center',
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    width: 56,
    zIndex: 2,
  },
  profileOnNovaImage: { height: 56, width: 56 },
  profileOnNovaText: { color: '#070D1C', fontSize: 22, fontWeight: '700' },
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'transparent',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 32,
  },
  weekAvatarEmoji: { fontSize: 14 },
  weekAvatarImage: { height: 32, width: 32 },
  weekBoard: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  weekFill: { borderRadius: 999, height: '100%' },
  weekHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekLink: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  weekList: { gap: 8 },
  weekMeta: { flex: 1, gap: 5, minWidth: 0 },
  weekMore: {
    color: '#4B6080',
    fontSize: 12,
    fontWeight: '500',
    marginTop: -2,
  },
  weekName: {
    color: '#C8D8F0',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  weekNameLead: {
    color: '#F4F7FF',
    fontWeight: '700',
  },
  weekRank: {
    color: '#4B6080',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    textAlign: 'center',
    width: 16,
  },
  weekRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 36,
  },
  weekRowLead: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    marginHorizontal: -6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  weekTitle: {
    color: '#EEF2FF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  weekTrack: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    height: 3,
    overflow: 'hidden',
    width: '100%',
  },
  weekXp: {
    color: '#7C9CC0',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: -0.2,
    minWidth: 44,
    textAlign: 'right',
  },
  weekXpUnit: {
    color: '#4B6080',
    fontSize: 10,
    fontWeight: '600',
  },
});

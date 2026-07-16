import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatHouseholdRole } from '@/lib/permissions';
import { useOrbit } from '@/store/orbit-store';

const PANEL_BG = '#0A1525';

const ACCENT_THEMES = [
  { id: 'ocean', label: 'Ocean', primary: '#38BDF8', secondary: '#0EA5E9' },
  { id: 'aurora', label: 'Aurora', primary: '#34D399', secondary: '#059669' },
  { id: 'cosmic', label: 'Cosmic', primary: '#A78BFA', secondary: '#7C3AED' },
  { id: 'sunset', label: 'Sunset', primary: '#FB923C', secondary: '#EA580C' },
  { id: 'rose', label: 'Rose', primary: '#F472B6', secondary: '#EC4899' },
] as const;

type Section = 'main' | 'members' | 'notifications';

/** Make AdminScreen.tsx — Settings sheet chrome. */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    currentMember,
    currentUser,
    deleteAccount,
    household,
    permissions,
    signOut,
    switchPersona,
    updateNotificationPrefs,
  } = useOrbit();

  const [section, setSection] = useState<Section>('main');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(household.householdName);
  const [themeId, setThemeId] = useState('ocean');
  const prefs = household.notificationPrefs ?? {
    tasks: true,
    itinerary: true,
    groceries: true,
    rewards: true,
    deals: true,
    plans: true,
    xpFairness: true,
  };

  const enabledCount = useMemo(
    () => Object.values(prefs).filter(Boolean).length,
    [prefs]
  );

  const handleDelete = () => {
    Alert.alert('Delete account', 'This permanently removes your Orbit account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAccount();
          router.replace('/welcome' as never);
        },
      },
    ]);
  };

  return (
    <View style={[styles.shell, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.handleRow}>
        <View style={styles.handle} />
      </View>

      <View style={styles.header}>
        {section !== 'main' ? (
          <Pressable style={styles.backRow} onPress={() => setSection('main')}>
            <Text style={styles.backChevron}>‹</Text>
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.titleRow}>
            <LinearGradient colors={['#38BDF8', '#0EA5E9']} style={styles.zapBox}>
              <MaterialIcons name="bolt" size={16} color="#070D1C" />
            </LinearGradient>
            <Text style={styles.title}>Settings</Text>
          </View>
        )}
        <Pressable style={styles.close} onPress={() => router.back()}>
          <MaterialIcons name="close" size={16} color="#7C9CC0" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {section === 'main' ? (
          <>
            <SectionCard title="Household">
              <View style={styles.rowBetween}>
                {editingName ? (
                  <TextInput
                    value={nameInput}
                    onChangeText={setNameInput}
                    style={styles.nameInput}
                    autoFocus
                    onSubmitEditing={() => setEditingName(false)}
                  />
                ) : (
                  <Text style={styles.nameText}>{household.householdName}</Text>
                )}
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => {
                    if (editingName) {
                      setEditingName(false);
                    } else {
                      setNameInput(household.householdName);
                      setEditingName(true);
                    }
                  }}>
                  <MaterialIcons
                    name={editingName ? 'check' : 'edit'}
                    size={14}
                    color={editingName ? '#34D399' : '#38BDF8'}
                  />
                </Pressable>
              </View>
              <Text style={styles.caption}>
                Viewing as {currentMember?.name ?? currentUser?.email ?? household.greetingName}
                {currentMember ? ` · ${formatHouseholdRole(currentMember.role)}` : ''}
              </Text>
            </SectionCard>

            <SectionCard title="App Theme">
              <View style={styles.themeRow}>
                {ACCENT_THEMES.map((theme) => {
                  const active = themeId === theme.id;
                  return (
                    <Pressable
                      key={theme.id}
                      style={styles.themeItem}
                      onPress={() => setThemeId(theme.id)}>
                      <LinearGradient
                        colors={[theme.primary, theme.secondary]}
                        style={[
                          styles.themeSwatch,
                          active && {
                            borderColor: theme.primary,
                            borderWidth: 2,
                            shadowColor: theme.primary,
                            shadowOpacity: 0.35,
                            shadowRadius: 8,
                          },
                        ]}>
                        {active ? <MaterialIcons name="check" size={16} color="#fff" /> : null}
                      </LinearGradient>
                      <Text style={[styles.themeLabel, active && { color: theme.primary, fontWeight: '600' }]}>
                        {theme.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </SectionCard>

            <SettingsRow
              emoji="👥"
              label="Manage Members"
              subtitle={`${household.members.length} family members`}
              onPress={() => setSection('members')}
            />
            <SettingsRow
              icon="notifications-none"
              iconColor="#A78BFA"
              label="Notifications"
              subtitle={`${enabledCount} alerts enabled`}
              onPress={() => setSection('notifications')}
            />
            <SettingsRow
              icon="shield"
              iconColor="#34D399"
              label="Privacy & Data"
              subtitle="Manage your data"
              onPress={() =>
                Alert.alert('Privacy', 'Export and delete live under Account below.')
              }
            />
            {permissions.canInviteMembers ? (
              <SettingsRow
                emoji="✉️"
                label="Invite"
                subtitle={`Code ${household.inviteCode || '—'}`}
                onPress={() => router.push('/invite-household' as never)}
              />
            ) : null}
            <SettingsRow
              emoji="🛒"
              label="Groceries"
              subtitle="List, scan, preferred store"
              onPress={() => router.push('/(tabs)/groceries' as never)}
            />

            <SectionCard title="Appearance">
              <View style={styles.rowBetween}>
                <View style={styles.inline}>
                  <MaterialIcons name="dark-mode" size={16} color="#A78BFA" />
                  <Text style={styles.rowLabel}>Dark Mode</Text>
                </View>
                <LinearGradient colors={['#38BDF8', '#0EA5E9']} style={styles.switchOn}>
                  <View style={styles.switchKnob} />
                </LinearGradient>
              </View>
            </SectionCard>

            <SectionCard title="Account">
              <Pressable
                style={styles.accountBtn}
                onPress={async () => {
                  await signOut();
                  router.replace('/welcome' as never);
                }}>
                <Text style={styles.accountBtnText}>Sign out</Text>
              </Pressable>
              <Pressable style={styles.accountBtn} onPress={handleDelete}>
                <Text style={[styles.accountBtnText, { color: '#F87171' }]}>Delete account</Text>
              </Pressable>
            </SectionCard>

            <View style={styles.brand}>
              <LinearGradient colors={['#38BDF8', '#0EA5E9']} style={styles.brandIcon}>
                <Text style={{ fontSize: 20 }}>🏠</Text>
              </LinearGradient>
              <Text style={styles.brandName}>Orbit</Text>
              <Text style={styles.brandMeta}>Version 1.0.0 · AI Household OS</Text>
            </View>
          </>
        ) : null}

        {section === 'members' ? (
          <>
            <Text style={styles.sectionHint}>Tap a member to view as them (demo)</Text>
            {household.members.map((member) => {
              const active = currentMember?.id === member.id;
              return (
                <Pressable
                  key={member.id}
                  style={styles.memberCard}
                  onPress={() => switchPersona(member.id)}>
                  <View
                    style={[
                      styles.memberAvatar,
                      { backgroundColor: `${active ? '#38BDF8' : '#4B6080'}33` },
                    ]}>
                    <Text style={styles.memberAvatarText}>{member.avatar}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.caption}>{formatHouseholdRole(member.role)}</Text>
                    <Text style={[styles.caption, { color: '#38BDF8', fontWeight: '600' }]}>
                      {member.xp} XP total
                    </Text>
                  </View>
                  {active ? <MaterialIcons name="check-circle" size={18} color="#34D399" /> : null}
                </Pressable>
              );
            })}
            <Pressable style={styles.linkRow} onPress={() => router.push('/household-members' as never)}>
              <Text style={styles.linkText}>Open full members screen</Text>
              <MaterialIcons name="chevron-right" size={16} color="#38BDF8" />
            </Pressable>
          </>
        ) : null}

        {section === 'notifications' ? (
          <>
            <Text style={styles.sectionHint}>Nova Monitor categories</Text>
            {(
              [
                ['tasks', 'Task Reminders', 'Overdue nudges and streak checks', '✅'],
                ['itinerary', 'Itinerary legs', 'Arrived → next and trip nudges', '🗺️'],
                ['groceries', 'Grocery & sales', 'Missing items and aisle deals', '🛒'],
                ['rewards', 'Rewards', 'Redemptions and XP milestones', '🎁'],
                ['deals', 'Deal alerts', 'Mock catalog: food, shoes, electronics, furniture', '🏷️'],
                ['plans', 'Plan proposals', 'Errand loops and itinerary suggestions', '🗺️'],
                ['xpFairness', 'XP fairness', 'Weekly balance assessments (propose only)', '⚖️'],
              ] as const
            ).map(([key, label, sub, emoji]) => (
              <View key={key} style={styles.prefRow}>
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{label}</Text>
                  <Text style={styles.caption}>{sub}</Text>
                </View>
                <Switch
                  value={Boolean(prefs[key])}
                  onValueChange={(value) => updateNotificationPrefs({ [key]: value })}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#38BDF8' }}
                  thumbColor="#fff"
                />
              </View>
            ))}
            <Pressable style={styles.linkRow} onPress={() => router.push('/notifications' as never)}>
              <Text style={styles.linkText}>Open notifications inbox</Text>
              <MaterialIcons name="chevron-right" size={16} color="#38BDF8" />
            </Pressable>
            <Pressable style={styles.linkRow} onPress={() => router.push('/(tabs)/nova' as never)}>
              <Text style={styles.linkText}>Open Nova · Run check</Text>
              <MaterialIcons name="chevron-right" size={16} color="#38BDF8" />
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardEyebrow}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function SettingsRow({
  emoji,
  icon,
  iconColor,
  label,
  subtitle,
  onPress,
}: {
  emoji?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.settingsRow} onPress={onPress}>
      <View style={styles.settingsIcon}>
        {emoji ? (
          <Text style={{ fontSize: 18 }}>{emoji}</Text>
        ) : (
          <MaterialIcons name={icon!} size={16} color={iconColor ?? '#7C9CC0'} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.memberName}>{label}</Text>
        <Text style={styles.caption}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={16} color="#4B6080" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: PANEL_BG,
    flex: 1,
  },
  handleRow: { alignItems: 'center', paddingBottom: 4, paddingTop: 12 },
  handle: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    height: 4,
    width: 40,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  zapBox: {
    alignItems: 'center',
    borderRadius: 12,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  title: { color: '#EEF2FF', fontSize: 18, fontWeight: '700' },
  close: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  backRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  backChevron: { color: '#38BDF8', fontSize: 22, lineHeight: 24 },
  backLabel: { color: '#38BDF8', fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { gap: 12, paddingBottom: 40, paddingHorizontal: 20 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  cardEyebrow: {
    color: '#7C9CC0',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  nameText: { color: '#EEF2FF', flex: 1, fontSize: 16, fontWeight: '600' },
  nameInput: {
    borderBottomColor: 'rgba(56,189,248,0.4)',
    borderBottomWidth: 1,
    color: '#EEF2FF',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
    paddingVertical: 4,
  },
  iconBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderRadius: 12,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  caption: { color: '#4B6080', fontSize: 12 },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  themeItem: { alignItems: 'center', gap: 6 },
  themeSwatch: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  themeLabel: { color: '#4B6080', fontSize: 12 },
  settingsRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  settingsIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  inline: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  rowLabel: { color: '#EEF2FF', fontSize: 14 },
  switchOn: {
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 4,
    width: 48,
  },
  switchKnob: {
    alignSelf: 'flex-end',
    backgroundColor: '#fff',
    borderRadius: 10,
    height: 20,
    width: 20,
  },
  accountBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  accountBtnText: { color: '#EEF2FF', fontSize: 14, fontWeight: '600' },
  brand: { alignItems: 'center', gap: 4, paddingBottom: 16, paddingTop: 8 },
  brandIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  brandName: { color: '#EEF2FF', fontSize: 14, fontWeight: '700' },
  brandMeta: { color: '#4B6080', fontSize: 12 },
  sectionHint: { color: '#7C9CC0', fontSize: 14, paddingTop: 4 },
  memberCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  memberAvatar: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  memberAvatarText: { fontSize: 28 },
  memberName: { color: '#EEF2FF', fontSize: 14, fontWeight: '600' },
  prefRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  linkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  linkText: { color: '#38BDF8', fontSize: 14, fontWeight: '600' },
});

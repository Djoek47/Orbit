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

import { ACCENT_THEMES, AVATAR_EMOJIS, type AccentThemeId } from '@/constants/accent-themes';
import { BrandLegalFooter } from '@/components/orbit/brand-legal-footer';
import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
import { createLocalId } from '@/repositories/repository-utils';
import { formatHouseholdRole } from '@/lib/permissions';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdRoom } from '@/types/orbit';
import * as Linking from 'expo-linking';

const PANEL_BG = '#0A1525';

type Section = 'main' | 'members' | 'notifications' | 'rooms';

/** Make AdminScreen.tsx — Settings sheet chrome. */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    accentTheme,
    currentMember,
    currentUser,
    deleteAccount,
    household,
    permissions,
    removeRoom,
    signOut,
    switchPersona,
    updateAccentTheme,
    updateMemberAvatar,
    updateNotificationPrefs,
    upsertRoom,
  } = useOrbit();

  const [section, setSection] = useState<Section>('main');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(household.householdName);
  const [pickingAvatarFor, setPickingAvatarFor] = useState<string | null>(null);
  const [roomDraft, setRoomDraft] = useState('');
  const [roomEmoji, setRoomEmoji] = useState('🚪');
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const prefs = useMemo(
    () =>
      household.notificationPrefs ?? {
        tasks: true,
        itinerary: true,
        groceries: true,
        rewards: true,
        deals: true,
        plans: true,
        xpFairness: true,
      },
    [household.notificationPrefs]
  );

  const enabledCount = useMemo(() => Object.values(prefs).filter(Boolean).length, [prefs]);
  const themeId = (household.accentThemeId ?? accentTheme.id) as AccentThemeId;
  const rooms = household.rooms ?? [];

  const handleDelete = () => {
    Alert.alert('Delete account', 'This permanently removes your Choremaxx account.', [
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
            <LinearGradient colors={[accentTheme.primary, accentTheme.secondary]} style={styles.zapBox}>
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
                      onPress={() => updateAccentTheme(theme.id)}>
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
              subtitle={`${household.members.length} family members · tap avatar to customize`}
              onPress={() => setSection('members')}
            />
            <SettingsRow
              emoji="🚪"
              label="Rooms"
              subtitle={`${rooms.length} rooms for cleaning attribution`}
              onPress={() => setSection('rooms')}
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
              subtitle="Privacy · Terms · Support"
              onPress={() =>
                Alert.alert('Privacy & legal', 'Open Choremaxx legal pages', [
                  {
                    text: 'Privacy Policy',
                    onPress: () => void Linking.openURL(CHOREMAXX_LEGAL.privacyUrl),
                  },
                  {
                    text: 'Terms of Service',
                    onPress: () => void Linking.openURL(CHOREMAXX_LEGAL.termsUrl),
                  },
                  {
                    text: 'Contact support',
                    onPress: () => void Linking.openURL(`mailto:${CHOREMAXX_LEGAL.supportEmail}`),
                  },
                  { text: 'Cancel', style: 'cancel' },
                ])
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

            <BrandLegalFooter style={styles.brand} />
          </>
        ) : null}

        {section === 'members' ? (
          <>
            <Text style={styles.sectionHint}>Tap avatar to customize · tap name to view as them</Text>
            {household.members.map((member) => {
              const active = currentMember?.id === member.id;
              const picking = pickingAvatarFor === member.id;
              return (
                <View key={member.id} style={styles.memberCard}>
                  <Pressable
                    onPress={() => setPickingAvatarFor(picking ? null : member.id)}
                    style={[
                      styles.memberAvatar,
                      { backgroundColor: `${active ? accentTheme.primary : '#4B6080'}33` },
                    ]}>
                    <Text style={styles.memberAvatarText}>{member.avatar}</Text>
                    <View style={styles.avatarEditBadge}>
                      <MaterialIcons name="edit" size={10} color="#38BDF8" />
                    </View>
                  </Pressable>
                  <Pressable style={{ flex: 1 }} onPress={() => switchPersona(member.id)}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.caption}>{formatHouseholdRole(member.role)}</Text>
                    <Text style={[styles.caption, { color: accentTheme.primary, fontWeight: '600' }]}>
                      {member.xp} XP total
                    </Text>
                  </Pressable>
                  {active ? <MaterialIcons name="check-circle" size={18} color="#34D399" /> : null}
                  {picking ? (
                    <View style={styles.emojiGrid}>
                      {AVATAR_EMOJIS.map((emoji) => (
                        <Pressable
                          key={emoji}
                          style={[
                            styles.emojiChip,
                            member.avatar === emoji && {
                              borderColor: `${accentTheme.primary}88`,
                              backgroundColor: `${accentTheme.primary}22`,
                            },
                          ]}
                          onPress={async () => {
                            await updateMemberAvatar(member.id, emoji);
                            setPickingAvatarFor(null);
                          }}>
                          <Text style={{ fontSize: 22 }}>{emoji}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
            <Pressable style={styles.linkRow} onPress={() => router.push('/household-members' as never)}>
              <Text style={[styles.linkText, { color: accentTheme.primary }]}>Open full members screen</Text>
              <MaterialIcons name="chevron-right" size={16} color={accentTheme.primary} />
            </Pressable>
          </>
        ) : null}

        {section === 'rooms' ? (
          <>
            <Text style={styles.sectionHint}>Rooms power cleaning presets and attribution</Text>
            {rooms.map((room) => (
              <View key={room.id} style={styles.prefRow}>
                <Text style={{ fontSize: 22 }}>{room.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{room.name}</Text>
                  <Text style={styles.caption}>{room.kind}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setEditingRoomId(room.id);
                    setRoomDraft(room.name);
                    setRoomEmoji(room.emoji);
                  }}
                  style={{ marginRight: 10 }}>
                  <MaterialIcons name="edit" size={18} color={accentTheme.primary} />
                </Pressable>
                <Pressable onPress={() => removeRoom(room.id)}>
                  <MaterialIcons name="delete-outline" size={18} color="#F87171" />
                </Pressable>
              </View>
            ))}
            <View style={styles.emojiRow}>
              {['🚪', '🍳', '🛋️', '🚿', '🛏️', '👕', '🪴', '🧹'].map((emoji) => {
                const active = roomEmoji === emoji;
                return (
                  <Pressable
                    key={emoji}
                    onPress={() => setRoomEmoji(emoji)}
                    style={[
                      styles.emojiChip,
                      active && {
                        borderColor: `${accentTheme.primary}88`,
                        backgroundColor: `${accentTheme.primary}22`,
                      },
                    ]}>
                    <Text style={{ fontSize: 18 }}>{emoji}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.prefRow}>
              <TextInput
                value={roomDraft}
                onChangeText={setRoomDraft}
                placeholder={editingRoomId ? 'Rename room' : 'Add room name'}
                placeholderTextColor="#4B6080"
                style={styles.roomInput}
              />
              <Pressable
                style={[styles.addRoomBtn, { backgroundColor: `${accentTheme.primary}22` }]}
                onPress={() => {
                  const name = roomDraft.trim();
                  if (!name) return;
                  if (editingRoomId) {
                    const existing = rooms.find((item) => item.id === editingRoomId);
                    if (!existing) return;
                    upsertRoom({ ...existing, name, emoji: roomEmoji });
                    setEditingRoomId(null);
                  } else {
                    const room: HouseholdRoom = {
                      id: createLocalId('room'),
                      name,
                      emoji: roomEmoji,
                      kind: 'custom',
                    };
                    upsertRoom(room);
                  }
                  setRoomDraft('');
                  setRoomEmoji('🚪');
                }}>
                <MaterialIcons name={editingRoomId ? 'check' : 'add'} size={18} color={accentTheme.primary} />
              </Pressable>
            </View>
            {editingRoomId ? (
              <Pressable
                onPress={() => {
                  setEditingRoomId(null);
                  setRoomDraft('');
                  setRoomEmoji('🚪');
                }}
                style={styles.linkRow}>
                <Text style={[styles.linkText, { color: accentTheme.primary }]}>Cancel edit</Text>
              </Pressable>
            ) : null}
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
  brand: { paddingBottom: 8, paddingTop: 12 },
  sectionHint: { color: '#7C9CC0', fontSize: 14, paddingTop: 4 },
  memberCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    padding: 16,
  },
  memberAvatar: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    position: 'relative',
    width: 56,
  },
  avatarEditBadge: {
    alignItems: 'center',
    backgroundColor: '#0A1525',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    bottom: -2,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 20,
  },
  memberAvatarText: { fontSize: 28 },
  memberName: { color: '#EEF2FF', fontSize: 14, fontWeight: '600' },
  emojiGrid: {
    flexBasis: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  emojiChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  roomInput: {
    color: '#EEF2FF',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 4,
  },
  addRoomBtn: {
    alignItems: 'center',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
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

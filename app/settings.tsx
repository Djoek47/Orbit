import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ACCENT_THEMES,
  AVATAR_EMOJIS,
  DEFAULT_ACCENT_THEME_ID,
  ROOM_EMOJIS,
  type AccentThemeId,
} from '@/constants/accent-themes';
import {
  BACKGROUND_THEMES,
  type BackgroundThemeId,
} from '@/constants/background-themes';
import { BrandLegalFooter } from '@/components/orbit/brand-legal-footer';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { PersonaSwitchPopup } from '@/components/orbit/persona-switch-popup';
import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
import { createLocalId } from '@/repositories/repository-utils';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import {
  findSharedDeviceForMember,
  listSharedDevices,
  nestedSharedAccountIds,
  resolveSharedDevicePeople,
  sharedDeviceLinkCandidates,
} from '@/lib/household/shared-device';
import { ensureProfileInviteCode } from '@/lib/household/profile-codes';
import { formatHouseholdRole } from '@/lib/permissions';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import type { AppearanceMode, PreferredMapsApp } from '@/lib/theme/appearance-prefs';
import { markNeedsProfilePick } from '@/lib/device/device-session';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember, HouseholdRoom } from '@/types/orbit';
import * as Linking from 'expo-linking';

const PANEL_BG = '#0A1525';

type Section = 'main' | 'members' | 'notifications' | 'rooms';

function SharedAccountRow({
  person,
  active,
  accent,
  picking,
  canManage,
  onSwitch,
  onTogglePick,
  onPickEmoji,
  onPickPhoto,
  onUnlink,
  onRemove,
}: {
  person: HouseholdMember;
  active: boolean;
  accent: string;
  picking: boolean;
  canManage: boolean;
  onSwitch: () => void;
  onTogglePick: () => void;
  onPickEmoji: (emoji: string) => void;
  onPickPhoto: () => void;
  onUnlink?: () => void;
  onRemove?: () => void;
}) {
  const photo = isAvatarImageUri(person.avatar);
  return (
    <View style={styles.sharedAccountBlock}>
      <View style={styles.memberCardInner}>
        <Pressable
          onPress={onTogglePick}
          style={[
            styles.memberAvatar,
            { backgroundColor: `${active ? accent : '#4B6080'}33` },
          ]}>
          {photo ? (
            <Image source={{ uri: person.avatar }} style={styles.memberAvatarImage} />
          ) : (
            <Text style={styles.memberAvatarText}>{memberDisplayEmoji(person)}</Text>
          )}
          <View style={styles.avatarEditBadge}>
            <MaterialIcons name="edit" size={10} color="#38BDF8" />
          </View>
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={onSwitch}>
          <Text style={styles.memberName}>{person.name}</Text>
          <Text style={styles.caption}>Switchable account · own XP & redeem</Text>
          <Text style={[styles.caption, { color: accent, fontWeight: '600' }]}>
            {person.xp} XP · week {person.weekXp ?? 0}
          </Text>
          <Text style={styles.caption}>Code {ensureProfileInviteCode(person)}</Text>
        </Pressable>
        {active ? <MaterialIcons name="check-circle" size={18} color="#34D399" /> : null}
      </View>
      {canManage ? (
        <View style={styles.adminActionRow}>
          {onUnlink ? (
            <Pressable onPress={onUnlink} style={styles.adminActionChip}>
              <Text style={styles.adminActionText}>Unlink</Text>
            </Pressable>
          ) : null}
          {onRemove ? (
            <Pressable onPress={onRemove} style={[styles.adminActionChip, styles.adminActionDanger]}>
              <Text style={[styles.adminActionText, { color: '#F87171' }]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {picking ? (
        <View style={styles.emojiGrid}>
          <Pressable
            style={[styles.emojiChip, styles.photoChip, { borderColor: `${accent}88` }]}
            onPress={onPickPhoto}>
            <MaterialIcons name="photo-camera" size={18} color={accent} />
            <Text style={[styles.photoChipText, { color: accent }]}>Photo / Memoji</Text>
          </Pressable>
          {AVATAR_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              style={[
                styles.emojiChip,
                person.avatar === emoji && {
                  borderColor: `${accent}88`,
                  backgroundColor: `${accent}22`,
                },
              ]}
              onPress={() => onPickEmoji(emoji)}>
              <Text style={{ fontSize: 22 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Make AdminScreen.tsx — Settings sheet chrome. */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    accentTheme,
    appearanceMode,
    backgroundThemeId,
    createSharedDevice,
    currentMember,
    currentUser,
    deleteAccount,
    household,
    orbitPalette,
    permissions,
    preferredMapsApp,
    removeMember,
    removeRoom,
    signOut,
    switchPersona,
    updateAccentTheme,
    updateAppearanceMode,
    updateBackgroundTheme,
    updateHouseholdAccentTheme,
    updateMemberAvatar,
    updateNotificationPrefs,
    updateMemberCapabilities,
    updatePreferredMapsApp,
    updateSharedDeviceLinks,
    upsertRoom,
  } = useOrbit();

  const [section, setSection] = useState<Section>('main');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(household.householdName);
  const [personaSwitchOpen, setPersonaSwitchOpen] = useState(false);
  const [pickingAvatarFor, setPickingAvatarFor] = useState<string | null>(null);
  const [sharedDeviceName, setSharedDeviceName] = useState('Kids tablet');
  const [creatingDevice, setCreatingDevice] = useState(false);
  const [householdDefaultOpen, setHouseholdDefaultOpen] = useState(false);
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
        nearShop: true,
        missingOnTheWay: true,
      },
    [household.notificationPrefs]
  );

  const enabledCount = useMemo(() => Object.values(prefs).filter(Boolean).length, [prefs]);
  const personalThemeId = (currentMember?.accentThemeId ?? accentTheme.id) as AccentThemeId;
  const householdThemeId = (household.accentThemeId ?? DEFAULT_ACCENT_THEME_ID) as AccentThemeId;
  const rooms = household.rooms ?? [];
  const nestedAccountIds = useMemo(
    () => nestedSharedAccountIds(household.members),
    [household.members]
  );
  const sharedDevices = useMemo(() => listSharedDevices(household.members), [household.members]);
  /** Standalone people (not nested under a Shared tablet). */
  const topLevelMembers = useMemo(
    () =>
      household.members.filter(
        (member) =>
          member.role !== 'shared-device' && !nestedAccountIds.has(member.id)
      ),
    [household.members, nestedAccountIds]
  );
  const activeOnDevice = findSharedDeviceForMember(currentMember?.id, household.members);
  const linkCandidates = useMemo(
    () => sharedDeviceLinkCandidates(household.members),
    [household.members]
  );

  const handleRemoveMember = (member: HouseholdMember) => {
    if (member.role === 'owner') {
      Alert.alert('Cannot remove', 'The household owner cannot be removed.');
      return;
    }
    const isDevice = member.role === 'shared-device';
    Alert.alert(
      isDevice ? 'Remove shared device' : 'Remove member',
      isDevice
        ? `Remove ${member.name}? Linked profiles stay in the household but lose this device shell.`
        : `Remove ${member.name} from this household?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void removeMember(member.id);
          },
        },
      ]
    );
  };

  const handleCreateSharedDevice = () => {
    if (!sharedDeviceName.trim()) return;
    setCreatingDevice(true);
    void createSharedDevice(sharedDeviceName.trim())
      .then((created) => {
        if (created) {
          setSharedDeviceName('Kids tablet');
          Alert.alert(
            'Shared device added',
            `Link people below, then set up the tablet with their profile codes (CMX-JOSH, etc.).`
          );
        }
      })
      .finally(() => setCreatingDevice(false));
  };

  const toggleSharedLink = (deviceId: string, personId: string, linkedIds: string[]) => {
    const next = linkedIds.includes(personId)
      ? linkedIds.filter((id) => id !== personId)
      : [...linkedIds, personId];
    void updateSharedDeviceLinks(deviceId, next);
  };

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

  const pickMemojiPhoto = async (memberId: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos needed', 'Allow photo library access to use a Memoji or portrait.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await updateMemberAvatar(memberId, result.assets[0].uri);
    setPickingAvatarFor(null);
  };

  return (
    <>
    <View style={[styles.shell, { paddingTop: insets.top, backgroundColor: orbitPalette.backgroundSoft }]}>
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

      <KeyboardScreen
        offset={12}
        style={styles.scroll}
        contentContainerStyle={styles.content}>
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

            <SectionCard title="Your look">
              <Text style={[styles.caption, { color: orbitPalette.textMuted }]}>
                Personal accent for {currentMember?.name ?? 'you'} · switches with your profile
              </Text>
              <View style={styles.themeRow}>
                {ACCENT_THEMES.map((theme) => {
                  const active = personalThemeId === theme.id;
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
                      <Text style={styles.themeTypeLabel}>{theme.typeStyle.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.caption, { marginTop: 8, color: orbitPalette.textMuted }]}>
                Background · canvas that pairs with your fonts
              </Text>
              <View style={styles.themeRow}>
                {BACKGROUND_THEMES.map((theme) => {
                  const active = backgroundThemeId === theme.id;
                  return (
                    <Pressable
                      key={theme.id}
                      style={styles.themeItem}
                      onPress={() => updateBackgroundTheme(theme.id as BackgroundThemeId)}>
                      <LinearGradient
                        colors={theme.preview}
                        style={[
                          styles.themeSwatch,
                          active && {
                            borderColor: accentTheme.primary,
                            borderWidth: 2,
                          },
                        ]}>
                        {active ? (
                          <MaterialIcons name="check" size={16} color={theme.base === 'light' ? '#111' : '#fff'} />
                        ) : null}
                      </LinearGradient>
                      <Text style={[styles.themeLabel, active && { color: accentTheme.primary, fontWeight: '600' }]}>
                        {theme.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {permissions.canManageHousehold ? (
                <View style={styles.nestedGroup}>
                  <Pressable
                    style={styles.nestedHeader}
                    onPress={() => setHouseholdDefaultOpen((value) => !value)}>
                    <Text style={styles.nestedTitle}>Household default</Text>
                    <MaterialIcons
                      name={householdDefaultOpen ? 'expand-less' : 'expand-more'}
                      size={20}
                      color={orbitPalette.textMuted}
                    />
                  </Pressable>
                  {householdDefaultOpen ? (
                    <>
                      <Text style={[styles.caption, { color: orbitPalette.textMuted }]}>
                        Fallback accent for members without a personal pick
                      </Text>
                      <View style={styles.themeRow}>
                        {ACCENT_THEMES.map((theme) => {
                          const active = householdThemeId === theme.id;
                          return (
                            <Pressable
                              key={theme.id}
                              style={styles.themeItem}
                              onPress={() => updateHouseholdAccentTheme(theme.id)}>
                              <LinearGradient
                                colors={[theme.primary, theme.secondary]}
                                style={[
                                  styles.themeSwatchSmall,
                                  active && {
                                    borderColor: theme.primary,
                                    borderWidth: 2,
                                  },
                                ]}>
                                {active ? <MaterialIcons name="check" size={14} color="#fff" /> : null}
                              </LinearGradient>
                              <Text style={styles.themeTypeLabel}>{theme.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                </View>
              ) : null}
            </SectionCard>

            <SettingsRow
              emoji="👥"
              label="Manage Members"
              subtitle={`${household.members.length} members · add new · customize avatars`}
              onPress={() => setSection('members')}
            />
            <SettingsRow
              emoji="🚪"
              label="Rooms"
              subtitle={`${rooms.length} rooms for cleaning attribution`}
              onPress={() => setSection('rooms')}
            />
            {permissions.canManageHousehold ? (
              <SectionCard title="Member permissions">
                <Text style={[styles.caption, { color: orbitPalette.textMuted, marginBottom: 8 }]}>
                  What kids and non-admin members can do
                </Text>
                {(
                  [
                    ['allowRewardRedeem', 'Allow redeem XP rewards', 'Members can spend XP in the shop'],
                    ['allowSpecialRewardRequest', 'Allow special reward requests', 'Kids/adults can ask for one-offs'],
                    ['allowGroceryAdd', 'Allow grocery list adds', 'Non-admins can add items'],
                    ['allowCalendarCreate', 'Allow calendar event creates', 'Simplified create when enabled'],
                  ] as const
                ).map(([key, label, sub]) => {
                  const caps = resolveMemberCapabilities(household);
                  return (
                    <View key={key} style={styles.prefRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{label}</Text>
                        <Text style={styles.caption}>{sub}</Text>
                      </View>
                      <Switch
                        value={caps[key]}
                        onValueChange={(value) => updateMemberCapabilities({ [key]: value })}
                        trackColor={{ false: 'rgba(255,255,255,0.1)', true: accentTheme.primary }}
                        thumbColor="#fff"
                      />
                    </View>
                  );
                })}
              </SectionCard>
            ) : null}
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
            <SettingsRow
              emoji="🛒"
              label="Groceries"
              subtitle="List, scan, preferred store"
              onPress={() => router.push('/(tabs)/groceries' as never)}
            />
            <SettingsRow
              icon="place"
              iconColor="#38BDF8"
              label="Places"
              subtitle="Home, work, and stops for trips"
              onPress={() => router.push('/places' as never)}
            />

            <SectionCard title="Appearance">
              <Text style={[styles.caption, { color: orbitPalette.textMuted }]}>Mode</Text>
              <View style={styles.segmentRow}>
                {(
                  [
                    ['dark', 'Dark'],
                    ['light', 'Light'],
                    ['system', 'System'],
                  ] as const
                ).map(([mode, label]) => {
                  const active = appearanceMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => updateAppearanceMode(mode as AppearanceMode)}
                      style={[
                        styles.segmentChip,
                        active && {
                          backgroundColor: `${accentTheme.primary}28`,
                          borderColor: accentTheme.primary,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.segmentText,
                          active && { color: accentTheme.primary, fontWeight: '700' },
                        ]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.caption, { marginTop: 12, color: orbitPalette.textMuted }]}>
                Preferred maps app
              </Text>
              <View style={styles.segmentRow}>
                {(
                  [
                    ['auto', 'Auto'],
                    ['apple', 'Apple'],
                    ['google', 'Google'],
                    ['waze', 'Waze'],
                  ] as const
                ).map(([app, label]) => {
                  const active = preferredMapsApp === app;
                  return (
                    <Pressable
                      key={app}
                      onPress={() => updatePreferredMapsApp(app as PreferredMapsApp)}
                      style={[
                        styles.segmentChip,
                        active && {
                          backgroundColor: `${accentTheme.primary}28`,
                          borderColor: accentTheme.primary,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.segmentText,
                          active && { color: accentTheme.primary, fontWeight: '700' },
                        ]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
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
            <Text style={styles.sectionHint}>
              Tap a name to switch · Shared devices host Netflix-style profiles · Admins can remove
              people and add tablets
            </Text>
            {permissions.canInviteMembers ? (
              <SettingsRow
                emoji="➕"
                label="Add new member"
                subtitle="Create an invite so they can join this household"
                onPress={() => router.push('/invite-household' as never)}
              />
            ) : null}

            {permissions.canManageHousehold ? (
              <View style={styles.createDeviceCard}>
                <Text style={styles.memberName}>New shared device</Text>
                <Text style={styles.caption}>
                  Kitchen tablet, kids iPad — one device, multiple profiles with codes/QR
                </Text>
                <TextInput
                  value={sharedDeviceName}
                  onChangeText={setSharedDeviceName}
                  placeholder="e.g. Kids tablet"
                  placeholderTextColor="#4B6080"
                  style={styles.deviceNameInput}
                />
                <Pressable
                  style={[
                    styles.createDeviceBtn,
                    { backgroundColor: `${accentTheme.primary}22`, borderColor: `${accentTheme.primary}66` },
                  ]}
                  disabled={creatingDevice || !sharedDeviceName.trim()}
                  onPress={handleCreateSharedDevice}>
                  <MaterialIcons name="tablet-mac" size={16} color={accentTheme.primary} />
                  <Text style={[styles.createDeviceBtnText, { color: accentTheme.primary }]}>
                    {creatingDevice ? 'Adding…' : 'Create shared device'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.linkRow}
                  onPress={() => router.push('/setup-kid-device' as never)}>
                  <Text style={[styles.linkText, { color: accentTheme.primary }]}>
                    Set up this phone/tablet with profile codes
                  </Text>
                  <MaterialIcons name="chevron-right" size={16} color={accentTheme.primary} />
                </Pressable>
              </View>
            ) : null}

            {sharedDevices.map((device) => {
              const accounts = resolveSharedDevicePeople(device, household.members);
              const deviceActive = activeOnDevice?.id === device.id;
              const linkedIds = device.sharedWithMemberIds ?? [];
              return (
                <View
                  key={device.id}
                  style={[
                    styles.sharedDeviceCard,
                    deviceActive && { borderColor: `${accentTheme.primary}55` },
                  ]}>
                  <View style={styles.sharedDeviceHead}>
                    <Text style={styles.sharedDeviceEmoji}>{device.avatar || '📱'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{device.name}</Text>
                      <Text style={styles.caption}>
                        Shared device ·{' '}
                        {accounts.map((person) => person.name).join(' · ') || 'no accounts linked'}
                      </Text>
                    </View>
                    {accounts.length > 0 ? (
                      <Pressable
                        onPress={() => {
                          void markNeedsProfilePick().then(() =>
                            router.push('/select-profile' as never)
                          );
                        }}
                        style={[
                          styles.switchChip,
                          {
                            backgroundColor: `${accentTheme.primary}22`,
                            borderColor: `${accentTheme.primary}66`,
                          },
                        ]}>
                        <Text style={[styles.switchChipText, { color: accentTheme.primary }]}>
                          Who&apos;s in?
                        </Text>
                        <MaterialIcons name="expand-more" size={16} color={accentTheme.primary} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={styles.sharedDeviceHint}>
                    Link people below. On the tablet, scan each profile code so kids pick who they
                    are before opening the app.
                  </Text>
                  {permissions.canManageHousehold ? (
                    <View style={styles.linkWrap}>
                      {linkCandidates.map((person) => {
                        const linked = linkedIds.includes(person.id);
                        return (
                          <Pressable
                            key={person.id}
                            onPress={() => toggleSharedLink(device.id, person.id, linkedIds)}
                            style={[styles.linkChip, linked && styles.linkChipActive]}>
                            <Text
                              style={[styles.linkChipText, linked && styles.linkChipTextActive]}>
                              {person.avatar} {person.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                  {accounts.map((person) => (
                    <SharedAccountRow
                      key={person.id}
                      person={person}
                      active={currentMember?.id === person.id}
                      accent={accentTheme.primary}
                      picking={pickingAvatarFor === person.id}
                      canManage={permissions.canManageHousehold}
                      onSwitch={() => switchPersona(person.id)}
                      onTogglePick={() =>
                        setPickingAvatarFor(pickingAvatarFor === person.id ? null : person.id)
                      }
                      onPickEmoji={async (emoji) => {
                        await updateMemberAvatar(person.id, emoji);
                        setPickingAvatarFor(null);
                      }}
                      onPickPhoto={() => void pickMemojiPhoto(person.id)}
                      onUnlink={() =>
                        toggleSharedLink(
                          device.id,
                          person.id,
                          linkedIds
                        )
                      }
                      onRemove={() => handleRemoveMember(person)}
                    />
                  ))}
                  {permissions.canManageHousehold ? (
                    <Pressable
                      onPress={() => handleRemoveMember(device)}
                      style={[styles.adminActionChip, styles.adminActionDanger, { alignSelf: 'flex-start' }]}>
                      <Text style={[styles.adminActionText, { color: '#F87171' }]}>
                        Remove device
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}

            {topLevelMembers.map((member) => {
              const active = currentMember?.id === member.id;
              const picking = pickingAvatarFor === member.id;
              const photo = isAvatarImageUri(member.avatar);
              return (
                <View key={member.id} style={styles.memberCard}>
                  <Pressable
                    onPress={() => setPickingAvatarFor(picking ? null : member.id)}
                    style={[
                      styles.memberAvatar,
                      { backgroundColor: `${active ? accentTheme.primary : '#4B6080'}33` },
                    ]}>
                    {photo ? (
                      <Image source={{ uri: member.avatar }} style={styles.memberAvatarImage} />
                    ) : (
                      <Text style={styles.memberAvatarText}>{memberDisplayEmoji(member)}</Text>
                    )}
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
                    {member.profileInviteCode || member.role === 'child' ? (
                      <Text style={styles.caption}>
                        Profile {ensureProfileInviteCode(member)}
                      </Text>
                    ) : null}
                  </Pressable>
                  {active ? <MaterialIcons name="check-circle" size={18} color="#34D399" /> : null}
                  {permissions.canManageHousehold && member.role !== 'owner' ? (
                    <Pressable
                      onPress={() => handleRemoveMember(member)}
                      hitSlop={8}
                      accessibilityLabel={`Remove ${member.name}`}>
                      <MaterialIcons name="person-remove" size={20} color="#F87171" />
                    </Pressable>
                  ) : null}
                  {picking ? (
                    <View style={styles.emojiGrid}>
                      <Pressable
                        style={[styles.emojiChip, styles.photoChip, { borderColor: `${accentTheme.primary}88` }]}
                        onPress={() => void pickMemojiPhoto(member.id)}>
                        <MaterialIcons name="photo-camera" size={18} color={accentTheme.primary} />
                        <Text style={[styles.photoChipText, { color: accentTheme.primary }]}>Photo / Memoji</Text>
                      </Pressable>
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
              {ROOM_EMOJIS.map((emoji) => {
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
                ['nearShop', 'Near shop', 'Local alert when you are close to a grocery stop', '📍'],
                ['missingOnTheWay', 'Missing on the way', 'Nudge missing items before and during a run', '🧾'],
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
      </KeyboardScreen>
    </View>

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
  themeSwatchSmall: {
    alignItems: 'center',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  nestedGroup: {
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
  },
  nestedHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nestedTitle: {
    color: '#C8D8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  segmentChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  segmentText: {
    color: '#7C9CC0',
    fontSize: 13,
    fontWeight: '600',
  },
  themeLabel: { color: '#4B6080', fontSize: 12 },
  themeTypeLabel: { color: '#2A3A54', fontSize: 10, fontWeight: '600' },
  switchChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  switchChipText: { fontSize: 12, fontWeight: '700' },
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
  sharedDeviceCard: {
    backgroundColor: 'rgba(6,182,212,0.08)',
    borderColor: 'rgba(6,182,212,0.28)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  sharedDeviceHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  sharedDeviceEmoji: { fontSize: 28 },
  sharedDeviceHint: {
    color: '#7C9CC0',
    fontSize: 12,
    lineHeight: 17,
  },
  createDeviceCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  deviceNameInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    color: '#EEF2FF',
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  createDeviceBtn: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  createDeviceBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  linkWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkChipActive: {
    backgroundColor: 'rgba(52,211,153,0.18)',
    borderColor: 'rgba(52,211,153,0.45)',
  },
  linkChipText: {
    color: '#7C9CC0',
    fontSize: 13,
    fontWeight: '600',
  },
  linkChipTextActive: {
    color: '#34D399',
  },
  adminActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  adminActionChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  adminActionDanger: {
    borderColor: 'rgba(248,113,113,0.35)',
  },
  adminActionText: {
    color: '#7C9CC0',
    fontSize: 12,
    fontWeight: '700',
  },
  sharedAccountBlock: {
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingTop: 10,
  },
  memberCardInner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
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
    overflow: 'hidden',
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
    zIndex: 2,
  },
  memberAvatarImage: {
    height: 56,
    width: 56,
  },
  memberAvatarText: { fontSize: 28 },
  photoChip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    width: 'auto',
  },
  photoChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
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

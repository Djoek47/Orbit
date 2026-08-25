import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DEFAULT_ACCENT_THEME_ID,
  migrateAccentThemeId,
  type AccentThemeId,
} from '@/constants/accent-themes';
import { BrandLegalFooter } from '@/components/orbit/brand-legal-footer';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { PaletteWheel } from '@/components/orbit/palette-wheel';
import { PersonalizeLookSheet } from '@/components/orbit/personalize-look-sheet';
import { MajordomoProfileSheet } from '@/components/orbit/majordomo-profile-sheet';
import { PersonaSwitchPopup } from '@/components/orbit/persona-switch-popup';
import {
  getMajordomoProfile,
  resolveMajordomoProfileId,
} from '@/lib/ai/majordomo-profiles';
import { SegmentedControl } from '@/components/orbit/segmented-control';
import { MapsAppMark } from '@/components/orbit/maps-app-mark';
import { BUILD_INFO } from '@/constants/build-info';
import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
import { VOCAB } from '@/constants/vocabulary';
import { resetToGetStarted } from '@/lib/navigation/reset-to-get-started';
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
import {
  DEFAULT_REWARD_MODEL,
  REWARD_MODEL_OPTIONS,
  type RewardModel,
} from '@/lib/rewards/reward-model';
import {
  normalizeRewardSettings,
} from '@/lib/rewards/reward-mode';
import { markNeedsProfilePick } from '@/lib/device/device-session';
import {
  getNotificationPermissionStatus,
  isNotificationPermissionGranted,
  openSystemNotificationSettings,
  registerForPushNotifications,
} from '@/lib/notifications/push';
import {
  fetchEntitlement,
  IAP_PRODUCTS,
  premiumCopy,
  restorePurchases,
  type EntitlementState,
} from '@/lib/billing/iap';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { houseRulesHouseholdView } from '@/lib/rules/household-view';
import { formatHouseRulesTime } from '@/lib/rules/interpolate';
import { hasAllowanceModel } from '@/lib/rules/visibility';
import { DeadlinePickerSheet } from '@/components/orbit/house-rules/deadline-picker';
import { SettingsGroup, SettingsNavRow, SettingsToggleRow } from '@/components/orbit/settings/grouped';
import {
  AI_TRIP_USD,
  formatUsd,
  meterCaption,
  personalUsd,
  summarizeAiUsage,
} from '@/lib/ai/credits';

type Section = 'main' | 'you' | 'members' | 'house' | 'notifications' | 'places' | 'poppins' | 'premium';

function SharedAccountRow({
  person,
  active,
  accent,
  canManage,
  onSwitch,
  onPersonalize,
  onUnlink,
  onRemove,
}: {
  person: HouseholdMember;
  active: boolean;
  accent: string;
  canManage: boolean;
  onSwitch: () => void;
  onPersonalize: () => void;
  onUnlink?: () => void;
  onRemove?: () => void;
}) {
  const { c, glass, glassBorder } = useOrbitColors();
  const photo = isAvatarImageUri(person.avatar);
  return (
    <View style={[styles.sharedAccountBlock, { borderTopColor: glassBorder(0.08) }]}>
      <View style={styles.memberCardInner}>
        <Pressable
          onPress={onPersonalize}
          accessibilityLabel={`Personalize look for ${person.name}`}
          style={[
            styles.memberAvatar,
            { backgroundColor: `${active ? accent : c.textSubtle}33` },
          ]}>
          {photo ? (
            <Image source={{ uri: person.avatar }} style={styles.memberAvatarImage} />
          ) : (
            <Text style={styles.memberAvatarText}>{memberDisplayEmoji(person)}</Text>
          )}
          <View style={[styles.avatarEditBadge, { backgroundColor: c.backgroundSoft, borderColor: glassBorder(0.1) }]}>
            <MaterialIcons name="edit" size={10} color="#38BDF8" />
          </View>
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={onSwitch}>
          <Text style={[styles.memberName, { color: c.text }]}>{person.name}</Text>
          <Text style={[styles.caption, { color: c.textSubtle }]}>On this iPad · own XP & redeem</Text>
          <Text style={[styles.caption, { color: accent, fontWeight: '600' }]}>
            {person.xp} XP · week {person.weekXp ?? 0}
          </Text>
          <Text style={[styles.caption, { color: c.textSubtle }]}>Code {ensureProfileInviteCode(person)}</Text>
        </Pressable>
        {active ? <MaterialIcons name="check-circle" size={18} color="#34D399" /> : null}
      </View>
      {canManage ? (
        <View style={styles.adminActionRow}>
          {onUnlink ? (
            <Pressable
              onPress={onUnlink}
              style={[styles.adminActionChip, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}>
              <Text style={[styles.adminActionText, { color: c.textMuted }]}>Unlink</Text>
            </Pressable>
          ) : null}
          {onRemove ? (
            <Pressable onPress={onRemove} style={[styles.adminActionChip, styles.adminActionDanger]}>
              <Text style={[styles.adminActionText, { color: '#F87171' }]}>Remove</Text>
            </Pressable>
          ) : null}
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
    currentMember,
    currentUser,
    household,
    orbitPalette,
    paletteId,
    permissions,
    preferredMapsApp,
    removeMember,
    signOut,
    switchPersona,
    updateAppearanceMode,
    updateHouseholdAccentTheme,
    updateHouseholdRewardSettings,
    updateHouseholdRewardModel,
    queueDailyDeadline,
    setAllowanceRequestsEnabled,
    updateDisplayName,
    updateMemberDisplayName,
    updatePalette,
    updateMemberAvatar,
    updateMemberHomeworkProof,
    updateNotificationPrefs,
    updateMajordomoProfile,
    updateMemberMajordomoProfile,
    updateMemberCapabilities,
    updateSidekickGroceryAdd,
    updatePreferredMapsApp,
    updateSharedDeviceLinks,
    aiUsageEvents,
  } = useOrbit();
  const { c, isDark, glass, glassBorder } = useOrbitColors();

  const majordomo = useMemo(() => {
    const id = resolveMajordomoProfileId({
      householdProfileId: household.majordomoProfileId,
      memberProfileId: currentMember?.majordomoProfileId,
    });
    return getMajordomoProfile(id);
  }, [currentMember?.majordomoProfileId, household.majordomoProfileId]);

  const rewardSettings = useMemo(
    () =>
      normalizeRewardSettings({
        rewardMode: household.rewardMode,
        hygieneRewarded: household.hygieneRewarded,
        hygieneXp: household.hygieneXp,
      }),
    [household.hygieneRewarded, household.hygieneXp, household.rewardMode]
  );

  const [section, setSection] = useState<Section>('main');
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const houseRulesDoc = useMemo(() => getHouseRulesDoc(), []);
  const houseRulesView = useMemo(() => houseRulesHouseholdView(household), [household]);
  const [entitlement, setEntitlement] = useState<EntitlementState | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(
    currentMember?.name ?? currentUser?.name ?? ''
  );
  const [renamingMemberId, setRenamingMemberId] = useState<string | null>(null);
  const [renamingMemberInput, setRenamingMemberInput] = useState('');
  const [personaSwitchOpen, setPersonaSwitchOpen] = useState(false);
  const [personalizeMemberId, setPersonalizeMemberId] = useState<string | null>(null);
  const [majordomoOpen, setMajordomoOpen] = useState(false);
  const [householdDefaultOpen, setHouseholdDefaultOpen] = useState(false);
  const [osNotifStatus, setOsNotifStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
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

  useEffect(() => {
    if (section !== 'notifications' && section !== 'main') return;
    void getNotificationPermissionStatus().then((permission) => {
      setOsNotifStatus(isNotificationPermissionGranted(permission) ? 'granted' : 'denied');
    });
  }, [section]);

  useEffect(() => {
    if (section !== 'main' && section !== 'premium') return;
    void fetchEntitlement().then(setEntitlement);
  }, [section]);

  const aiSummary = useMemo(
    () =>
      summarizeAiUsage(
        aiUsageEvents,
        household.members.map((member) => ({ id: member.id, name: member.name }))
      ),
    [aiUsageEvents, household.members]
  );
  const lookValue =
    appearanceMode === 'system' ? 'System' : appearanceMode === 'light' ? 'Day' : 'Night';
  const householdThemeId = migrateAccentThemeId(household.accentThemeId ?? DEFAULT_ACCENT_THEME_ID);
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
      isDevice ? 'Remove this iPad' : 'Remove member',
      isDevice
        ? `Remove ${member.name}? People stay in the household; this iPad just won’t list them.`
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

  const toggleSharedLink = (deviceId: string, personId: string, linkedIds: string[]) => {
    const next = linkedIds.includes(personId)
      ? linkedIds.filter((id) => id !== personId)
      : [...linkedIds, personId];
    void updateSharedDeviceLinks(deviceId, next);
  };

  const handleDelete = () => {
    router.push('/delete-account' as never);
  };

  const personalizeMember = useMemo(
    () => household.members.find((member) => member.id === personalizeMemberId) ?? null,
    [household.members, personalizeMemberId]
  );

  if (currentMember?.role === 'child') {
    return <Redirect href={'/(tabs)' as never} />;
  }

  return (
    <>
    <View style={[styles.shell, { paddingTop: insets.top, backgroundColor: orbitPalette.backgroundSoft }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.handleRow}>
        <View style={[styles.handle, { backgroundColor: glassBorder(0.2) }]} />
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
              <MaterialIcons name="bolt" size={16} color={orbitPalette.ink} />
            </LinearGradient>
            <Text style={[styles.title, { color: orbitPalette.text }]}>Settings</Text>
          </View>
        )}
        <Pressable style={[styles.close, { backgroundColor: glass(0.08) }]} onPress={() => router.back()}>
          <MaterialIcons name="close" size={16} color={orbitPalette.textMuted} />
        </Pressable>
      </View>

      <KeyboardScreen
        offset={12}
        style={styles.scroll}
        contentContainerStyle={styles.content}>
        {section === 'main' ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="You"
              onPress={() => setSection('you')}
              style={[
                styles.identity,
                {
                  backgroundColor: glassFill(isDark),
                  borderColor: glassBorder(0.08),
                },
              ]}>
              <View
                style={[
                  styles.identityAvatar,
                  { backgroundColor: `${accentTheme.primary}33` },
                ]}>
                {isAvatarImageUri(currentMember?.avatar) ? (
                  <Image source={{ uri: currentMember?.avatar }} style={styles.identityAvatarImage} />
                ) : (
                  <Text style={styles.identityAvatarText}>
                    {currentMember ? memberDisplayEmoji(currentMember) : '·'}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.identityName, { color: c.text }]}>
                  {currentMember?.name ?? currentUser?.name ?? 'You'}
                </Text>
                <Text style={[styles.caption, { color: c.textMuted }]}>
                  {household.householdName}
                  {currentMember ? ` · ${formatHouseholdRole(currentMember.role)}` : ''}
                  {` · ${lookValue}`}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
            </Pressable>

            <SettingsGroup header="Household">
              <SettingsNavRow
                icon="group"
                iconColor="#38BDF8"
                label="People"
                value={`${household.members.filter((m) => m.role !== 'shared-device').length}`}
                last={!permissions.canManageHousehold}
                onPress={() => setSection('members')}
              />
              {permissions.canManageHousehold ? (
                <>
                  <SettingsNavRow
                    icon="menu-book"
                    iconColor="#FAC775"
                    label={VOCAB.houseRules}
                    onPress={() => router.push('/house-rules' as never)}
                  />
                  <SettingsNavRow
                    icon="tune"
                    iconColor="#A78BFA"
                    label="House"
                    value="Chores · permissions"
                    onPress={() => setSection('house')}
                  />
                  <SettingsNavRow
                    icon="beach-access"
                    iconColor="#38BDF8"
                    label={VOCAB.recess}
                    last
                    onPress={() => router.push('/recess' as never)}
                  />
                </>
              ) : (
                <SettingsNavRow
                  icon="menu-book"
                  iconColor="#FAC775"
                  label={VOCAB.houseRules}
                  last
                  onPress={() => router.push('/house-rules' as never)}
                />
              )}
            </SettingsGroup>

            <SettingsGroup header="Alerts">
              <SettingsNavRow
                icon="notifications-none"
                iconColor="#A78BFA"
                label="Notifications"
                value={osNotifStatus === 'granted' ? 'On' : 'Off'}
                last
                onPress={() => setSection('notifications')}
              />
            </SettingsGroup>

            <SettingsGroup header="Places">
              <SettingsNavRow
                icon="place"
                iconColor="#38BDF8"
                label="Places & maps"
                value={
                  preferredMapsApp === 'auto'
                    ? 'Auto'
                    : preferredMapsApp === 'apple'
                      ? 'Apple'
                      : preferredMapsApp === 'google'
                        ? 'Google'
                        : 'Waze'
                }
                last
                onPress={() => setSection('places')}
              />
            </SettingsGroup>

            <SettingsGroup
              header="Poppins"
              footer={
                aiSummary.tripped
                  ? 'Poppins is paused so we can see how long $4 of AI lasts.'
                  : permissions.canManageHousehold
                    ? 'Each person has their own meter. Poppins pauses at $4 for the household.'
                    : undefined
              }>
              <SettingsNavRow
                icon="record-voice-over"
                iconColor={majordomo.accent}
                label={majordomo.displayName}
                value={meterCaption(
                  aiSummary,
                  personalUsd(aiSummary, currentMember?.id),
                  permissions.canManageHousehold
                )}
                last
                onPress={() => setSection('poppins')}
              />
            </SettingsGroup>

            <SettingsGroup header="Choremaxx">
              <SettingsNavRow
                icon="workspace-premium"
                iconColor="#E9B44C"
                label="Premium"
                value={entitlement?.inTrial ? 'Trial' : entitlement?.active ? 'On' : undefined}
                onPress={() => setSection('premium')}
              />
              <SettingsNavRow
                icon="shield"
                iconColor="#34D399"
                label="Privacy & legal"
                last
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
            </SettingsGroup>

            <Pressable
              style={[styles.accountBtn, { backgroundColor: glass(0.06) }]}
              onPress={async () => {
                await signOut();
                resetToGetStarted();
              }}>
              <Text style={[styles.accountBtnText, { color: orbitPalette.text, textAlign: 'center' }]}>
                Sign Out
              </Text>
            </Pressable>
            <Pressable onPress={handleDelete}>
              <Text style={[styles.caption, { color: '#F87171', textAlign: 'center' }]}>
                Delete account
              </Text>
            </Pressable>

            <Text
              style={[
                styles.caption,
                { color: c.textSubtle, textAlign: 'center', marginBottom: 8 },
              ]}>
              {BUILD_INFO.label}
            </Text>
            <BrandLegalFooter style={styles.brand} />
          </>
        ) : null}

        {section === 'you' ? (
          <>
            <SectionCard title="Your name">
              <Text style={[styles.caption, { color: orbitPalette.textMuted, marginBottom: 8 }]}>
                Shown on Home and in your household — not your Apple email code.
              </Text>
              <View style={styles.rowBetween}>
                {editingDisplayName ? (
                  <TextInput
                    value={displayNameInput}
                    onChangeText={setDisplayNameInput}
                    style={[styles.nameInput, { color: orbitPalette.text, flex: 1 }]}
                    autoFocus
                    placeholder="Your name"
                    placeholderTextColor={orbitPalette.textSubtle}
                    onSubmitEditing={() => {
                      const next = displayNameInput.trim();
                      if (next.length >= 2) {
                        void updateDisplayName(next);
                        setEditingDisplayName(false);
                      }
                    }}
                  />
                ) : (
                  <Text style={[styles.nameText, { color: orbitPalette.text }]}>
                    {currentMember?.name ?? currentUser?.name ?? 'Add your name'}
                  </Text>
                )}
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => {
                    if (editingDisplayName) {
                      const next = displayNameInput.trim();
                      if (next.length >= 2) {
                        void updateDisplayName(next);
                      }
                      setEditingDisplayName(false);
                    } else {
                      setDisplayNameInput(currentMember?.name ?? currentUser?.name ?? '');
                      setEditingDisplayName(true);
                    }
                  }}>
                  <MaterialIcons
                    name={editingDisplayName ? 'check' : 'edit'}
                    size={14}
                    color={editingDisplayName ? '#34D399' : '#38BDF8'}
                  />
                </Pressable>
              </View>
            </SectionCard>

            <SectionCard title="Your look">
              <Text style={[styles.caption, { color: orbitPalette.textMuted, marginBottom: 8 }]}>
                Color for {currentMember?.name ?? 'you'} · each palette has Day and Night
              </Text>
              <PaletteWheel value={paletteId} onChange={updatePalette} label="Palette" />
              <View style={{ marginTop: 14 }}>
                <SegmentedControl
                  label="Day / Night"
                  value={appearanceMode}
                  onChange={(mode) => updateAppearanceMode(mode)}
                  options={[
                    { value: 'light', label: 'Day' },
                    { value: 'dark', label: 'Night' },
                    { value: 'system', label: 'System' },
                  ]}
                />
              </View>

              {permissions.canManageHousehold ? (
                <View style={styles.nestedGroup}>
                  <Pressable
                    style={styles.nestedHeader}
                    onPress={() => setHouseholdDefaultOpen((value) => !value)}>
                    <Text style={[styles.nestedTitle, { color: orbitPalette.textSoft }]}>Household default</Text>
                    <MaterialIcons
                      name={householdDefaultOpen ? 'expand-less' : 'expand-more'}
                      size={20}
                      color={orbitPalette.textMuted}
                    />
                  </Pressable>
                  {householdDefaultOpen ? (
                    <>
                      <Text style={[styles.caption, { color: orbitPalette.textMuted }]}>
                        Fallback palette for members without a personal pick
                      </Text>
                      <PaletteWheel
                        value={householdThemeId}
                        onChange={(id) => updateHouseholdAccentTheme(id)}
                        size="compact"
                        label=""
                      />
                    </>
                  ) : null}
                </View>
              ) : null}
            </SectionCard>
          </>
        ) : null}

        {section === 'house' ? (
          <>
            {permissions.canManageHousehold ? (
              <SectionCard title="What Sidekicks can do">
                <Text style={[styles.caption, { color: orbitPalette.textMuted, marginBottom: 8 }]}>
                  What Sidekicks and other members can do
                </Text>
                {(
                  [
                    ['allowRewardRedeem', 'Allow redeeming rewards', 'Members can spend XP on catalogue rewards'],
                    ['allowSpecialRewardRequest', 'Allow reward suggestions', 'Sidekicks can suggest something not in the catalogue yet'],
                    ['allowAllowance', 'Allow allowance', 'Shows Allowance in Rewards Center'],
                    ['allowGroceryAdd', 'Allow grocery list adds', 'Non-admins can add items'],
                    ['allowCalendarCreate', 'Allow calendar event creates', 'Simplified create when enabled'],
                  ] as const
                ).map(([key, label, sub]) => {
                  const caps = resolveMemberCapabilities(household);
                  return (
                    <View
                      key={key}
                      style={[
                        styles.prefRow,
                        {
                          backgroundColor: glassFill(isDark),
                          borderColor: glassBorder(0.08),
                        },
                      ]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.memberName, { color: orbitPalette.text }]}>{label}</Text>
                        <Text style={[styles.caption, { color: orbitPalette.textSubtle }]}>{sub}</Text>
                      </View>
                      <Switch
                        value={caps[key]}
                        onValueChange={(value) => updateMemberCapabilities({ [key]: value })}
                        trackColor={{ false: glassBorder(0.1), true: accentTheme.primary }}
                        thumbColor="#fff"
                      />
                    </View>
                  );
                })}
                <View
                  style={[
                    styles.prefRow,
                    {
                      backgroundColor: glassFill(isDark),
                      borderColor: glassBorder(0.08),
                    },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: orbitPalette.text }]}>
                      Let sidekicks add to the grocery list
                    </Text>
                    <Text style={[styles.caption, { color: orbitPalette.textSubtle }]}>
                      Household-wide. Sidekicks can add items only — not check off or edit.
                    </Text>
                  </View>
                  <Switch
                    value={household.sidekickGroceryAdd === true}
                    onValueChange={(value) => updateSidekickGroceryAdd(value)}
                    trackColor={{ false: glassBorder(0.1), true: accentTheme.primary }}
                    thumbColor="#fff"
                  />
                </View>
              </SectionCard>
            ) : null}
            {permissions.canManageHousehold ? (
              <SectionCard title="Rewards & XP">
                <Text style={[styles.caption, { color: c.textMuted, marginBottom: 10 }]}>
                  XP system — which parts of ChoreMaxx are on
                </Text>
                <View style={{ gap: 8, marginBottom: 16 }}>
                  {REWARD_MODEL_OPTIONS.map((opt) => {
                    const active =
                      (household.rewardModel ?? DEFAULT_REWARD_MODEL) === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        onPress={() => updateHouseholdRewardModel(opt.id as RewardModel)}
                        style={[
                          styles.prefRow,
                          {
                            backgroundColor: active
                              ? `${accentTheme.primary}22`
                              : glassFill(isDark),
                            borderColor: active
                              ? `${accentTheme.primary}55`
                              : glassBorder(0.08),
                          },
                        ]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.memberName, { color: c.text }]}>
                            {opt.title}
                            {opt.recommended ? ' · Recommended' : ''}
                          </Text>
                          <Text style={[styles.caption, { color: c.textSubtle }]}>
                            {opt.subtitle}
                          </Text>
                        </View>
                        {active ? (
                          <MaterialIcons name="check-circle" size={20} color={accentTheme.primary} />
                        ) : (
                          <MaterialIcons name="radio-button-unchecked" size={20} color={c.textSubtle} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.caption, { color: c.textMuted, marginBottom: 10 }]}>
                  Harder jobs are worth more. That ladder is how Choremaxx works.
                </Text>
                <View
                  style={[
                    styles.prefRow,
                    {
                      backgroundColor: glassFill(isDark),
                      borderColor: glassBorder(0.08),
                    },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: c.text }]}>Reward hygiene tasks</Text>
                    <Text style={[styles.caption, { color: c.textSubtle }]}>
                      Off by default. Hygiene builds streaks, explained in House Rules.
                    </Text>
                  </View>
                  <Switch
                    value={rewardSettings.hygieneRewarded}
                    onValueChange={(value) => {
                      if (value) {
                        Alert.alert(
                          'Reward hygiene tasks?',
                          'Brushing teeth, showering and similar tasks will start earning 5 XP each and will count on the leaderboard. Streaks keep working either way.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Turn on',
                              onPress: () =>
                                updateHouseholdRewardSettings({
                                  hygieneRewarded: true,
                                  hygieneXp: rewardSettings.hygieneXp,
                                }),
                            },
                          ]
                        );
                        return;
                      }
                      Alert.alert(
                        'Stop rewarding hygiene tasks?',
                        "These tasks go back to streaks only. Points already earned won't change.",
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Turn off',
                            style: 'destructive',
                            onPress: () => updateHouseholdRewardSettings({ hygieneRewarded: false }),
                          },
                        ]
                      );
                    }}
                    trackColor={{ false: glassBorder(0.1), true: accentTheme.primary }}
                    thumbColor="#fff"
                  />
                </View>
                {rewardSettings.hygieneRewarded ? (
                  <View style={{ marginTop: 12 }}>
                    <SegmentedControl
                      label="Points per hygiene task"
                      value={String(rewardSettings.hygieneXp) as '5' | '10'}
                      onChange={(xp) =>
                        updateHouseholdRewardSettings({ hygieneXp: xp === '10' ? 10 : 5 })
                      }
                      options={[
                        { value: '5', label: '5' },
                        { value: '10', label: '10' },
                      ]}
                    />
                  </View>
                ) : null}
              </SectionCard>
            ) : null}
            {permissions.canManageHousehold ? (
              <SettingsRow
                icon="schedule"
                iconColor="#E9B44C"
                label={houseRulesDoc.settings.dailyDeadline.label}
                subtitle={formatHouseRulesTime(
                  houseRulesView.dailyDeadline ?? houseRulesDoc.settings.dailyDeadline.default,
                  houseRulesView.use24h
                )}
                onPress={() => setDeadlineOpen(true)}
              />
            ) : null}
            {permissions.canManageHousehold && hasAllowanceModel(household.rewardModel) ? (
              <SettingsGroup>
                <SettingsToggleRow
                  label={houseRulesDoc.settings.allowanceRequests.label}
                  subtitle={houseRulesDoc.settings.allowanceRequests.help}
                  value={household.allowanceRequestsEnabled !== false}
                  last
                  onValueChange={(value) => setAllowanceRequestsEnabled(value)}
                />
              </SettingsGroup>
            ) : null}
          </>
        ) : null}

        {section === 'places' ? (
          <>
            <SettingsGroup>
              <SettingsNavRow
                icon="place"
                iconColor="#38BDF8"
                label="My Places"
                last
                onPress={() => router.push('/places' as never)}
              />
            </SettingsGroup>
            <SectionCard title="Maps">
              <Text style={[styles.caption, { color: c.textMuted, marginBottom: 10 }]}>
                Preferred maps app
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(
                  [
                    { value: 'auto' as const, label: 'Auto' },
                    { value: 'apple' as const, label: 'Apple' },
                    { value: 'google' as const, label: 'Google' },
                    { value: 'waze' as const, label: 'Waze' },
                  ] as const
                ).map((opt) => {
                  const active = preferredMapsApp === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => updatePreferredMapsApp(opt.value)}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 10,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: active ? `${accentTheme.primary}66` : glassBorder(0.1),
                        backgroundColor: active ? `${accentTheme.primary}18` : glass(0.04),
                      }}>
                      <MapsAppMark app={opt.value} size={22} />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: active ? accentTheme.primary : c.textMuted }}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </SectionCard>
          </>
        ) : null}

        {section === 'poppins' ? (
          <>
            <SettingsGroup footer="Voice and personality for this household.">
              <SettingsNavRow
                icon="record-voice-over"
                iconColor={majordomo.accent}
                label="Voice"
                value={`${majordomo.displayName}`}
                last
                onPress={() => setMajordomoOpen(true)}
              />
            </SettingsGroup>
            <SectionCard title={aiSummary.tripped ? 'Paused at $4' : 'This month'}>
              <Text style={[styles.nameText, { color: c.text }]}>
                {formatUsd(aiSummary.householdUsd)} of {formatUsd(AI_TRIP_USD)}
              </Text>
              <Text style={[styles.caption, { color: c.textMuted }]}>
                {aiSummary.tripped
                  ? 'Poppins is off so we can see how long $4 lasted.'
                  : permissions.canManageHousehold
                    ? 'Per person — not the OpenAI global dashboard.'
                    : 'Your Poppins use in this household.'}
              </Text>
              {(permissions.canManageHousehold ? aiSummary.byMember : aiSummary.byMember.filter((row) => row.memberId === currentMember?.id)).map(
                (row) => (
                  <View key={row.memberId} style={styles.rowBetween}>
                    <Text style={[styles.memberName, { color: c.text }]}>{row.name}</Text>
                    <Text style={[styles.caption, { color: c.textMuted }]}>
                      {formatUsd(row.usd)}
                      {row.events ? ` · ${row.events}` : ''}
                    </Text>
                  </View>
                )
              )}
            </SectionCard>
          </>
        ) : null}

        {section === 'premium' ? (
          <>
            <SectionCard title="Premium">
              <Text style={[styles.caption, { color: c.textSoft, marginBottom: 10 }]}>
                {entitlement ? premiumCopy(entitlement) : 'Loading…'}
              </Text>
              <Text style={[styles.caption, { color: c.textSubtle, marginBottom: 12 }]}>
                7-day free trial, then ${IAP_PRODUCTS.monthly.priceUsd}/mo via Apple.
              </Text>
              <Pressable
                style={[styles.accountBtn, { backgroundColor: glass(0.06) }]}
                onPress={() =>
                  router.push({ pathname: '/premium', params: { source: 'settings' } } as never)
                }>
                <Text style={[styles.accountBtnText, { color: orbitPalette.text }]}>
                  Open Premium
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.accountBtn,
                  { backgroundColor: glass(0.06), opacity: billingBusy ? 0.6 : 1 },
                ]}
                disabled={billingBusy}
                onPress={() => {
                  setBillingBusy(true);
                  void restorePurchases()
                    .then((next) => {
                      setEntitlement(next);
                      Alert.alert('Restore', premiumCopy(next));
                    })
                    .finally(() => setBillingBusy(false));
                }}>
                <Text style={[styles.accountBtnText, { color: orbitPalette.text }]}>
                  Restore purchases
                </Text>
              </Pressable>
            </SectionCard>
          </>
        ) : null}

        {section === 'members' ? (
          <>
            <Text style={[styles.sectionHint, { color: orbitPalette.textMuted }]}>
              Tap a name to switch. A shared iPad asks who is using it before opening Choremaxx.
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
              <View
                style={[
                  styles.createDeviceCard,
                  {
                    backgroundColor: glassFill(isDark),
                    borderColor: glassBorder(0.1),
                  },
                ]}>
                <Text style={[styles.memberName, { color: orbitPalette.text }]}>This iPad</Text>
                <Text style={[styles.caption, { color: orbitPalette.textSubtle }]}>
                  Scan each Sidekick’s profile QR. They pick their face when they open the app.
                </Text>
                <Pressable
                  style={[
                    styles.createDeviceBtn,
                    { backgroundColor: `${accentTheme.primary}22`, borderColor: `${accentTheme.primary}66` },
                  ]}
                  onPress={() => router.push('/setup-kid-device' as never)}>
                  <MaterialIcons name="tablet-mac" size={16} color={accentTheme.primary} />
                  <Text style={[styles.createDeviceBtnText, { color: accentTheme.primary }]}>
                    Set up this iPad
                  </Text>
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
                      <Text style={[styles.memberName, { color: orbitPalette.text }]}>{device.name}</Text>
                      <Text style={[styles.caption, { color: orbitPalette.textSubtle }]}>
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
                          Switch person
                        </Text>
                        <MaterialIcons name="expand-more" size={16} color={accentTheme.primary} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={[styles.sharedDeviceHint, { color: orbitPalette.textMuted }]}>
                    People on this iPad pick their face when they open Choremaxx.
                  </Text>
                  {permissions.canManageHousehold ? (
                    <View style={styles.linkWrap}>
                      {linkCandidates.map((person) => {
                        const linked = linkedIds.includes(person.id);
                        return (
                          <Pressable
                            key={person.id}
                            onPress={() => toggleSharedLink(device.id, person.id, linkedIds)}
                            style={[
                              styles.linkChip,
                              {
                                backgroundColor: glass(0.06),
                                borderColor: glassBorder(0.1),
                              },
                              linked && styles.linkChipActive,
                            ]}>
                            <Text
                              style={[
                                styles.linkChipText,
                                { color: orbitPalette.textMuted },
                                linked && styles.linkChipTextActive,
                              ]}>
                              {memberDisplayEmoji(person)} {person.name}
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
                      canManage={permissions.canManageHousehold}
                      onSwitch={() => switchPersona(person.id)}
                      onPersonalize={() => setPersonalizeMemberId(person.id)}
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
              const photo = isAvatarImageUri(member.avatar);
              return (
                <View
                  key={member.id}
                  style={[
                    styles.memberCard,
                    {
                      backgroundColor: glassFill(isDark),
                      borderColor: glassBorder(0.08),
                    },
                  ]}>
                  <Pressable
                    onPress={() => setPersonalizeMemberId(member.id)}
                    accessibilityLabel={`Personalize look for ${member.name}`}
                    style={[
                      styles.memberAvatar,
                      { backgroundColor: `${active ? accentTheme.primary : orbitPalette.textSubtle}33` },
                    ]}>
                    {photo ? (
                      <Image source={{ uri: member.avatar }} style={styles.memberAvatarImage} />
                    ) : (
                      <Text style={styles.memberAvatarText}>{memberDisplayEmoji(member)}</Text>
                    )}
                    <View
                      style={[
                        styles.avatarEditBadge,
                        { backgroundColor: orbitPalette.backgroundSoft, borderColor: glassBorder(0.1) },
                      ]}>
                      <MaterialIcons name="edit" size={10} color="#38BDF8" />
                    </View>
                  </Pressable>
                  <Pressable style={{ flex: 1 }} onPress={() => switchPersona(member.id)}>
                    {renamingMemberId === member.id ? (
                      <TextInput
                        value={renamingMemberInput}
                        onChangeText={setRenamingMemberInput}
                        style={[styles.nameInput, { color: orbitPalette.text }]}
                        autoFocus
                        onSubmitEditing={() => {
                          const next = renamingMemberInput.trim();
                          if (next.length >= 2) {
                            void updateMemberDisplayName(member.id, next);
                          }
                          setRenamingMemberId(null);
                        }}
                      />
                    ) : (
                      <Text style={[styles.memberName, { color: orbitPalette.text }]}>{member.name}</Text>
                    )}
                    <Text style={[styles.caption, { color: orbitPalette.textSubtle }]}>
                      {formatHouseholdRole(member.role)}
                    </Text>
                    <Text style={[styles.caption, { color: accentTheme.primary, fontWeight: '600' }]}>
                      {member.xp} XP total
                    </Text>
                    {member.profileInviteCode || member.role === 'child' ? (
                      <Text style={[styles.caption, { color: orbitPalette.textSubtle }]}>
                        Profile {ensureProfileInviteCode(member)}
                      </Text>
                    ) : null}
                    {permissions.canManageHousehold && member.role === 'child' ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          marginTop: 10,
                          paddingTop: 10,
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: glassBorder(0.08),
                        }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.caption, { color: orbitPalette.textSoft, fontWeight: '600' }]}>
                            Homework photo proof
                          </Text>
                          <Text style={[styles.caption, { color: orbitPalette.textSubtle, marginTop: 2 }]}>
                            Required when they mark homework done
                          </Text>
                        </View>
                        <Switch
                          value={member.homeworkProofRequired !== false}
                          onValueChange={(v) => void updateMemberHomeworkProof(member.id, v)}
                          trackColor={{ false: glassBorder(0.2), true: `${accentTheme.primary}88` }}
                          thumbColor="#FFFFFF"
                        />
                      </View>
                    ) : null}
                  </Pressable>
                  {active ? <MaterialIcons name="check-circle" size={18} color="#34D399" /> : null}
                  {permissions.canManageHousehold || currentMember?.id === member.id ? (
                    <Pressable
                      onPress={() => {
                        if (renamingMemberId === member.id) {
                          const next = renamingMemberInput.trim();
                          if (next.length >= 2) {
                            void updateMemberDisplayName(member.id, next);
                          }
                          setRenamingMemberId(null);
                          return;
                        }
                        setRenamingMemberId(member.id);
                        setRenamingMemberInput(member.name);
                      }}
                      hitSlop={8}
                      accessibilityLabel={`Rename ${member.name}`}>
                      <MaterialIcons
                        name={renamingMemberId === member.id ? 'check' : 'badge'}
                        size={18}
                        color={renamingMemberId === member.id ? '#34D399' : '#38BDF8'}
                      />
                    </Pressable>
                  ) : null}
                  {permissions.canManageHousehold && member.role !== 'owner' ? (
                    <Pressable
                      onPress={() => handleRemoveMember(member)}
                      hitSlop={8}
                      accessibilityLabel={`Remove ${member.name}`}>
                      <MaterialIcons name="person-remove" size={20} color="#F87171" />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            <Pressable
              style={[
                styles.primaryInviteCta,
                {
                  backgroundColor: accentTheme.primary,
                  borderCurve: 'continuous',
                },
              ]}
              onPress={() => router.push('/invite-household' as never)}>
              <Text style={[styles.primaryInviteCtaText, { color: orbitPalette.ink }]}>
                Invite
              </Text>
            </Pressable>
            <Text
              style={[
                styles.caption,
                { color: orbitPalette.textMuted, marginTop: 10, textAlign: 'center' },
              ]}>
              AirDrop or Messages
            </Text>
          </>
        ) : null}

        {section === 'notifications' ? (
          <>
            <View
              style={[
                styles.prefRow,
                {
                  backgroundColor: glassFill(isDark),
                  borderColor: glassBorder(0.08),
                },
              ]}>
              <MaterialIcons
                name={osNotifStatus === 'granted' ? 'notifications-active' : 'notifications-off'}
                size={22}
                color={osNotifStatus === 'granted' ? accentTheme.primary : orbitPalette.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: orbitPalette.text }]}>
                  iPhone notifications
                </Text>
                <Text style={[styles.caption, { color: orbitPalette.textSubtle }]}>
                  {osNotifStatus === 'granted'
                    ? 'Banners and lock screen are on for ChoreMaxx.'
                    : 'Turn on banners in Apple Settings so alerts aren’t silent.'}
                </Text>
              </View>
            </View>
            {osNotifStatus !== 'granted' ? (
              <Pressable
                style={[
                  styles.linkRow,
                  {
                    backgroundColor: `${accentTheme.primary}18`,
                    borderRadius: 12,
                    marginBottom: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                  },
                ]}
                onPress={() => {
                  void (async () => {
                    const token = await registerForPushNotifications(currentUser?.id);
                    const permission = await getNotificationPermissionStatus();
                    const granted = isNotificationPermissionGranted(permission);
                    setOsNotifStatus(granted ? 'granted' : 'denied');
                    if (!granted || !token) {
                      await openSystemNotificationSettings();
                    }
                  })();
                }}>
                <Text style={[styles.linkText, { color: accentTheme.primary }]}>
                  Enable banners in Apple Settings
                </Text>
                <MaterialIcons name="open-in-new" size={16} color={accentTheme.primary} />
              </Pressable>
            ) : (
              <Pressable
                style={styles.linkRow}
                onPress={() => void openSystemNotificationSettings()}>
                <Text style={[styles.linkText, { color: accentTheme.primary }]}>
                  Open Apple notification settings
                </Text>
                <MaterialIcons name="chevron-right" size={16} color={accentTheme.primary} />
              </Pressable>
            )}

            <Text style={[styles.sectionHint, { color: orbitPalette.textMuted }]}>
              Choose which Poppins alerts you want ({enabledCount} on)
            </Text>
            {(
              [
                ['tasks', 'Tasks & streaks', 'Due tasks, photos, streak risk', '✅'],
                ['rewards', 'Rewards & allowance', 'Claims, approvals, paid allowance', '🎁'],
                ['groceries', 'Groceries', 'List updates that still use this channel', '🛒'],
                ['itinerary', 'Plan & trips', 'Trip nudges when enabled', '🗺️'],
                ['deals', 'Deal ideas', 'In-app suggestions only', '🏷️'],
                ['plans', 'Plan ideas', 'In-app suggestions only', '🗺️'],
                ['xpFairness', 'Fairness notes', 'In-app balance tips', '⚖️'],
                ['nearShop', 'Near shop', 'Ask before opening your list at a store', '📍'],
                ['missingOnTheWay', 'Missing on the way', 'Local reminder during a run', '🧾'],
                [
                  'quietHoursEnabled',
                  'Quiet hours',
                  'Hold non-urgent banners 21:00–07:00 (deadlines still fire)',
                  '🌙',
                ],
              ] as const
            ).map(([key, label, sub, emoji]) => (
              <View
                key={key}
                style={[
                  styles.prefRow,
                  {
                    backgroundColor: glassFill(isDark),
                    borderColor: glassBorder(0.08),
                  },
                ]}>
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: orbitPalette.text }]}>{label}</Text>
                  <Text style={[styles.caption, { color: orbitPalette.textSubtle }]}>{sub}</Text>
                </View>
                <Switch
                  value={
                    key === 'quietHoursEnabled'
                      ? prefs.quietHoursEnabled !== false
                      : Boolean(prefs[key])
                  }
                  onValueChange={(value) => updateNotificationPrefs({ [key]: value })}
                  trackColor={{ false: glassBorder(0.1), true: '#38BDF8' }}
                  thumbColor="#fff"
                />
              </View>
            ))}
            <Pressable style={styles.linkRow} onPress={() => router.push('/notifications' as never)}>
              <Text style={styles.linkText}>Open notifications inbox</Text>
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
    <PersonalizeLookSheet
      visible={Boolean(personalizeMember)}
      memberName={personalizeMember?.name ?? 'you'}
      currentAvatar={personalizeMember?.avatar}
      onDismiss={() => setPersonalizeMemberId(null)}
      onSelect={async (avatar) => {
        if (!personalizeMember) return;
        await updateMemberAvatar(personalizeMember.id, avatar);
      }}
    />
    <MajordomoProfileSheet
      visible={majordomoOpen}
      onDismiss={() => setMajordomoOpen(false)}
      householdProfileId={household.majordomoProfileId}
      memberProfileId={currentMember?.majordomoProfileId}
      memberName={currentMember?.name}
      canManageHousehold={permissions.canManageHousehold}
      onSelectHousehold={(id) => updateMajordomoProfile(id)}
      onSelectPersonal={(id) => updateMemberMajordomoProfile(id)}
    />
    <DeadlinePickerSheet
      visible={deadlineOpen}
      doc={houseRulesDoc}
      current={houseRulesView.dailyDeadline ?? houseRulesDoc.settings.dailyDeadline.default}
      pending={household.dailyDeadlinePending}
      appliesOn={household.dailyDeadlineAppliesOn}
      use24h={houseRulesView.use24h}
      onClose={() => setDeadlineOpen(false)}
      onSelect={(hhmm) => queueDailyDeadline(hhmm)}
    />
  </>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { c, isDark, glassBorder } = useOrbitColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: glassFill(isDark),
          borderColor: glassBorder(0.08),
        },
      ]}>
      <Text style={[styles.cardEyebrow, { color: c.textMuted }]}>{title.toUpperCase()}</Text>
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
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  return (
    <Pressable
      style={[
        styles.settingsRow,
        {
          backgroundColor: glassFill(isDark),
          borderColor: glassBorder(0.08),
        },
      ]}
      onPress={onPress}>
      <View style={[styles.settingsIcon, { backgroundColor: glass(0.06) }]}>
        {emoji ? (
          <Text style={{ fontSize: 18 }}>{emoji}</Text>
        ) : (
          <MaterialIcons name={icon!} size={16} color={iconColor ?? c.textMuted} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.memberName, { color: c.text }]}>{label}</Text>
        <Text style={[styles.caption, { color: c.textSubtle }]}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={16} color={c.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  handleRow: { alignItems: 'center', paddingBottom: 4, paddingTop: 12 },
  handle: {
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
  title: { fontSize: 18, fontWeight: '700' },
  close: {
    alignItems: 'center',
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
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  identity: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
  },
  identityAvatar: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56,
  },
  identityAvatarImage: { height: 56, width: 56 },
  identityAvatarText: { fontSize: 28 },
  identityName: { fontSize: 20, fontWeight: '700' },
  cardEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  nameText: { flex: 1, fontSize: 16, fontWeight: '600' },
  nameInput: {
    borderBottomColor: 'rgba(56,189,248,0.4)',
    borderBottomWidth: 1,
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
  caption: { fontSize: 12 },
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
    fontSize: 14,
    fontWeight: '600',
  },
  themeLabel: { fontSize: 12 },
  themeTypeLabel: { fontSize: 10, fontWeight: '600' },
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
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  settingsIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  inline: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  rowLabel: { fontSize: 14 },
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
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  accountBtnText: { fontSize: 14, fontWeight: '600' },
  brand: { paddingBottom: 8, paddingTop: 12 },
  sectionHint: { fontSize: 14, paddingTop: 4 },
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
    fontSize: 12,
    lineHeight: 17,
  },
  createDeviceCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  deviceNameInput: {
    borderRadius: 12,
    borderWidth: 1,
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
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  adminActionDanger: {
    borderColor: 'rgba(248,113,113,0.35)',
  },
  adminActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sharedAccountBlock: {
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
  memberName: { fontSize: 14, fontWeight: '600' },
  emojiGrid: {
    flexBasis: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  prefRow: {
    alignItems: 'center',
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
  primaryInviteCta: {
    alignItems: 'center',
    borderRadius: 20,
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 15,
    width: '100%',
  },
  primaryInviteCtaText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});

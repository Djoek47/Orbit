import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Image, Linking, Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DEFAULT_ACCENT_THEME_ID,
  migrateAccentThemeId,
  type AccentThemeId,
} from '@/constants/accent-themes';
import { BrandLegalFooter } from '@/components/orbit/brand-legal-footer';
import { HouseholdSwitchSheet } from '@/components/orbit/household-switch-sheet';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { PaletteWheel } from '@/components/orbit/palette-wheel';
import { PersonalizeLookSheet } from '@/components/orbit/personalize-look-sheet';
import { ProfileInviteSheet } from '@/components/orbit/profile-invite-sheet';
import { MemberInviteSheet } from '@/components/orbit/member-invite-sheet';
import { MajordomoProfileSheet } from '@/components/orbit/majordomo-profile-sheet';
import { PoppinsAdvancedSheet } from '@/components/orbit/poppins-advanced-sheet';
import { PoppinsModeCards } from '@/components/orbit/poppins-mode-cards';
import { PersonaSwitchPopup } from '@/components/orbit/persona-switch-popup';
import { speakAs } from '@/lib/ai/majordomo-name';
import {
  getMajordomoProfile,
  resolveMajordomoProfileId,
} from '@/lib/ai/majordomo-profiles';
import { SegmentedControl } from '@/components/orbit/segmented-control';
import { MapsAppMark } from '@/components/orbit/maps-app-mark';
import { BUILD_INFO } from '@/constants/build-info';
import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
import {
  clearLastAppError,
  loadLastAppError,
  type LastAppError,
} from '@/lib/errors/last-error';
import { VOCAB } from '@/constants/vocabulary';
import {
  DEFAULT_POPPINS_INTERACTION_PREFS,
  loadPoppinsInteractionPrefs,
  prefsForTier,
  savePoppinsInteractionPrefs,
  type PoppinsInteractionPrefs,
} from '@/lib/poppins/poppins-prefs';
import { TOKEN_WEIGHT_SPEAK_BACK } from '@/constants/poppins-ai-rates';
import { resetToGetStarted } from '@/lib/navigation/reset-to-get-started';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { memberUsesProfileInvite } from '@/lib/household/member-invite-routing';
import { isHouseholdSwitchDisabled } from '@/lib/feature-flags';
import {
  formatHouseholdDeletionDate,
  householdDeletionDaysRemaining,
  isHouseholdDeletionPending,
} from '@/lib/household/household-deletion';
import { formatHouseholdRole } from '@/lib/permissions';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import {
  DEFAULT_REWARD_MODEL,
  REWARD_MODEL_OPTIONS,
  type RewardModel,
} from '@/lib/rewards/reward-model';
import {
  normalizeRewardSettings,
  REWARD_MODE_COPY,
  STREAK_FOOTNOTE,
  type RewardMode,
} from '@/lib/rewards/reward-mode';
import {
  getNotificationPermissionStatus,
  isNotificationPermissionGranted,
  openSystemNotificationSettings,
  requestNotificationPermission,
} from '@/lib/notifications/push';
import { registerPushForActor } from '@/lib/notifications/member-push';
import { loadSidekickSession } from '@/lib/sidekick/session';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import {
  fetchEntitlement,
  IAP_PRODUCTS,
  premiumCopy,
  restorePurchases,
  type EntitlementState,
} from '@/lib/billing/iap';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { MemberInvite } from '@/lib/household/member-invites';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { houseRulesHouseholdView } from '@/lib/rules/household-view';
import { formatHouseRulesTime } from '@/lib/rules/interpolate';
import { hasAllowanceModel } from '@/lib/rules/visibility';
import { DeadlinePickerSheet } from '@/components/orbit/house-rules/deadline-picker';
import { SidekickSettingsScreen } from '@/components/orbit/sidekick-settings-screen';
import { HouseholdMembersRoster } from '@/components/orbit/members/household-members-roster';
import { RewardsXpPanel } from '@/components/orbit/settings/rewards-xp-panel';
import { SidekickPermissionsPanel } from '@/components/orbit/settings/sidekick-permissions-panel';
import { applyGroceryPermissionMerge } from '@/lib/household/migrate-grocery-permission';
import { useMembersLiveRefresh } from '@/lib/refresh/use-members-live-refresh';
import { AddMemberSheet } from '@/components/orbit/members/add-member-sheet';
import { SettingsGroup, SettingsNavRow, SettingsToggleRow } from '@/components/orbit/settings/grouped';
import { TourTarget } from '@/components/orbit/tour/tour-target';
import { useTourControls } from '@/components/orbit/tour/tour-provider';
import { chaptersForTour } from '@/lib/tour/tour-steps';
import { resolveTourId } from '@/lib/tour/tour-conditions';
import { isTourEnabledSync } from '@/lib/tour/tour-enabled';
import {
  POPPINS_PAUSED_COPY,
  TOKENS_PER_DAY,
  TOKENS_PER_MONTH,
  meterCaption,
  meterNearCap,
} from '@/lib/ai/credits';
import { personalActTokens, summarizeActUsage } from '@/lib/ai/act-events';

type Section =
  | 'main'
  | 'you'
  | 'members'
  | 'house'
  | 'rewards'
  | 'sidekick-perms'
  | 'notifications'
  | 'places'
  | 'poppins'
  | 'premium';

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
    signOut,
    setMemberJoinPreApproved,
    switchPersona,
    updateAppearanceMode,
    updateHouseholdAccentTheme,
    updateHouseholdRewardSettings,
    updateHouseholdRewardModel,
    queueDailyDeadline,
    setAllowanceRequestsEnabled,
    householdMemberships,
    cancelHouseholdDeletion,
    updateDisplayName,
    updatePalette,
    updateMemberAvatar,
    updateNotificationPrefs,
    updateMajordomoProfile,
    updateMemberMajordomoProfile,
    updateMemberCapabilities,
    updateSidekickGroceryAdd,
    updateSidekickPoppinsAi,
    updatePreferredMapsApp,
    actEvents,
    refreshHousehold,
    unreadNotificationCount,
  } = useOrbit();
  const tourControls = useTourControls();
  const { c, isDark, glass, glassBorder } = useOrbitColors();

  useMembersLiveRefresh(permissions.canManageHousehold);

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
  const groceryMergedRef = useRef(false);

  useEffect(() => {
    if (groceryMergedRef.current || !permissions.canManageHousehold) return;
    groceryMergedRef.current = true;
    const merged = applyGroceryPermissionMerge(household);
    const caps = resolveMemberCapabilities(household);
    const groceryChanged = merged.sidekickGroceryAdd !== (household.sidekickGroceryAdd === true);
    const capsChanged = caps.allowGroceryAdd !== merged.sidekickGroceryAdd;
    if (groceryChanged) {
      void updateSidekickGroceryAdd(merged.sidekickGroceryAdd);
    }
    if (capsChanged) {
      updateMemberCapabilities({ allowGroceryAdd: merged.sidekickGroceryAdd });
    }
  }, [
    household,
    permissions.canManageHousehold,
    updateMemberCapabilities,
    updateSidekickGroceryAdd,
  ]);

  useEffect(() => {
    if (section !== 'members' || !permissions.canManageHousehold) return;

    const refresh = () => {
      void refreshHousehold().catch((error) => {
        console.warn('settings.membersRefresh', error);
      });
    };

    refresh();
    const interval = setInterval(refresh, 12_000);
    return () => clearInterval(interval);
  }, [permissions.canManageHousehold, refreshHousehold, section]);

  useFocusEffect(
    useCallback(() => {
      if (section !== 'members') return;
      void refreshHousehold().catch((error) => {
        console.warn('settings.membersRefresh.focus', error);
      });
    }, [refreshHousehold, section])
  );
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const houseRulesDoc = useMemo(() => getHouseRulesDoc(), []);
  const houseRulesView = useMemo(() => houseRulesHouseholdView(household), [household]);
  const dailyDeadlineSubtitle = useMemo(() => {
    const current =
      houseRulesView.dailyDeadline ?? houseRulesDoc.settings.dailyDeadline.default;
    const pending = household.dailyDeadlinePending?.trim();
    const formatted = formatHouseRulesTime(current, houseRulesView.use24h);
    if (!pending || pending === current) return formatted;
    return `${formatted} → ${formatHouseRulesTime(pending, houseRulesView.use24h)} tomorrow`;
  }, [
    houseRulesDoc.settings.dailyDeadline.default,
    houseRulesView.dailyDeadline,
    houseRulesView.use24h,
    household.dailyDeadlinePending,
  ]);
  const [entitlement, setEntitlement] = useState<EntitlementState | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(
    currentMember?.name ?? currentUser?.name ?? ''
  );
  const [personaSwitchOpen, setPersonaSwitchOpen] = useState(false);
  const [personalizeMemberId, setPersonalizeMemberId] = useState<string | null>(null);
  const [memberInvites, setMemberInvites] = useState<MemberInvite[]>([]);
  const [inviteTarget, setInviteTarget] = useState<
    { kind: 'profile'; memberId: string } | { kind: 'token'; memberId: string } | null
  >(null);
  const [householdSwitchOpen, setHouseholdSwitchOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [majordomoOpen, setMajordomoOpen] = useState(false);
  const [poppinsAdvancedOpen, setPoppinsAdvancedOpen] = useState(false);
  const [householdDefaultOpen, setHouseholdDefaultOpen] = useState(false);
  const [settingsToggleBusy, setSettingsToggleBusy] = useState(false);
  const [osNotifStatus, setOsNotifStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [poppinsPrefs, setPoppinsPrefs] = useState<PoppinsInteractionPrefs>(
    DEFAULT_POPPINS_INTERACTION_PREFS
  );
  const [howActionsOpen, setHowActionsOpen] = useState(false);
  const [lastAppError, setLastAppError] = useState<LastAppError | null>(null);
  const poppinsPrefsReadOnly = !permissions.canManageHousehold;

  useEffect(() => {
    if (section !== 'poppins') return;
    void loadPoppinsInteractionPrefs(household.id).then(setPoppinsPrefs);
  }, [section, household.id]);

  const updatePoppinsPrefs = useCallback(
    async (next: PoppinsInteractionPrefs) => {
      setPoppinsPrefs(next);
      await savePoppinsInteractionPrefs(household.id, next);
    },
    [household.id]
  );

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

  const guardSettingsToggle = useCallback(
    (action: () => void) => {
      if (settingsToggleBusy) return;
      setSettingsToggleBusy(true);
      action();
      setTimeout(() => setSettingsToggleBusy(false), 450);
    },
    [settingsToggleBusy]
  );

  useEffect(() => {
    if (section !== 'notifications' && section !== 'main') return;
    void getNotificationPermissionStatus().then((permission) => {
      setOsNotifStatus(isNotificationPermissionGranted(permission) ? 'granted' : 'denied');
    });
  }, [section]);

  useEffect(() => {
    if (section !== 'main') return;
    void loadLastAppError().then(setLastAppError);
  }, [section]);

  useEffect(() => {
    if (section !== 'notifications') return;
    const refreshOsPermission = () => {
      void getNotificationPermissionStatus().then((permission) => {
        setOsNotifStatus(isNotificationPermissionGranted(permission) ? 'granted' : 'denied');
      });
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshOsPermission();
    });
    return () => subscription.remove();
  }, [section]);

  const openAppleNotificationSettings = useCallback(async () => {
    const opened = await openSystemNotificationSettings();
    if (!opened) {
      Alert.alert(
        'Could not open Settings',
        'Open Settings → Notifications → ChoreMaxx to change banners and alerts.'
      );
    }
  }, []);

  const enableAppleNotificationBanners = useCallback(async () => {
    try {
      let permission = await getNotificationPermissionStatus();
      if (!isNotificationPermissionGranted(permission)) {
        await requestNotificationPermission();
        permission = await getNotificationPermissionStatus();
      }
      const granted = isNotificationPermissionGranted(permission);
      setOsNotifStatus(granted ? 'granted' : 'denied');
      if (!granted) {
        await openAppleNotificationSettings();
        return;
      }
      const sidekickSession = isSidekickRole(currentMember?.role)
        ? await loadSidekickSession()
        : null;
      await registerPushForActor({
        userId: currentUser?.id,
        profileInviteCode: sidekickSession?.profileInviteCode,
      });
    } catch (error) {
      Alert.alert(
        'Notifications',
        error instanceof Error ? error.message : 'Could not update notification settings.'
      );
    }
  }, [currentMember?.role, currentUser?.id, openAppleNotificationSettings]);

  useEffect(() => {
    if (section !== 'main' && section !== 'premium') return;
    void fetchEntitlement().then(setEntitlement);
  }, [section]);

  const [topUpBalance, setTopUpBalance] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { loadTokenGrants, topUpBalanceFromGrants } = await import(
        '@/lib/billing/token-grants'
      );
      const grants = await loadTokenGrants(household.id);
      if (!cancelled) setTopUpBalance(topUpBalanceFromGrants(grants));
    })();
    return () => {
      cancelled = true;
    };
  }, [household.id, actEvents]);

  const aiSummary = useMemo(
    () =>
      summarizeActUsage(
        actEvents,
        household.members.map((member) => ({ id: member.id, name: member.name })),
        { topUpBalance }
      ),
    [actEvents, household.members, topUpBalance]
  );
  const lookValue =
    appearanceMode === 'system' ? 'System' : appearanceMode === 'light' ? 'Day' : 'Night';
  const householdThemeId = migrateAccentThemeId(household.accentThemeId ?? DEFAULT_ACCENT_THEME_ID);
  const canSwitchHousehold =
    householdMemberships.length > 1 && !isHouseholdSwitchDisabled();

  const openMemberInvite = (member: HouseholdMember) => {
    if (memberUsesProfileInvite(member)) {
      setInviteTarget({ kind: 'profile', memberId: member.id });
      return;
    }
    setInviteTarget({ kind: 'token', memberId: member.id });
  };

  const inviteMember = useMemo(
    () =>
      inviteTarget?.memberId != null
        ? (household.members.find((member) => member.id === inviteTarget.memberId) ?? null)
        : null,
    [household.members, inviteTarget?.memberId]
  );


  const handleDelete = () => {
    router.push('/delete-account' as never);
  };

  const personalizeMember = useMemo(
    () => household.members.find((member) => member.id === personalizeMemberId) ?? null,
    [household.members, personalizeMemberId]
  );

  if (isSidekickRole(currentMember?.role)) {
    return <SidekickSettingsScreen />;
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
            <Text style={[styles.backChevron, { color: accentTheme.primary }]}>‹</Text>
            <Text style={[styles.backLabel, { color: accentTheme.primary }]}>Settings</Text>
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

      {section === 'rewards' ? (
        <Text style={[styles.sectionHeading, { color: c.text }]}>Rewards & XP</Text>
      ) : null}
      {section === 'sidekick-perms' ? (
        <Text style={[styles.sectionHeading, { color: c.text }]}>Sidekick permissions</Text>
      ) : null}
      {section === 'members' ? (
        <Text style={[styles.sectionHeading, { color: c.text }]}>People</Text>
      ) : null}
      {section === 'you' ? (
        <Text style={[styles.sectionHeading, { color: c.text }]}>You</Text>
      ) : null}
      <KeyboardScreen
        offset={12}
        style={styles.scroll}
        contentContainerStyle={styles.content}>
        {section === 'main' ? (
          <>
            {isHouseholdDeletionPending(household) && household.deletionScheduledFor ? (
              <View
                style={[
                  styles.deletionBanner,
                  {
                    backgroundColor: '#FBBF2414',
                    borderColor: '#FBBF2444',
                  },
                ]}>
                <MaterialIcons name="hourglass-top" size={18} color="#FBBF24" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: c.text }]}>
                    Deletion scheduled
                  </Text>
                  <Text style={[styles.caption, { color: c.textMuted }]}>
                    {household.householdName} will be permanently deleted on{' '}
                    {formatHouseholdDeletionDate(household.deletionScheduledFor)} (
                    {householdDeletionDaysRemaining(household.deletionScheduledFor)} days left). Data
                    is kept until then.
                  </Text>
                </View>
                {currentMember?.role === 'owner' ? (
                  <Pressable
                    onPress={() => void cancelHouseholdDeletion()}
                    style={[styles.adminActionChip, { borderColor: '#FBBF2466' }]}>
                    <Text style={[styles.adminActionText, { color: '#FBBF24' }]}>Undo</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
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
                {canSwitchHousehold ? (
                  <Text style={[styles.caption, { color: accentTheme.primary, fontWeight: '600' }]}>
                    Tap to switch household
                  </Text>
                ) : null}
              </View>
              <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
            </Pressable>

            <SettingsGroup header="The household">
              {canSwitchHousehold ? (
                <SettingsNavRow
                  icon="swap-horiz"
                  iconColor={accentTheme.primary}
                  label="Switch household"
                  subtitle={`Now in ${household.householdName}`}
                  onPress={() => setHouseholdSwitchOpen(true)}
                />
              ) : null}
              <TourTarget id="settings.members">
                <SettingsNavRow
                  icon="group"
                  iconColor="#38BDF8"
                  label="People"
                  subtitle={`${household.members.filter((m) => m.role !== 'shared-device' && m.status === 'active').length} members${
                    household.members.some((m) => m.status === 'invited' || m.status === 'pending')
                      ? ` · ${household.members.filter((m) => m.status === 'invited' || m.status === 'pending').length} invited`
                      : ''
                  }`}
                  onPress={() => setSection('members')}
                />
              </TourTarget>
              {permissions.canManageHousehold ? (
                <>
                  <TourTarget id="settings.houseRules">
                    <SettingsNavRow
                      icon="menu-book"
                      iconColor="#FAC775"
                      label={VOCAB.houseRules}
                      subtitle="Six chapters"
                      onPress={() => router.push('/house-rules' as never)}
                    />
                  </TourTarget>
                  <SettingsNavRow
                    icon="emoji-events"
                    iconColor="#A78BFA"
                    label="Rewards & XP"
                    subtitle={`${
                      (household.rewardModel ?? DEFAULT_REWARD_MODEL) === 'full'
                        ? 'Everything'
                        : REWARD_MODEL_OPTIONS.find((o) => o.id === household.rewardModel)?.title ??
                          'Custom'
                    } · ${rewardSettings.rewardMode === 'weighted' ? 'by effort' : 'the same'}`}
                    onPress={() => setSection('rewards')}
                  />
                  <SettingsNavRow
                    icon="child-care"
                    iconColor="#34D399"
                    label="Sidekick permissions"
                    subtitle={`${
                      [
                        resolveMemberCapabilities(household).allowRewardRedeem,
                        resolveMemberCapabilities(household).allowSpecialRewardRequest,
                        resolveMemberCapabilities(household).allowAllowance,
                        household.sidekickGroceryAdd === true,
                        resolveMemberCapabilities(household).allowCalendarCreate,
                        household.sidekickPoppinsAi === true,
                      ].filter(Boolean).length
                    } of 8 allowed`}
                    last
                    onPress={() => setSection('sidekick-perms')}
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

            <SettingsGroup header="Day to day">
              <SettingsNavRow
                icon="place"
                iconColor="#38BDF8"
                label="Places"
                subtitle={`${(household.savedPlaces ?? []).length} saved · ${
                  preferredMapsApp === 'auto'
                    ? 'Auto'
                    : preferredMapsApp === 'apple'
                      ? 'Apple Maps'
                      : preferredMapsApp === 'google'
                        ? 'Google Maps'
                        : 'Waze'
                }`}
                onPress={() => router.push('/places' as never)}
              />
              <SettingsNavRow
                icon="notifications-none"
                iconColor="#A78BFA"
                label="Alerts"
                subtitle={
                  unreadNotificationCount > 0
                    ? `${unreadNotificationCount} unread`
                    : osNotifStatus === 'granted'
                      ? 'On'
                      : 'Off'
                }
                onPress={() => setSection('notifications')}
              />
              <SettingsNavRow
                icon="record-voice-over"
                iconColor={majordomo.accent}
                label="Poppins"
                subtitle={meterCaption(
                  aiSummary,
                  personalActTokens(aiSummary, currentMember?.id),
                  permissions.canManageHousehold
                )}
                last
                onPress={() => setSection('poppins')}
              />
            </SettingsGroup>

            <SettingsGroup header="You">
              <SettingsNavRow
                icon="person"
                iconColor={accentTheme.primary}
                label="You"
                subtitle={lookValue}
                last
                onPress={() => setSection('you')}
              />
            </SettingsGroup>

            <SettingsGroup header="Help">
              {isTourEnabledSync() ? (
                <>
              <SettingsNavRow
                icon="map"
                iconColor="#38BDF8"
                label="Take the tour again"
                subtitle="Replay the first-run walkthrough from the start"
                onPress={() => {
                  tourControls?.startTour();
                }}
              />
              <SettingsNavRow
                icon="replay"
                iconColor="#A78BFA"
                label="Replay a part"
                subtitle="Jump to one chapter"
                onPress={() => {
                  const tid = resolveTourId({
                    household,
                    currentMember,
                  });
                  const chapters = chaptersForTour(tid);
                  Alert.alert(
                    'Replay a part',
                    'Pick a chapter to replay.',
                    [
                      ...chapters.map((ch) => ({
                        text: ch.name,
                        onPress: () => tourControls?.startChapter(tid, ch.id),
                      })),
                      { text: 'Cancel', style: 'cancel' as const },
                    ]
                  );
                }}
              />
              <SettingsNavRow
                icon="checklist"
                iconColor="#34D399"
                label="Show the checklist"
                subtitle="Getting started on Home"
                onPress={() => tourControls?.showChecklist()}
              />
                </>
              ) : null}
              <SettingsNavRow
                icon="bug-report"
                iconColor="#F87171"
                label="Last error"
                subtitle={
                  lastAppError
                    ? `${lastAppError.at.slice(0, 19)} · ${lastAppError.message.slice(0, 72)}`
                    : 'None saved'
                }
                last
                onPress={() => {
                  if (!lastAppError) {
                    Alert.alert('Last error', 'No crash details saved yet.');
                    return;
                  }
                  const body = [
                    lastAppError.message,
                    `At: ${lastAppError.at}`,
                    lastAppError.stack ?? '',
                    lastAppError.componentStack ?? '',
                  ]
                    .filter(Boolean)
                    .join('\n\n');
                  Alert.alert('Last error', lastAppError.message.slice(0, 280), [
                    {
                      text: 'Copy',
                      onPress: () => {
                        void Clipboard.setStringAsync(body);
                      },
                    },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: () => {
                        void clearLastAppError().then(() => setLastAppError(null));
                      },
                    },
                    { text: 'OK', style: 'cancel' },
                  ]);
                }}
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
                try {
                  await signOut();
                } catch (error) {
                  console.warn('settings.signOut', error);
                } finally {
                  resetToGetStarted();
                }
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

        {section === 'rewards' ? (
          <RewardsXpPanel
            rewardModel={(household.rewardModel ?? DEFAULT_REWARD_MODEL) as RewardModel}
            rewardMode={rewardSettings.rewardMode}
            hygieneRewarded={rewardSettings.hygieneRewarded}
            hygieneXp={rewardSettings.hygieneXp}
            allowanceRequestsEnabled={household.allowanceRequestsEnabled !== false}
            dailyDeadlineLabel={dailyDeadlineSubtitle}
            accent={accentTheme.primary}
            onRewardModel={(model) => updateHouseholdRewardModel(model)}
            onRewardMode={(mode) => updateHouseholdRewardSettings({ rewardMode: mode })}
            onHygiene={(rewarded) => {
              if (rewarded) {
                Alert.alert(
                  'Reward hygiene tasks?',
                  'Brushing teeth and similar tasks will start earning XP. Streaks keep working either way.',
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
              updateHouseholdRewardSettings({ hygieneRewarded: false });
            }}
            onAllowanceRequests={(value) => void setAllowanceRequestsEnabled(value)}
            onOpenDeadline={() => setDeadlineOpen(true)}
          />
        ) : null}

        {section === 'sidekick-perms' ? (
          <SidekickPermissionsPanel
            household={household}
            accent={accentTheme.primary}
            busy={settingsToggleBusy}
            onCapabilities={(patch) =>
              guardSettingsToggle(() => updateMemberCapabilities(patch))
            }
            onGrocery={(value) =>
              guardSettingsToggle(() => {
                updateSidekickGroceryAdd(value);
                updateMemberCapabilities({ allowGroceryAdd: value });
              })
            }
            onPoppinsAi={(value) =>
              guardSettingsToggle(() => updateSidekickPoppinsAi(value))
            }
          />
        ) : null}

        {section === 'house' ? (
          <>
            {currentMember?.role === 'owner' ? (
              <Pressable
                onPress={() => router.push('/delete-household' as never)}
                style={[styles.accountBtn, { backgroundColor: '#F8717110', marginTop: 8 }]}>
                <Text style={[styles.accountBtnText, { color: '#F87171', textAlign: 'center' }]}>
                  Delete household
                </Text>
              </Pressable>
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
            <PoppinsModeCards
              prefs={poppinsPrefs}
              accent={accentTheme.primary}
              disabled={poppinsPrefsReadOnly}
              onSelectTier={(tier) => {
                if (poppinsPrefsReadOnly) return;
                void updatePoppinsPrefs(prefsForTier(tier));
              }}
            />
            {poppinsPrefsReadOnly ? (
              <Text style={[styles.caption, { color: orbitPalette.textMuted, marginTop: 8 }]}>
                {speakAs(majordomo.displayName, 'Only an admin can change how Poppins acts for this household.')}
              </Text>
            ) : null}
            <SettingsGroup>
              <SettingsNavRow
                icon="tune"
                iconColor={c.textMuted}
                label="Advanced"
                subtitle="Confirm time, undo, thinking, written replies, notifications."
                last
                onPress={() => setPoppinsAdvancedOpen(true)}
              />
            </SettingsGroup>
            <SettingsGroup>
              <SettingsNavRow
                icon="info-outline"
                iconColor={c.textMuted}
                label="How actions work"
                last
                onPress={() => setHowActionsOpen(true)}
              />
            </SettingsGroup>
            {permissions.canManageHousehold ? (
              <SettingsGroup footer={speakAs(majordomo.displayName, 'Sidekicks stay off Poppins until you turn this on.')}>
                <SettingsToggleRow
                  label="Allow Sidekick AI"
                  subtitle={speakAs(majordomo.displayName, 'Shows the Poppins tab for children / Sidekicks so they can Speak.')}
                  value={household.sidekickPoppinsAi === true}
                  disabled={settingsToggleBusy}
                  last
                  onValueChange={(value) => {
                    guardSettingsToggle(() => updateSidekickPoppinsAi(value));
                  }}
                />
              </SettingsGroup>
            ) : null}
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
            <SectionCard title={aiSummary.tripped ? 'Speak paused' : 'This month'}>
              <Text
                style={[
                  styles.nameText,
                  {
                    color: meterNearCap(aiSummary) || aiSummary.tripped ? accentTheme.primary : c.text,
                  },
                ]}>
                {permissions.canManageHousehold
                  ? `${aiSummary.tokensUsedThisPeriod} of ${TOKENS_PER_MONTH}`
                  : `${personalActTokens(aiSummary, currentMember?.id)} of ${TOKENS_PER_DAY} today`}
              </Text>
              <Text style={[styles.caption, { color: c.textMuted }]}>
                {aiSummary.tripped
                  ? POPPINS_PAUSED_COPY
                  : permissions.canManageHousehold
                    ? `${aiSummary.tokensUsedToday} today · resets ${new Date(aiSummary.periodResetsAt).toLocaleDateString()}${
                        aiSummary.topUpBalance ? ` · ${aiSummary.topUpBalance} top-up` : ''
                      }`
                    : 'Your daily actions. Household totals are admin-only.'}
              </Text>
              {(permissions.canManageHousehold
                ? aiSummary.byMember
                : aiSummary.byMember.filter((row) => row.memberId === currentMember?.id)
              ).map((row) => (
                <View key={row.memberId} style={styles.rowBetween}>
                  <Text style={[styles.memberName, { color: c.text }]}>{row.name}</Text>
                  <Text style={[styles.caption, { color: c.textMuted }]}>
                    {row.tokens} actions
                    {row.events ? ` · ${row.events}` : ''}
                  </Text>
                </View>
              ))}
              {permissions.canManageHousehold ? (
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/premium', params: { source: 'settings' } } as never)
                  }
                  hitSlop={8}
                  style={{ marginTop: 10 }}>
                  <Text style={[styles.caption, { color: accentTheme.primary, fontWeight: '600' }]}>
                    Buy more actions
                  </Text>
                </Pressable>
              ) : null}
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
          <HouseholdMembersRoster
            accent={accentTheme.primary}
            variant="embedded"
            onAddMember={() => setAddMemberOpen(true)}
            onShareInvite={openMemberInvite}
            onPersonalize={setPersonalizeMemberId}
            onOpenPersonaSwitch={() => setPersonaSwitchOpen(true)}
          />
          {currentMember?.role === 'owner' ? (
            <Pressable
              onPress={() => router.push('/delete-household' as never)}
              style={[styles.accountBtn, { backgroundColor: '#F8717110', marginTop: 16 }]}>
              <Text style={[styles.accountBtnText, { color: '#F87171', textAlign: 'center' }]}>
                Delete household
              </Text>
            </Pressable>
          ) : null}
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
                onPress={() => void enableAppleNotificationBanners()}>
                <Text style={[styles.linkText, { color: accentTheme.primary }]}>
                  Enable banners in Apple Settings
                </Text>
                <MaterialIcons name="open-in-new" size={16} color={accentTheme.primary} />
              </Pressable>
            ) : (
              <Pressable
                style={styles.linkRow}
                onPress={() => void openAppleNotificationSettings()}>
                <Text style={[styles.linkText, { color: accentTheme.primary }]}>
                  Open Apple notification settings
                </Text>
                <MaterialIcons name="chevron-right" size={16} color={accentTheme.primary} />
              </Pressable>
            )}

            <Text style={[styles.sectionHint, { color: orbitPalette.textMuted }]}>
              {speakAs(majordomo.displayName, 'Choose which Poppins alerts you want')} ({enabledCount} on)
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
            <Text style={[styles.sectionHint, { color: orbitPalette.textMuted, marginTop: 8 }]}>
              Your household inbox lives behind the bell icon — or Alerts → Inbox in Settings.
            </Text>
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
    <Modal
      visible={howActionsOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setHowActionsOpen(false)}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        onPress={() => setHowActionsOpen(false)}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: isDark ? '#1A1A1E' : '#FFFFFF',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24,
            paddingBottom: Math.max(insets.bottom, 24),
            gap: 12,
          }}>
          <Text style={[styles.nameText, { color: c.text }]}>How actions work</Text>
          <Text style={[styles.caption, { color: c.textMuted, lineHeight: 20 }]}>
            {speakAs(
              majordomo.displayName,
              'Every time Poppins saves something for you — a task, a grocery, an event — it uses an action.'
            )}
          </Text>
          <Text style={[styles.caption, { color: c.textMuted, lineHeight: 20 }]}>
            {speakAs(majordomo.displayName, 'Quiet Poppins uses 1 action.')} Speak back uses about{' '}
            {TOKEN_WEIGHT_SPEAK_BACK}, because talking back costs more to run.
          </Text>
          <Text style={[styles.caption, { color: c.textMuted, lineHeight: 20 }]}>
            {speakAs(majordomo.displayName, 'The less Poppins talks, the more actions you have.')}
          </Text>
          <Text style={[styles.caption, { color: c.textMuted, lineHeight: 20 }]}>
            You have {TOKENS_PER_MONTH} actions a month, and they reset on{' '}
            {new Date(aiSummary.periodResetsAt).toLocaleDateString()}. Typing works the same as
            speaking.
          </Text>
          <Pressable
            onPress={() => setHowActionsOpen(false)}
            style={{
              marginTop: 8,
              alignSelf: 'flex-end',
              paddingVertical: 10,
              paddingHorizontal: 16,
            }}>
            <Text style={{ color: accentTheme.primary, fontWeight: '600' }}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
    <PoppinsAdvancedSheet
      visible={poppinsAdvancedOpen}
      prefs={poppinsPrefs}
      disabled={poppinsPrefsReadOnly}
      onDismiss={() => setPoppinsAdvancedOpen(false)}
      onChange={(next) => {
        void updatePoppinsPrefs(next);
      }}
    />
    <DeadlinePickerSheet
      visible={deadlineOpen}
      doc={houseRulesDoc}
      current={houseRulesView.dailyDeadline ?? houseRulesDoc.settings.dailyDeadline.default}
      pending={household.dailyDeadlinePending}
      appliesOn={household.dailyDeadlineAppliesOn}
      use24h={houseRulesView.use24h}
      onClose={() => setDeadlineOpen(false)}
      onSelect={(hhmm) => {
        queueDailyDeadline(hhmm);
        setDeadlineOpen(false);
      }}
    />
    <ProfileInviteSheet
      visible={inviteTarget?.kind === 'profile'}
      member={inviteTarget?.kind === 'profile' ? inviteMember : null}
      householdName={household.householdName}
      onClose={() => setInviteTarget(null)}
    />
    <MemberInviteSheet
      visible={inviteTarget?.kind === 'token'}
      member={inviteTarget?.kind === 'token' ? inviteMember : null}
      householdId={household.id ?? ''}
      adminId={currentMember?.id ?? ''}
      actorIsOwner={currentMember?.role === 'owner'}
      invites={memberInvites}
      onChangeInvites={setMemberInvites}
      onClose={() => setInviteTarget(null)}
    />
    <HouseholdSwitchSheet
      visible={householdSwitchOpen && canSwitchHousehold}
      onClose={() => setHouseholdSwitchOpen(false)}
    />
    <AddMemberSheet
      visible={addMemberOpen}
      onDismiss={() => setAddMemberOpen(false)}
      onAdded={(member) => {
        void refreshHousehold().finally(() => openMemberInvite(member));
      }}
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
  sectionHeading: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  close: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  backRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  backChevron: { fontSize: 22, lineHeight: 24 },
  backLabel: { fontSize: 14, fontWeight: '600' },
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
  deletionBanner: {
    alignItems: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    padding: 14,
  },
});

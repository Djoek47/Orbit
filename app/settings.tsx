import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {  AppState, Image, Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { orbitAlert } from '@/components/orbit/orbit-alert';
import {
  DEFAULT_ACCENT_THEME_ID,
  migrateAccentThemeId,
  type AccentThemeId,
} from '@/constants/accent-themes';
import { Moji } from '@/components/orbit/moji/moji';
import { BrandLegalFooter } from '@/components/orbit/brand-legal-footer';
import { HouseholdSwitchSheet } from '@/components/orbit/household-switch-sheet';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { PaletteWheel } from '@/components/orbit/palette-wheel';
import { MemberGlyph } from '@/components/orbit/member-glyph';
import { PersonalizeLookSheet } from '@/components/orbit/personalize-look-sheet';
import { ProfileInviteSheet } from '@/components/orbit/profile-invite-sheet';
import { MemberInviteSheet } from '@/components/orbit/member-invite-sheet';
import { PoppinsSettingsPanel } from '@/components/orbit/poppins/poppins-settings-panel';
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
  loadErrorLog,
} from '@/lib/errors/error-log';
import { VOCAB } from '@/constants/vocabulary';
import {
  DEFAULT_POPPINS_INTERACTION_PREFS,
  loadPoppinsInteractionPrefs,
  savePoppinsInteractionPrefs,
  type PoppinsInteractionPrefs,
} from '@/lib/poppins/poppins-prefs';
import { isSignOutInFlight, signOutAndLeave } from '@/lib/auth/sign-out-and-leave';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { memberUsesProfileInvite } from '@/lib/household/member-invite-routing';
import { isHouseholdSwitchDisabled } from '@/lib/feature-flags';
import {
  formatHouseholdDeletionDate,
  householdDeletionDaysRemaining,
  isHouseholdDeletionPending,
  scheduleHouseholdDeletionDate,
} from '@/lib/household/household-deletion';
import { sendHouseholdDeletionEmail } from '@/lib/household/send-deletion-email';
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
import { IAP_SUBSCRIPTIONS } from '@/constants/billing';
import {
  fetchEntitlement,
  IAP_PRODUCTS,
  premiumCopy,
  restorePurchases,
  type EntitlementState,
} from '@/lib/billing/iap';
import { sendSubscriptionReceiptEmail } from '@/lib/billing/send-subscription-receipt';
import { formatPrice } from '@/lib/billing/topup-receipt';
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
import { usesMemberSettings } from '@/lib/settings/member-settings-model';
import { HouseholdMembersRoster } from '@/components/orbit/members/household-members-roster';
import { RewardsXpPanel } from '@/components/orbit/settings/rewards-xp-panel';
import { SidekickPermissionsPanel } from '@/components/orbit/settings/sidekick-permissions-panel';
import { useMembersLiveRefresh } from '@/lib/refresh/use-members-live-refresh';
import { AddMemberSheet } from '@/components/orbit/members/add-member-sheet';
import { SettingsGroup, SettingsNavRow } from '@/components/orbit/settings/grouped';
import { TourTarget } from '@/components/orbit/tour/tour-target';
import { useTourControls } from '@/components/orbit/tour/tour-provider';
import { chaptersForTour } from '@/lib/tour/tour-steps';
import { resolveTourId } from '@/lib/tour/tour-conditions';
import { isTourEnabledSync } from '@/lib/tour/tour-enabled';
import {
  meterCaption,
} from '@/lib/ai/credits';
import { personalActTokens, summarizeActUsage } from '@/lib/ai/act-events';

const SECTIONS = [
  'main',
  'you',
  'members',
  'house',
  'rewards',
  'sidekick-perms',
  'notifications',
  'places',
  'poppins',
  'premium',
] as const;

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
    updateMemberCapabilities,
    updateMemberCapabilityOverrides,
    updateSidekickGroceryAdd,
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

  // House rules (and anything else) can open a section directly: /settings?section=rewards
  // Getting started can land on exactly what it names: ?add=1 opens Add someone, and
  // ?invite=<memberId> opens that Sidekick's QR straight away (?invite=pick just shows the
  // roster). Before, every one of those rows dropped you on the Settings root.
  const params = useLocalSearchParams<{ section?: string; add?: string; invite?: string }>();
  const requestedSection = SECTIONS.includes(params.section as Section)
    ? (params.section as Section)
    : null;
  const [section, setSection] = useState<Section>(requestedSection ?? 'main');
  /** Voice-wheel drag — lock the sheet scroll so the dial owns the gesture. */
  const [wheelDragging, setWheelDragging] = useState(false);
  const lastRequested = useRef<string | null>(requestedSection);
  const handledIntent = useRef<string | null>(null);

  useEffect(() => {
    if (!requestedSection || requestedSection === lastRequested.current) return;
    lastRequested.current = requestedSection;
    setSection(requestedSection);
  }, [requestedSection]);

  // Never leave the sheet touch-locked after leaving Poppins or unmounting.
  useEffect(() => {
    if (section !== 'poppins') setWheelDragging(false);
  }, [section]);

  useFocusEffect(
    useCallback(() => {
      return () => setWheelDragging(false);
    }, [])
  );
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
  const [personalizeMemberId, setPersonalizeMemberId] = useState<string | null>(null);
  const [memberInvites, setMemberInvites] = useState<MemberInvite[]>([]);
  const [inviteTarget, setInviteTarget] = useState<
    { kind: 'profile'; memberId: string } | { kind: 'token'; memberId: string } | null
  >(null);
  const [householdSwitchOpen, setHouseholdSwitchOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [householdDefaultOpen, setHouseholdDefaultOpen] = useState(false);
  const [settingsToggleBusy, setSettingsToggleBusy] = useState(false);
  const [osNotifStatus, setOsNotifStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [poppinsPrefs, setPoppinsPrefs] = useState<PoppinsInteractionPrefs>(
    DEFAULT_POPPINS_INTERACTION_PREFS
  );
  const [errorCount, setErrorCount] = useState(0);
  const [emailTestBusy, setEmailTestBusy] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState<string | null>(null);
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
    void loadErrorLog().then((entries) => setErrorCount(entries.length));
  }, [section]);

  useFocusEffect(
    useCallback(() => {
      void loadErrorLog().then((entries) => setErrorCount(entries.length));
    }, [])
  );

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
      orbitAlert(
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
      orbitAlert(
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

  const refreshTopUpBalance = useCallback(async () => {
    const { loadTokenGrants, topUpBalanceFromGrants } = await import(
      '@/lib/billing/token-grants'
    );
    const grants = await loadTokenGrants(household.id);
    setTopUpBalance(topUpBalanceFromGrants(grants));
  }, [household.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refreshTopUpBalance();
      } catch {
        if (!cancelled) setTopUpBalance(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actEvents, refreshTopUpBalance]);

  useFocusEffect(
    useCallback(() => {
      if (section !== 'poppins' && section !== 'premium') return;
      void refreshTopUpBalance().catch((error) => {
        console.warn('settings.topUpRefresh.focus', error);
      });
    }, [refreshTopUpBalance, section])
  );

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

  // Act on ?add / ?invite once the roster is in hand.
  const intentKey = `${params.add ?? ''}:${params.invite ?? ''}`;
  useEffect(() => {
    if (intentKey === ':' || handledIntent.current === intentKey) return;
    if (!household.members.length) return;
    handledIntent.current = intentKey;
    if (params.add === '1') {
      setAddMemberOpen(true);
      return;
    }
    const wanted = params.invite;
    if (!wanted || wanted === 'pick') return;
    const member = household.members.find((m) => m.id === wanted);
    if (member) openMemberInvite(member);
  }, [intentKey, household.members, params.add, params.invite]);

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

  const fireTestEmail = useCallback(
    (
      kind:
        | 'subscription'
        | 'deletion-7d'
        | 'deletion-3d'
        | 'deletion-24h'
        | 'deletion-1h11m'
        | 'deletion-confirmed'
        | 'deletion-cancelled'
    ) => {
      if (emailTestBusy) return;
      setEmailTestBusy(true);
      setEmailTestStatus(null);
      void (async () => {
        try {
          const to = currentUser?.email || undefined;
          const name = currentMember?.name ?? currentUser?.name ?? undefined;
          const householdName = household.householdName || 'your household';
          if (kind === 'subscription') {
            const catalog = IAP_SUBSCRIPTIONS.yearly;
            const mailed = await sendSubscriptionReceiptEmail({
              to,
              name,
              plan: `Choremaxx ${catalog.label}`,
              price: `${formatPrice(catalog.priceUsd)}/year`,
              renewalDate: new Date(
                Date.now() + catalog.trialDays * 24 * 60 * 60 * 1000
              ).toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }),
              inTrial: true,
              mock: true,
              householdId: household.id ?? undefined,
            });
            setEmailTestStatus(
              mailed.ok
                ? `Subscription test → ${mailed.to}`
                : mailed.skipped
                  ? mailed.error
                  : `Failed: ${mailed.error}`
            );
            return;
          }

          const purgeIso = scheduleHouseholdDeletionDate();
          const base = {
            to,
            name,
            householdName,
            householdId: household.id ?? undefined,
            purgeDate: formatHouseholdDeletionDate(purgeIso),
            recoverUrl: 'https://www.choremaxx.app',
            optOutUrl: 'https://www.choremaxx.app',
            homeUrl: 'https://www.choremaxx.app',
            confirmUrl: 'https://www.choremaxx.app',
            cancelUrl: 'https://www.choremaxx.app',
            confirmBy: '24 hours',
          };

          const mailed =
            kind === 'deletion-cancelled'
              ? await sendHouseholdDeletionEmail({ ...base, kind: 'cancelled' })
              : kind === 'deletion-confirmed'
                ? await sendHouseholdDeletionEmail({ ...base, kind: 'confirmed' })
                : await sendHouseholdDeletionEmail({
                    ...base,
                    kind: 'reminder',
                    stage:
                      kind === 'deletion-7d'
                        ? '7d'
                        : kind === 'deletion-3d'
                          ? '3d'
                          : kind === 'deletion-24h'
                            ? '24h'
                            : '1h11m',
                  });

          setEmailTestStatus(
            mailed.ok
              ? `${mailed.kind} test → ${mailed.to}`
              : mailed.skipped
                ? mailed.error
                : `Failed: ${mailed.error}`
          );
        } catch (error) {
          setEmailTestStatus(error instanceof Error ? error.message : 'Could not send test email.');
        } finally {
          setEmailTestBusy(false);
        }
      })();
    },
    [
      currentMember?.name,
      currentUser?.email,
      currentUser?.name,
      emailTestBusy,
      household.householdName,
      household.id,
    ]
  );

  const openEmailTestPicker = useCallback(() => {
    orbitAlert('Email tests', 'Send a test transactional email to your signed-in address.', [
      { text: 'Subscription / trial', onPress: () => fireTestEmail('subscription') },
      { text: 'Deletion · 7 days', onPress: () => fireTestEmail('deletion-7d') },
      { text: 'Deletion · 3 days', onPress: () => fireTestEmail('deletion-3d') },
      { text: 'Deletion · 24 hours', onPress: () => fireTestEmail('deletion-24h') },
      { text: 'Deletion · 1 hour', onPress: () => fireTestEmail('deletion-1h11m') },
      { text: 'Deletion · confirm now', onPress: () => fireTestEmail('deletion-confirmed') },
      { text: 'Deletion · cancelled', onPress: () => fireTestEmail('deletion-cancelled') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [fireTestEmail]);

  const [signingOut, setSigningOut] = useState(false);

  const confirmAdminSignOut = () => {
    if (signingOut || isSignOutInFlight()) return;
    orbitAlert('Sign out?', 'You’ll return to Get Started. Your household stays saved on this account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          if (signingOut || isSignOutInFlight()) return;
          setSigningOut(true);
          void signOutAndLeave(signOut).finally(() => setSigningOut(false));
        },
      },
    ]);
  };

  const personalizeMember = useMemo(
    () => household.members.find((member) => member.id === personalizeMemberId) ?? null,
    [household.members, personalizeMemberId]
  );

  // Sidekicks and the shared iPad share one simpler screen — the iPad used to fall through
  // to the full household admin settings.
  if (usesMemberSettings(currentMember?.role)) {
    return <SidekickSettingsScreen />;
  }

  return (
    <>
    <View style={[styles.shell, { paddingTop: insets.top, backgroundColor: orbitPalette.backgroundSoft }]}>
      <Stack.Screen
        options={{
          headerShown: false,
          // Poppins voice wheel: horizontal drags must not dismiss the sheet or pop back.
          gestureEnabled: section !== 'poppins' && !wheelDragging,
          fullScreenGestureEnabled: section !== 'poppins' && !wheelDragging,
        }}
      />

      <View style={styles.handleRow} pointerEvents={wheelDragging ? 'none' : 'auto'}>
        <View style={[styles.handle, { backgroundColor: glassBorder(0.2) }]} />
      </View>

      <View style={styles.header} pointerEvents={wheelDragging ? 'none' : 'auto'}>
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
        contentContainerStyle={styles.content}
        scrollEnabled={!wheelDragging}>
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open household recovery"
                  onPress={() => {
                    if (currentMember?.role === 'owner' || currentMember?.role === 'admin') {
                      router.push('/household-recovery' as never);
                    }
                  }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <MaterialIcons name="hourglass-top" size={18} color="#FBBF24" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: c.text }]}>
                      Deletion scheduled
                    </Text>
                    <Text style={[styles.caption, { color: c.textMuted }]}>
                      {household.householdName} will be permanently deleted on{' '}
                      {formatHouseholdDeletionDate(household.deletionScheduledFor)} (
                      {householdDeletionDaysRemaining(household.deletionScheduledFor)} days left).{' '}
                      Reminder emails start in the final week (7d → 3d → 24h → ~1h).
                    </Text>
                    {currentMember?.role === 'owner' || currentMember?.role === 'admin' ? (
                      <Text
                        style={[
                          styles.caption,
                          { color: '#FBBF24', fontWeight: '700', marginTop: 4 },
                        ]}>
                        Tap to recover · countdown and options
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                {currentMember?.role === 'owner' || currentMember?.role === 'admin' ? (
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
                {/* The same glyph every other screen uses — a raw <Image> here showed an
                    empty circle whenever the photo couldn't be read, with no fallback. */}
                <MemberGlyph
                  member={currentMember ?? { name: currentUser?.name ?? 'You' }}
                  size={26}
                  photoStyle={styles.identityAvatarImage}
                />
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
                      onPress={() => router.navigate('/house-rules' as never)}
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
                      ].filter(Boolean).length
                    } of 7 allowed`}
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
                  onPress={() => router.navigate('/house-rules' as never)}
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

            {/* Profile / Day·Night already live on the identity card above — no second "You" row. */}

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
                  orbitAlert(
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
                icon="support-agent"
                iconColor="#FF8A3D"
                label="Support"
                subtitle={
                  errorCount > 0
                    ? `${errorCount} saved error${errorCount === 1 ? '' : 's'} · feedback`
                    : 'Feedback, errors, and help'
                }
                last={!permissions.canManageHousehold}
                onPress={() => router.push('/support' as never)}
              />
            </SettingsGroup>

            {permissions.canManageHousehold ? (
              <SettingsGroup header="Email tests">
                <SettingsNavRow
                  icon="outgoing-mail"
                  iconColor="#38BDF8"
                  label={emailTestBusy ? 'Sending…' : 'Send test email'}
                  subtitle={
                    emailTestStatus ??
                    'Subscription + deletion stages → your inbox'
                  }
                  last
                  onPress={openEmailTestPicker}
                />
              </SettingsGroup>
            ) : null}

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
                  orbitAlert('Privacy & legal', 'Open Choremaxx legal pages', [
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
              style={[
                styles.accountBtn,
                { backgroundColor: glass(0.06), opacity: signingOut ? 0.6 : 1 },
              ]}
              disabled={signingOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              accessibilityState={{ busy: signingOut, disabled: signingOut }}
              onPress={confirmAdminSignOut}>
              <Text style={[styles.accountBtnText, { color: orbitPalette.text, textAlign: 'center' }]}>
                {signingOut ? 'Signing out…' : 'Sign Out'}
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
            {/* Your picture lives with your colour — this is where you make yourself. */}
            <SectionCard title="Your picture">
              <Text style={[styles.caption, { color: orbitPalette.textMuted, marginBottom: 10 }]}>
                Draw a character with Apple Image Playground, pick a photo, or choose an emoji.
              </Text>
              <Pressable
                onPress={() => setPersonalizeMemberId(currentMember?.id ?? null)}
                disabled={!currentMember}
                accessibilityRole="button"
                accessibilityLabel="Change your picture"
                style={({ pressed }) => [styles.avatarRow, { opacity: pressed ? 0.85 : 1 }]}>
                <View
                  style={[
                    styles.avatarRing,
                    { borderColor: `${accentTheme.primary}66`, backgroundColor: `${accentTheme.primary}14` },
                  ]}>
                  <MemberGlyph member={currentMember ?? { name: currentUser?.name ?? 'You' }} size={54} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.nameText, { color: orbitPalette.text }]}>
                    {currentMember?.avatar ? 'Change your picture' : 'Make your character'}
                  </Text>
                  <Text style={[styles.caption, { color: orbitPalette.textMuted }]}>
                    Playground · Photos · Emoji
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={accentTheme.primary} />
              </Pressable>
            </SectionCard>

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
                orbitAlert(
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
              })
            }
            onMemberCapabilities={(memberId, patch) =>
              guardSettingsToggle(() => updateMemberCapabilityOverrides(memberId, patch))
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
          <PoppinsSettingsPanel
            prefs={poppinsPrefs}
            legacyProfileId={household.majordomoProfileId ?? currentMember?.majordomoProfileId}
            readOnly={poppinsPrefsReadOnly}
            isAdmin={permissions.canManageHousehold}
            usage={{
              used: permissions.canManageHousehold
                ? aiSummary.tokensUsedThisPeriod
                : personalActTokens(aiSummary, currentMember?.id),
              remaining: aiSummary.tokensRemaining,
              topUp: aiSummary.topUpBalance,
              resetsAt: aiSummary.periodResetsAt,
              paused: aiSummary.tripped,
            }}
            onPrefs={(next) => {
              if (poppinsPrefsReadOnly) return;
              void updatePoppinsPrefs(next);
            }}
            onVoiceWheelInteraction={setWheelDragging}
          />
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
                      orbitAlert('Restore', premiumCopy(next));
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
            onOpenPersonaSwitch={() => {
              void import('@/lib/device/device-session').then(({ markNeedsProfilePick }) =>
                markNeedsProfilePick().then(() => router.push('/select-profile' as never))
              );
            }}
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
                <Moji emoji={emoji} size={24} />
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

    <PersonalizeLookSheet
      visible={Boolean(personalizeMember)}
      memberName={personalizeMember?.name ?? 'you'}
      otherNames={household.members.map((m) => m.name)}
      currentAvatar={personalizeMember?.avatar}
      onDismiss={() => setPersonalizeMemberId(null)}
      onSelect={async (avatar) => {
        if (!personalizeMember) return;
        await updateMemberAvatar(personalizeMember.id, avatar);
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
          <Moji emoji={emoji} size={18} />
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
  avatarRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatarRing: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
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

import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/orbit/avatar';
import { BrandLegalFooter } from '@/components/orbit/brand-legal-footer';
import { BrandOpening } from '@/components/orbit/brand-opening';
import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { OnboardingProgress } from '@/components/orbit/onboarding-progress';
import { OnboardingPlaces } from '@/components/orbit/onboarding-places';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { PersonalizeLookSheet } from '@/components/orbit/personalize-look-sheet';
import { SetupMemberWizard } from '@/components/orbit/setup-member-wizard';
import { RewardPackagePicker } from '@/components/orbit/onboarding/reward-package-picker';
import { SetupRosterHub, type RosterSidekickInvite } from '@/components/orbit/setup-roster-hub';
import { SplashHooks } from '@/components/orbit/splash-hooks';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import {
  hasChosenAvatar,
  onboardingStepAfterIdentity,
  seedOnboardingAvatar,
} from '@/lib/profile/chosen-avatar';
import { orbitColors, radius, space, typography } from '@/constants/orbit-theme';
import {
  loadOnboardingPrefs,
  saveOnboardingPrefs,
  type OnboardingRole,
} from '@/lib/onboarding-prefs';
import {
  clearSetupDraft,
  createEmptyDraft,
  loadSetupDraft,
  memberIsComplete,
  saveSetupDraft,
  type DraftMember,
  type HouseholdSetupDraft,
} from '@/lib/onboarding/setup-draft';
import { rewardsFromDraftMember } from '@/lib/onboarding/materialize-setup';
import {
  capabilitiesFor,
  DEFAULT_REWARD_MODEL,
  REWARD_MODEL_OPTIONS,
  type RewardModel,
} from '@/lib/rewards/reward-model';
import {
  DEFAULT_REWARD_PACKAGE_ID,
  type RewardPackageId,
} from '@/lib/rewards/reward-packages';
import { type RewardMode, REWARD_MODE_COPY, REWARD_MODE_EXAMPLES, STREAK_FOOTNOTE } from '@/lib/rewards/reward-mode';
import { isAppleAuthAvailable, signInWithApple } from '@/lib/auth/apple-auth';
import { AuthErrorBanner } from '@/components/orbit/auth-error-banner';
import {
  authIssue,
  isAuthRateLimitError,
  isSafeHumanMessage,
  resolveAuthIssue,
  userFacingMessage,
  type AuthIssue,
} from '@/lib/auth/auth-errors';
import { isProfileNameComplete } from '@/lib/auth/display-name';
import {
  getPendingSignup,
  markAuthEmailSent,
} from '@/lib/auth/email-confirmation';
import { fetchEntitlement, isPremiumActive } from '@/lib/billing/iap';
import { markPremiumGatePending, premiumOnboardingHref } from '@/lib/billing/premium-onboarding';
import { shouldSkipPremiumForInvite } from '@/lib/billing/premium-invite';

import { buildInviteLinks, normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import { classifyInviteCode, inviteHref, nextInviteDestination } from '@/lib/invites/invite-intent';
import { stashInviteCode } from '@/lib/invite/invite-code-store';
import { cancelSignedOutRestart } from '@/lib/navigation/session-restart';
import { shareInvite } from '@/lib/invites/share-invite';
import {
  loadSidekickSession,
  wasSidekickSignedOut,
  type SidekickSession,
} from '@/lib/sidekick/session';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';
import type { HouseholdMember } from '@/types/orbit';

function householdSetupMessage(err: unknown, fallback: string): string {
  const text = err instanceof Error ? err.message.trim() : '';
  if (text && isSafeHumanMessage(text) && !/already exists/i.test(text)) return text;
  return fallback;
}

function mapSidekickInvitesByDraftId(
  draft: HouseholdSetupDraft,
  created: HouseholdMember[]
): Record<string, RosterSidekickInvite> {
  const out: Record<string, RosterSidekickInvite> = {};
  for (const draftMember of draft.members) {
    if (!memberIsComplete(draftMember)) continue;
    const match = created.find(
      (member) =>
        member.role === 'child' &&
        member.name.trim().toLowerCase() === draftMember.name.trim().toLowerCase()
    );
    if (!match?.profileInviteCode?.trim()) continue;
    const links = buildInviteLinks(match.profileInviteCode);
    out[draftMember.id] = {
      code: links.code,
      deepLink: links.deepLink,
      webLink: links.webLink,
    };
  }
  return out;
}

function mapCreatedMembersByDraftId(
  draft: HouseholdSetupDraft,
  created: HouseholdMember[]
): Record<string, { joinPreApproved?: boolean }> {
  const out: Record<string, { joinPreApproved?: boolean }> = {};
  for (const draftMember of draft.members) {
    const match = created.find(
      (member) => member.name.trim().toLowerCase() === draftMember.name.trim().toLowerCase()
    );
    if (match) {
      out[draftMember.id] = { joinPreApproved: match.joinPreApproved };
    }
  }
  return out;
}

function mapCreatedMemberIdsByDraftId(
  draft: HouseholdSetupDraft,
  created: HouseholdMember[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const draftMember of draft.members) {
    const match = created.find(
      (member) => member.name.trim().toLowerCase() === draftMember.name.trim().toLowerCase()
    );
    if (match) out[draftMember.id] = match.id;
  }
  return out;
}

type Step =
  | 'splash'
  | 'motivation'
  | 'reward-system'
  | 'reward-pack'
  | 'account'
  | 'profile'
  | 'household'
  | 'places'
  | 'roster'
  | 'member-wizard'
  | 'ready';

/** Stay on these steps after household create — Enter Choremaxx is the explicit exit. */
const ONBOARDING_EXIT_HOLD_STEPS: ReadonlySet<Step> = new Set([
  'household',
  'places',
  'roster',
  'member-wizard',
  'ready',
]);

export default function WelcomeOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const {
    accentTheme,
    addOnboardingMembers,
    createHousehold,
    createProfile,
    createReward,
    createTask,
    currentUser,
    hasHousehold,
    household,
    isLoading,
    isSignedIn,
    hydrateFromSession,
    restoreSidekickSession,
    applyStashedInvite,
    upsertSavedPlace,
    orbitPalette,
    redeemChildInvite,
    signUp,
    updateHouseholdRewardSettings,
    setMemberJoinPreApproved,
  } = useOrbit();

  const accent = accentTheme.primary;
  const ink = orbitPalette.ink;
  const bg = orbitPalette.background;

  const inviteParams = useLocalSearchParams<{
    invite?: string;
    kind?: string;
    memberInvite?: string;
  }>();
  const inviteFromRoute = (() => {
    const raw = Array.isArray(inviteParams.invite) ? inviteParams.invite[0] : inviteParams.invite;
    if (!raw?.trim()) return null;
    return parseInvitePayload(raw) ?? normalizeInviteCode(raw);
  })();
  const [step, setStep] = useState<Step>('splash');
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [selectedRole, setSelectedRole] = useState<OnboardingRole>('parent');
  const [selectedRewardModel, setSelectedRewardModel] = useState<RewardModel | null>(
    DEFAULT_REWARD_MODEL
  );
  const [selectedRewardMode, setSelectedRewardMode] = useState<RewardMode>('weighted');
  const [selectedRewardPackageId, setSelectedRewardPackageId] = useState<RewardPackageId>(
    DEFAULT_REWARD_PACKAGE_ID
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [draftAvatar, setDraftAvatar] = useState('');
  const [lookSheetOpen, setLookSheetOpen] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [createdHousehold, setCreatedHousehold] = useState(false);
  const [setupDraft, setSetupDraft] = useState<HouseholdSetupDraft>(() => createEmptyDraft());
  const [editingMember, setEditingMember] = useState<DraftMember | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const [error, setError] = useState('');
  const [accountIssue, setAccountIssue] = useState<AuthIssue | null>(null);
  const [signupRateLimited, setSignupRateLimited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [splashReady, setSplashReady] = useState(false);
  const [rosterPostCreate, setRosterPostCreate] = useState(false);
  const [postCreateDraft, setPostCreateDraft] = useState<HouseholdSetupDraft | null>(null);
  const [sidekickInvitesByDraftId, setSidekickInvitesByDraftId] = useState<
    Record<string, RosterSidekickInvite>
  >({});
  const [expandedInviteDraftId, setExpandedInviteDraftId] = useState<string | null>(null);
  const [createdMemberByDraftId, setCreatedMemberByDraftId] = useState<
    Record<string, { joinPreApproved?: boolean }>
  >({});
  const [createdMemberIdsByDraftId, setCreatedMemberIdsByDraftId] = useState<Record<string, string>>(
    {}
  );
  const [savedSidekick, setSavedSidekick] = useState<SidekickSession | null>(null);
  const [sidekickWelcomeBack, setSidekickWelcomeBack] = useState(false);

  const stepOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (step !== 'splash') return;
    let cancelled = false;
    void (async () => {
      const [session, signedOut] = await Promise.all([
        loadSidekickSession(),
        wasSidekickSignedOut(),
      ]);
      if (cancelled || !session || !signedOut) return;
      setSavedSidekick(session);
      setSidekickWelcomeBack(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  const roleMeta = { icon: 'admin-panel-settings' as const, title: 'Admin' };

  // Per-member admin invite — always land on redeem screen.
  useEffect(() => {
    const raw = Array.isArray(inviteParams.memberInvite)
      ? inviteParams.memberInvite[0]
      : inviteParams.memberInvite;
    if (!raw?.trim()) return;
    router.replace(`/redeem-member-invite?token=${encodeURIComponent(raw.trim())}` as never);
  }, [inviteParams.memberInvite]);

  // Deep link / stashed invite codes → join-profile or legacy unsupported.
  useEffect(() => {
    let cancelled = false;
    const memberInviteRaw = Array.isArray(inviteParams.memberInvite)
      ? inviteParams.memberInvite[0]
      : inviteParams.memberInvite;
    if (memberInviteRaw?.trim()) return;
    void import('@/lib/invite/invite-code-store').then(async ({ peekInviteCode }) => {
      const fromParam =
        typeof inviteParams.invite === 'string' && inviteParams.invite.trim()
          ? parseInvitePayload(inviteParams.invite) ?? normalizeInviteCode(inviteParams.invite)
          : null;
      const pending = fromParam || (await peekInviteCode());
      if (cancelled || !pending) return;
      await stashInviteCode(pending);
      const kind = inviteParams.kind === 'child' ? 'profile' : classifyInviteCode(pending) ?? 'household';
      const dest = nextInviteDestination(kind, {
        isSignedIn,
        isPendingMember: false,
        hasHousehold,
      });
      router.replace(inviteHref(dest, pending) as never);
    });
    return () => {
      cancelled = true;
    };
  }, [hasHousehold, inviteParams.invite, inviteParams.kind, inviteParams.memberInvite, isSignedIn]);

  // Resume mid-flow for signed-in users; hydrate prefs.
  useEffect(() => {
    if (isLoading || resumed) return;

    let cancelled = false;
    void (async () => {
      const [prefs, draft] = await Promise.all([loadOnboardingPrefs(), loadSetupDraft()]);
      if (cancelled) return;
      if (prefs) {
        setSelectedRole(prefs.role);
        setSelectedRewardModel(prefs.rewardModel ?? DEFAULT_REWARD_MODEL);
        setSelectedRewardMode(prefs.rewardMode ?? 'weighted');
      }
      if (draft) {
        setSetupDraft(draft);
        if (draft.rewardPackageId) {
          setSelectedRewardPackageId(draft.rewardPackageId as RewardPackageId);
        }
        if (draft.householdName) setHouseholdName(draft.householdName);
        if (draft.rewardModel) setSelectedRewardModel(draft.rewardModel);
        if (draft.scoringMode) setSelectedRewardMode(draft.scoringMode);
      }

      if (inviteFromRoute || inviteParams.memberInvite) {
        setResumed(true);
        return;
      }

      if (isSignedIn && hasHousehold && currentUser?.profileComplete) {
        setResumed(true);
        return;
      }

      const nameComplete = isProfileNameComplete(currentUser?.name, currentUser?.email);

      if (isSignedIn && (!nameComplete || !currentUser?.profileComplete)) {
        setDisplayName(nameComplete ? currentUser?.name || '' : '');
        setDraftAvatar(seedOnboardingAvatar(currentUser?.avatar));
        setStep('profile');
        setResumed(true);
        return;
      }

      if (isSignedIn && !hasHousehold) {
        setDisplayName(nameComplete ? currentUser?.name || '' : '');
        setDraftAvatar(seedOnboardingAvatar(currentUser?.avatar));
        setStep(
          onboardingStepAfterIdentity({
            nameComplete: true,
            avatar: currentUser?.avatar,
            householdDraftStarted: Boolean(draft?.householdName?.trim()),
          })
        );
        setResumed(true);
        return;
      }

      setResumed(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoading, isSignedIn, hasHousehold, currentUser, resumed]);

  const progressIndex = (() => {
    switch (step) {
      case 'motivation':
      case 'reward-system':
      case 'reward-pack':
        return 0;
      case 'account':
      case 'profile':
        return 1;
      case 'household':
      case 'places':
      case 'roster':
      case 'member-wizard':
        return 2;
      case 'ready':
        return 3;
      default:
        return -1;
    }
  })();

  const goBack = () => {
    setError('');
    switch (step) {
      case 'motivation':
        setStep('splash');
        break;
      case 'reward-system':
        setStep('motivation');
        break;
      case 'reward-pack':
        setStep('reward-system');
        break;
      case 'account':
        setStep(
          capabilitiesFor(selectedRewardModel ?? DEFAULT_REWARD_MODEL).rewardsEnabled
            ? 'reward-pack'
            : 'reward-system'
        );
        break;
      case 'profile':
        setStep('account');
        break;
      case 'household':
        setStep(currentUser?.profileComplete ? 'profile' : 'account');
        break;
      case 'places':
        setStep('household');
        break;
      case 'roster':
        setStep('places');
        break;
      case 'member-wizard':
        setStep('roster');
        break;
      case 'ready':
        setStep('roster');
        break;
      default:
        break;
    }
  };

  const canGoBack = step !== 'splash';
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  const canGoBackRef = useRef(canGoBack);
  canGoBackRef.current = canGoBack;

  const swipeBack = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          canGoBackRef.current &&
          Math.abs(gesture.dx) > 18 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onPanResponderRelease: (_evt, gesture) => {
          // Slide left (finger moves left) → previous step
          if (canGoBackRef.current && gesture.dx < -72 && Math.abs(gesture.vx) > 0.05) {
            goBackRef.current();
          }
        },
      }),
    []
  );

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    isAppleAuthAvailable().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const goToProfileOrHousehold = () => {
    const nameComplete = isProfileNameComplete(
      currentUser?.name || displayName,
      currentUser?.email
    );
    const next = onboardingStepAfterIdentity({
      nameComplete: nameComplete || Boolean(currentUser?.profileComplete),
      avatar: currentUser?.avatar || draftAvatar,
      householdDraftStarted: Boolean(setupDraft.householdName?.trim() || householdName.trim()),
    });
    if (next === 'profile') {
      setDisplayName(nameComplete ? currentUser?.name || displayName : displayName);
      setDraftAvatar(seedOnboardingAvatar(draftAvatar || currentUser?.avatar));
      setStep('profile');
      return;
    }
    setStep('household');
  };

  const handleGetStarted = () => {
    setError('');
    setSelectedRole('parent');
    setStep('motivation');
  };

  const handleMotivationContinue = () => {
    if (!selectedRewardModel) return;
    setError('');
    setStep('reward-system');
  };

  const advanceAfterPrefs = () => {
    if (isSignedIn) {
      goToProfileOrHousehold();
      return;
    }
    setStep('account');
  };

  const handleRewardSystemContinue = async () => {
    setError('');
    const rewardMode: RewardMode = selectedRewardMode ?? 'weighted';
    const rewardModel = selectedRewardModel ?? DEFAULT_REWARD_MODEL;
    try {
      await saveOnboardingPrefs({
        role: 'parent',
        rewardModel,
        rewardMode,
      });
      if (hasHousehold) {
        updateHouseholdRewardSettings({ rewardMode });
      }
      const nextDraft = await saveSetupDraft({
        ...setupDraft,
        rewardModel,
        scoringMode: rewardMode,
      });
      setSetupDraft(nextDraft);
    } catch {
      // Prefs are best-effort; still advance so onboarding isn't blocked.
    }
    if (capabilitiesFor(rewardModel).rewardsEnabled) {
      setStep('reward-pack');
      return;
    }
    advanceAfterPrefs();
  };

  const handleRewardPackContinue = async () => {
    setError('');
    const rewardMode: RewardMode = selectedRewardMode ?? 'weighted';
    const rewardModel = selectedRewardModel ?? DEFAULT_REWARD_MODEL;
    const rewardPackageId = selectedRewardPackageId ?? DEFAULT_REWARD_PACKAGE_ID;
    try {
      const nextDraft = await saveSetupDraft({
        ...setupDraft,
        rewardModel,
        scoringMode: rewardMode,
        rewardPackageId,
      });
      setSetupDraft(nextDraft);
    } catch {
      // Draft save is best-effort.
    }
    advanceAfterPrefs();
  };

  if (
    !isLoading &&
    isSignedIn &&
    currentUser?.profileComplete &&
    hasHousehold &&
    !ONBOARDING_EXIT_HOLD_STEPS.has(step)
  ) {
    const memberInviteRaw = Array.isArray(inviteParams.memberInvite)
      ? inviteParams.memberInvite[0]
      : inviteParams.memberInvite;
    if (memberInviteRaw?.trim()) {
      return (
        <Redirect
          href={`/redeem-member-invite?token=${encodeURIComponent(memberInviteRaw.trim())}` as never}
        />
      );
    }
    return <Redirect href="/" />;
  }

  const persistPrefs = async () => {
    await saveOnboardingPrefs({
      role: 'parent',
      rewardModel: selectedRewardModel ?? DEFAULT_REWARD_MODEL,
      rewardMode: selectedRewardMode ?? 'weighted',
    });
  };

  const handleAccountContinue = async () => {
    if (!email.trim() || !password.trim()) {
      setAccountIssue(authIssue('missing_fields'));
      setError('');
      return;
    }
    cancelSignedOutRestart();
    setBusy(true);
    setError('');
    setAccountIssue(null);
    setSignupRateLimited(false);
    try {
      await persistPrefs();
      const outcome = await signUp({ email: email.trim(), password });
      markAuthEmailSent();
      if (outcome.needsConfirmation) {
        router.push({
          pathname: '/confirm-email',
          params: { email: outcome.email },
        } as never);
        return;
      }
      const guessedName = email.split('@')[0]?.replace(/[._]/g, ' ') || '';
      setDisplayName((current) => current || guessedName);
      setStep('profile');
    } catch (err) {
      const issue = resolveAuthIssue(err);
      if (isAuthRateLimitError(err) || issue.code === 'rate_limit') {
        markAuthEmailSent();
        setSignupRateLimited(true);
      }
      setAccountIssue(issue);
    } finally {
      setBusy(false);
    }
  };

  const handleAppleContinue = async () => {
    cancelSignedOutRestart();
    setBusy(true);
    setError('');
    setAccountIssue(null);
    try {
      await persistPrefs();
      const session = await signInWithApple();
      const hydrated = await hydrateFromSession(session);
      const appleComplete = isProfileNameComplete(session.user.name, session.user.email);
      if (appleComplete) {
        setDisplayName(session.user.name);
      } else {
        setDisplayName('');
      }
      setDraftAvatar(seedOnboardingAvatar(session.user.avatar));
      const next = onboardingStepAfterIdentity({
        nameComplete: appleComplete,
        avatar: session.user.avatar,
      });
      const entitled = isPremiumActive(await fetchEntitlement());
      const skipPremium = await shouldSkipPremiumForInvite({
        memberInviteParam: Array.isArray(inviteParams.memberInvite)
          ? inviteParams.memberInvite[0]
          : inviteParams.memberInvite,
      });
      if (!entitled && !hydrated.id && !skipPremium) {
        await markPremiumGatePending();
        router.replace(premiumOnboardingHref({ source: 'onboarding' }) as never);
        return;
      }
      setStep(next);
    } catch (err) {
      const issue = resolveAuthIssue(err);
      if (issue.code === 'apple_canceled') return;
      setAccountIssue(issue);
    } finally {
      setBusy(false);
    }
  };

  const handleProfileContinue = async () => {
    if (!displayName.trim()) {
      setError('Add your name to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await persistPrefs();
      await createProfile({
        name: displayName.trim(),
        avatar: draftAvatar.trim() || undefined,
      });
      if (!householdName.trim()) {
        setHouseholdName(`The ${displayName.trim().split(' ')[0]} Home`);
      }
      setStep('household');
    } catch (err) {
      setError(userFacingMessage(err, 'Could not save profile.'));
    } finally {
      setBusy(false);
    }
  };

  const handleHouseholdContinue = async () => {
    setBusy(true);
    setError('');
    try {
      await persistPrefs();
      if (!householdName.trim()) {
        setError('Add a household name to continue.');
        setBusy(false);
        return;
      }
      const nextDraft = await saveSetupDraft({
        ...setupDraft,
        householdName: householdName.trim(),
        rewardModel: selectedRewardModel ?? DEFAULT_REWARD_MODEL,
        scoringMode: selectedRewardMode ?? 'weighted',
      });
      setSetupDraft(nextDraft);
      setStep('places');
    } catch (err) {
      setError(userFacingMessage(err, 'Household setup failed.'));
    } finally {
      setBusy(false);
    }
  };

  const persistDraftMembers = async (members: DraftMember[]) => {
    const next = await saveSetupDraft({
      ...setupDraft,
      householdName: householdName.trim() || setupDraft.householdName,
      rewardModel: selectedRewardModel ?? DEFAULT_REWARD_MODEL,
      scoringMode: selectedRewardMode ?? 'weighted',
      members,
    });
    setSetupDraft(next);
    return next;
  };

  const materializeDraft = async (draft: HouseholdSetupDraft, setupComplete: boolean) => {
    const createdHousehold = await createHousehold({
      name: draft.householdName.trim(),
      rewardModel: draft.rewardModel,
      rewardMode: draft.scoringMode,
      setupComplete,
      joinApprovalRequired: false,
    });
    if (!createdHousehold?.id) {
      throw new Error('Could not create household. Try again.');
    }
    const householdId = createdHousehold.id;
    updateHouseholdRewardSettings({ rewardMode: draft.scoringMode });

    // Finish-later: persist every named draft person. Create: prefer complete ones,
    // but still keep named incomplete members so Manage Members isn't empty.
    const rosterMembers = draft.members.filter((m) => m.name.trim());
    const toPersist = setupComplete
      ? rosterMembers.filter((m) => m.setupComplete || m.name.trim())
      : rosterMembers;

    let created: Awaited<ReturnType<typeof addOnboardingMembers>> = [];
    if (toPersist.length > 0) {
      try {
        created = await addOnboardingMembers(
          householdId,
          toPersist.map((m) => ({
            name: m.name.trim(),
            role: m.role,
            avatar: m.avatar,
            plannedTaskLibraryIds: m.setupComplete ? m.taskLibraryIds : [],
            joinPreApproved: m.joinPreApproved,
          })),
          { householdName: draft.householdName.trim() }
        );
        for (const member of toPersist.filter((m) => m.setupComplete)) {
          const matched = created.find(
            (c) => c.name.trim().toLowerCase() === member.name.trim().toLowerCase()
          );
          for (const reward of rewardsFromDraftMember(member, draft.rewardPackageId)) {
            await createReward(
              {
                ...reward,
                assignedMemberId: matched?.id,
                assignedMemberName: matched?.name ?? member.name.trim(),
                cost: 0,
              },
              { householdId }
            );
          }
        }
      } catch (err) {
        console.warn('materializeDraft.addMembers', err);
        const who = toPersist[0]?.name.trim() || 'everyone';
        throw new Error(
          `Your household is saved. Couldn’t add ${who} yet. Try Create again.`
        );
      }
    }
    for (const place of draft.places ?? []) {
      if (!place.address.trim()) continue;
      upsertSavedPlace({
        id: `place-${place.kind}`,
        name: place.name || (place.kind === 'home' ? 'Home' : 'Place'),
        kind: place.kind,
        address: place.address.trim(),
        placeQuery: place.address.trim(),
        lat: place.lat,
        lng: place.lng,
        emoji:
          place.kind === 'home'
            ? '🏠'
            : place.kind === 'school'
              ? '🏫'
              : place.kind === 'clothing'
                ? '👕'
                : '🛒',
        isFavorite: place.kind === 'home',
        pickupItemNames: [],
      });
    }
    setCreatedHousehold(true);
    await clearSetupDraft();
    return created;
  };

  const handleCreateFromRoster = async () => {
    setBusy(true);
    setError('');
    try {
      await persistPrefs();
      const draftSnapshot = setupDraft;
      const created = await materializeDraft(draftSnapshot, true);
      const invites = mapSidekickInvitesByDraftId(draftSnapshot, created);
      setPostCreateDraft(draftSnapshot);
      setSidekickInvitesByDraftId(invites);
      setCreatedMemberByDraftId(mapCreatedMembersByDraftId(draftSnapshot, created));
      setCreatedMemberIdsByDraftId(mapCreatedMemberIdsByDraftId(draftSnapshot, created));
      setExpandedInviteDraftId(
        draftSnapshot.members.find((member) => memberIsComplete(member) && invites[member.id])?.id ??
          null
      );
      setRosterPostCreate(true);
    } catch (err) {
      setError(householdSetupMessage(err, 'Could not create household.'));
    } finally {
      setBusy(false);
    }
  };

  const handleContinueFromRoster = () => {
    setStep('ready');
  };

  const handleShareRosterSidekick = async (
    member: DraftMember,
    invite: RosterSidekickInvite
  ) => {
    setShareStatus('');
    try {
      const result = await shareInvite({
        householdName: household.householdName || householdName,
        inviteCode: invite.code,
        deepLink: invite.deepLink,
        webLink: invite.webLink,
        kind: 'kid',
        childName: member.name.trim(),
      });
      setShareStatus(
        result === 'shared'
          ? Platform.OS === 'ios'
            ? `Shared ${member.name.trim()}'s invite — pick AirDrop or Messages.`
            : `Shared ${member.name.trim()}'s invite.`
          : 'Share dismissed.'
      );
    } catch {
      setShareStatus('Could not open share sheet.');
    }
  };

  const handleFinishLater = async () => {
    if (!householdName.trim() && !setupDraft.householdName.trim()) {
      setError('Add a household name before saving.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await persistPrefs();
      const draft = await saveSetupDraft({
        ...setupDraft,
        householdName: householdName.trim() || setupDraft.householdName,
      });
      const draftSnapshot = draft;
      const created = await materializeDraft(draftSnapshot, false);
      const invites = mapSidekickInvitesByDraftId(draftSnapshot, created);
      setPostCreateDraft(draftSnapshot);
      setSidekickInvitesByDraftId(invites);
      setCreatedMemberByDraftId(mapCreatedMembersByDraftId(draftSnapshot, created));
      setCreatedMemberIdsByDraftId(mapCreatedMemberIdsByDraftId(draftSnapshot, created));
      setExpandedInviteDraftId(
        draftSnapshot.members.find((member) => memberIsComplete(member) && invites[member.id])?.id ??
          null
      );
      setRosterPostCreate(true);
    } catch (err) {
      setError(householdSetupMessage(err, 'Could not save household.'));
    } finally {
      setBusy(false);
    }
  };

  const handleEnter = () => {
    router.replace('/' as never);
  };

  const handleContinueSidekick = async () => {
    setBusy(true);
    setError('');
    try {
      const restored = await restoreSidekickSession();
      if (!restored) {
        setError('Could not restore your profile. Scan your Sidekick code again.');
        return;
      }
      router.replace('/' as never);
    } catch (err) {
      setError(userFacingMessage(err, 'Could not restore your profile.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: bg,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 16,
        },
      ]}
      {...swipeBack.panHandlers}>
      <LinearGradient
        colors={[`${accent}28`, 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.ambient}
        pointerEvents="none"
      />

      {step === 'splash' ? (
        <View style={styles.splashScreen}>
          <View style={styles.splashCenter}>
            <BrandOpening
              tagline="Your household, quietly run."
              onReady={() => setSplashReady(true)}
            />
            <SplashHooks visible={splashReady} />
          </View>

          <View
            style={[styles.splashBottom, !splashReady && styles.splashBottomHidden]}
            pointerEvents={splashReady ? 'auto' : 'none'}>
            <View style={styles.splashCtaBlock}>
              {sidekickWelcomeBack && savedSidekick ? (
                <>
                  <OrbitButton disabled={busy} onPress={() => void handleContinueSidekick()}>
                    {busy ? 'Opening…' : `Continue as ${savedSidekick.displayName}`}
                  </OrbitButton>
                  <Text
                    style={[
                      typography.footnote,
                      { color: orbitPalette.textMuted, textAlign: 'center', lineHeight: 20 },
                    ]}>
                    Welcome back — pick up where you left off, or start fresh below.
                  </Text>
                </>
              ) : null}
              <OrbitButton onPress={handleGetStarted}>Get Started</OrbitButton>
              <OrbitButton tone="secondary" onPress={() => setScannerOpen(true)}>
                Scan to join household
              </OrbitButton>
              {error && step === 'splash' ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable onPress={() => router.push('/sign-in' as never)} style={styles.signInLink}>
                <Text style={[styles.signInText, { color: orbitPalette.textMuted }]}>
                  Already have an account?{' '}
                  <Text style={[styles.signInAccent, { color: accent }]}>Sign in</Text>
                </Text>
              </Pressable>
            </View>
            <BrandLegalFooter compact showLogo={false} style={styles.splashLegal} />
          </View>
        </View>
      ) : null}

      {step !== 'splash' ? (
        <Animated.View style={[styles.stepFade, { opacity: stepOpacity }]}>
          {step === 'motivation' ? (
            <KeyboardScreen contentContainerStyle={styles.scroll}>
              <Header progress={progressIndex} accent={accent} onBack={goBack} />
              <Text style={[typography.title1, styles.stepTitle, { color: orbitPalette.text }]}>
                How should chores feel?
              </Text>
              <Text style={[typography.footnote, styles.mb, { color: orbitPalette.textMuted }]}>
                Change anytime in Settings.
              </Text>
              <View style={styles.motivationGrid}>
                {REWARD_MODEL_OPTIONS.map((opt) => {
                  const active = selectedRewardModel === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setSelectedRewardModel(opt.id)}
                      style={[
                        styles.motivationCard,
                        {
                          backgroundColor: active ? `${accent}22` : orbitPalette.card,
                          borderColor: active ? `${accent}55` : orbitPalette.border,
                        },
                        opt.id === 'full' && styles.motivationWide,
                      ]}>
                      <View style={styles.motivationTop}>
                        {opt.recommended ? (
                          <View style={[styles.recommendedPill, { backgroundColor: `${accent}33` }]}>
                            <Text style={[styles.recommendedText, { color: accent }]}>Recommended</Text>
                          </View>
                        ) : (
                          <View />
                        )}
                        {active ? (
                          <View style={[styles.miniCheck, { backgroundColor: accent }]}>
                            <Text style={[styles.radioCheck, { color: ink }]}>✓</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.motivationLabel, { color: orbitPalette.text }]}>
                        {opt.title}
                      </Text>
                      <Text style={[styles.motivationDesc, { color: orbitPalette.textMuted }]}>
                        {opt.subtitle}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <OrbitButton disabled={!selectedRewardModel} onPress={handleMotivationContinue}>
                Continue
              </OrbitButton>
            </KeyboardScreen>
          ) : null}

          {step === 'reward-system' ? (
            <KeyboardScreen contentContainerStyle={styles.scroll}>
              <Header progress={progressIndex} accent={accent} onBack={goBack} />
              <Text style={[typography.title1, styles.stepTitle, { color: orbitPalette.text }]}>
                Meritocracy or Equity?
              </Text>
              <Text style={[typography.footnote, styles.mb, { color: orbitPalette.textMuted }]}>
                How points are scored. Change anytime in Settings.
              </Text>
              <View style={styles.rewardModeList}>
                {(['weighted', 'flat'] as RewardMode[]).map((mode) => {
                  const copy = REWARD_MODE_COPY[mode];
                  const active = selectedRewardMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      onPress={() => setSelectedRewardMode(mode)}
                      style={[
                        styles.rewardModeCard,
                        {
                          backgroundColor: active ? `${accent}22` : orbitPalette.card,
                          borderColor: active ? `${accent}55` : orbitPalette.border,
                        },
                      ]}>
                      <View style={styles.rewardModeHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.motivationLabel, { color: orbitPalette.text }]}>
                            {copy.label}
                            {mode === 'weighted' ? ' · Recommended' : ''}
                          </Text>
                          <Text style={[styles.motivationDesc, { color: orbitPalette.textMuted }]}>
                            {copy.blurb}
                          </Text>
                        </View>
                        {active ? (
                          <View style={[styles.miniCheck, { backgroundColor: accent }]}>
                            <Text style={[styles.radioCheck, { color: ink }]}>✓</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.rewardExampleList}>
                        {REWARD_MODE_EXAMPLES[mode].map((example) => (
                          <View key={example.task} style={styles.rewardExampleRow}>
                            <Text style={[styles.rewardExampleTask, { color: orbitPalette.text }]}>
                              {example.task}
                            </Text>
                            <Text style={[styles.rewardExampleXp, { color: accent }]}>
                              {example.xp} XP
                            </Text>
                          </View>
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[typography.footnote, styles.rewardSettingsHint, { color: orbitPalette.textSubtle }]}>
                {STREAK_FOOTNOTE}
              </Text>
              <OrbitButton onPress={() => void handleRewardSystemContinue()}>Continue</OrbitButton>
            </KeyboardScreen>
          ) : null}

          {step === 'reward-pack' ? (
            <KeyboardScreen contentContainerStyle={styles.scroll}>
              <Header progress={progressIndex} accent={accent} onBack={goBack} />
              <Text style={[typography.title1, styles.stepTitle, { color: orbitPalette.text }]}>
                Pick a reward starter pack
              </Text>
              <Text style={[typography.footnote, styles.mb, { color: orbitPalette.textMuted }]}>
                Cute, ready-made prizes for your household. You can change these anytime.
              </Text>
              <RewardPackagePicker
                selectedId={selectedRewardPackageId}
                accent={accent}
                onSelect={setSelectedRewardPackageId}
              />
              <OrbitButton onPress={() => void handleRewardPackContinue()}>Continue</OrbitButton>
            </KeyboardScreen>
          ) : null}

          {step === 'account' ? (
            <KeyboardScreen contentContainerStyle={styles.scroll}>
              <Header progress={progressIndex} accent={accent} onBack={goBack} />
              <Text style={[typography.title1, styles.stepTitle, { color: orbitPalette.text }]}>
                Create your account
              </Text>
              <Text style={[typography.footnote, styles.mb, { color: orbitPalette.textMuted }]}>
                One account for your household. We&apos;ll confirm by email when needed.
              </Text>
              {appleAvailable && Platform.OS === 'ios' ? (
                <>
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={16}
                    style={styles.appleButton}
                    onPress={() => void handleAppleContinue()}
                  />
                  <View style={styles.dividerRow}>
                    <View
                      style={[styles.divider, { backgroundColor: orbitPalette.border }]}
                    />
                    <Text style={[styles.dividerText, { color: orbitPalette.textSubtle }]}>
                      or use email
                    </Text>
                    <View
                      style={[styles.divider, { backgroundColor: orbitPalette.border }]}
                    />
                  </View>
                </>
              ) : null}
              <OrbitInput
                autoCapitalize="none"
                keyboardType="email-address"
                label="Email"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (accountIssue) setAccountIssue(null);
                }}
              />
              <OrbitInput
                autoCapitalize="none"
                secureTextEntry
                label="Password"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (accountIssue) setAccountIssue(null);
                }}
              />
              <AuthErrorBanner
                issue={accountIssue}
                actionParams={{ email: email.trim() }}
                onDismiss={() => setAccountIssue(null)}
              />
              <OrbitButton disabled={busy} onPress={() => void handleAccountContinue()}>
                {busy ? 'Creating…' : 'Continue'}
              </OrbitButton>
              {signupRateLimited && !accountIssue ? (
                <Pressable
                  onPress={() => {
                    const pending = getPendingSignup();
                    router.push({
                      pathname: '/confirm-email',
                      params: { email: pending?.email ?? email.trim() },
                    } as never);
                  }}
                  style={styles.signInLink}>
                  <Text style={[styles.signInText, { color: accent }]}>
                    Already got an email? Open confirmation
                  </Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => router.push('/sign-in' as never)} style={styles.signInLink}>
                <Text style={[styles.signInText, { color: orbitPalette.textMuted }]}>
                  Already have an account? Sign in
                </Text>
              </Pressable>
            </KeyboardScreen>
          ) : null}

          {step === 'profile' ? (
            <KeyboardScreen contentContainerStyle={styles.scroll}>
              <Header progress={progressIndex} accent={accent} onBack={goBack} />
              <Text style={[typography.title1, styles.stepTitle, { color: orbitPalette.text }]}>
                What should we call you?
              </Text>
              <Text style={[typography.footnote, styles.mb, { color: orbitPalette.textMuted }]}>
                Your name inside the household — not your email code. Apple Sign-In may prefill this;
                you can change it anytime in Settings.
              </Text>
              <Pressable
                onPress={() => setLookSheetOpen(true)}
                style={styles.profileAvatarRow}
                accessibilityRole="button"
                accessibilityLabel={
                  hasChosenAvatar(draftAvatar)
                    ? 'Change your profile picture'
                    : 'Choose a profile picture'
                }>
                <Avatar
                  name={displayName.trim() || 'You'}
                  emoji={
                    draftAvatar && !isAvatarImageUri(draftAvatar)
                      ? draftAvatar
                      : memberDisplayEmoji({ name: displayName.trim() || 'You', avatar: draftAvatar })
                  }
                  imageUri={isAvatarImageUri(draftAvatar) ? draftAvatar : undefined}
                  size="xl"
                />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.headline, { color: orbitPalette.text }]}>
                    {hasChosenAvatar(draftAvatar) ? 'Change photo' : 'Choose a photo'}
                  </Text>
                  <Text style={[typography.footnote, { color: orbitPalette.textMuted, marginTop: 2 }]}>
                    {hasChosenAvatar(draftAvatar)
                      ? 'Photos, Image Playground, or emoji'
                      : 'No photo yet — pick one from Photos, Image Playground, or emoji. You can skip.'}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={orbitPalette.textSubtle} />
              </Pressable>
              <OrbitInput label="Display name" value={displayName} onChangeText={setDisplayName} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <OrbitButton disabled={busy} onPress={handleProfileContinue}>
                {busy ? 'Saving…' : 'Continue'}
              </OrbitButton>
            </KeyboardScreen>
          ) : null}

          {step === 'household' ? (
            <KeyboardScreen contentContainerStyle={styles.scroll}>
              <Header progress={progressIndex} accent={accent} onBack={goBack} />
              <Text style={[typography.title1, styles.stepTitle, { color: orbitPalette.text }]}>
                Household name
              </Text>
              <Text style={[typography.footnote, styles.mb, { color: orbitPalette.textMuted }]}>
                One name for everyone pitching in.
              </Text>
              <OrbitInput
                label="Household name"
                value={householdName}
                onChangeText={setHouseholdName}
                placeholder="e.g. The Martin Family"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <OrbitButton disabled={busy || !householdName.trim()} onPress={handleHouseholdContinue}>
                {busy ? 'Working…' : 'Continue'}
              </OrbitButton>
            </KeyboardScreen>
          ) : null}

          {step === 'places' ? (
            <KeyboardScreen contentContainerStyle={styles.scroll}>
              <Header progress={progressIndex} accent={accent} onBack={goBack} />
              <OnboardingPlaces
                places={setupDraft.places ?? []}
                accent={accent}
                onChange={(next) => {
                  const draft = { ...setupDraft, places: next };
                  setSetupDraft(draft);
                  void saveSetupDraft(draft);
                }}
                onContinue={() => setStep('roster')}
                onSkip={() => setStep('roster')}
              />
            </KeyboardScreen>
          ) : null}

          {step === 'roster' ? (
            <KeyboardScreen contentContainerStyle={styles.scroll}>
              <Header progress={progressIndex} accent={accent} onBack={goBack} />
              <SetupRosterHub
                draft={postCreateDraft ?? setupDraft}
                ownerName={displayName.trim() || currentUser?.name || 'You'}
                ownerAvatar={draftAvatar || currentUser?.avatar}
                busy={busy}
                rosterPostCreate={rosterPostCreate}
                sidekickInvitesByDraftId={sidekickInvitesByDraftId}
                expandedInviteDraftId={expandedInviteDraftId}
                onToggleSidekickInvite={(draftId) =>
                  setExpandedInviteDraftId((current) => (current === draftId ? null : draftId))
                }
                onShareSidekick={(member, invite) => void handleShareRosterSidekick(member, invite)}
                onEditName={() => setStep('household')}
                onEditOwnerName={() => setStep('profile')}
                onAddMember={() => {
                  setEditingMember(null);
                  setStep('member-wizard');
                }}
                onEditMember={(member) => {
                  setEditingMember(member);
                  setStep('member-wizard');
                }}
                onCreateHousehold={() => void handleCreateFromRoster()}
                onContinue={handleContinueFromRoster}
                onFinishLater={() => void handleFinishLater()}
              />
              {shareStatus ? (
                <Text style={[styles.shareHint, { color: accent }]}>{shareStatus}</Text>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </KeyboardScreen>
          ) : null}

          {step === 'member-wizard' ? (
            <KeyboardScreen style={styles.memberWizardShell} contentContainerStyle={styles.memberWizardContent}>
              <Header progress={progressIndex} accent={accent} onBack={goBack} />
              <SetupMemberWizard
                rewardModel={selectedRewardModel ?? DEFAULT_REWARD_MODEL}
                rewardMode={selectedRewardMode ?? setupDraft.scoringMode ?? 'weighted'}
                defaultRewardPackageId={
                  setupDraft.rewardPackageId ?? selectedRewardPackageId ?? DEFAULT_REWARD_PACKAGE_ID
                }
                initial={editingMember}
                onCancel={() => setStep('roster')}
                onConfirm={(member) => {
                  void (async () => {
                    const others = setupDraft.members.filter((m) => m.id !== member.id);
                    await persistDraftMembers([...others, member]);
                    setEditingMember(null);
                    setStep('roster');
                  })();
                }}
              />
            </KeyboardScreen>
          ) : null}

          {step === 'ready' ? (
            <ScrollView
              contentContainerStyle={[styles.scroll, styles.readyScroll]}
              showsVerticalScrollIndicator={false}>
              <View style={[styles.readyBadge, { backgroundColor: accent }]}>
                <MaterialIcons
                  name={roleMeta?.icon ?? 'home'}
                  size={28}
                  color={orbitPalette.ink}
                />
              </View>
              <Text
                style={[
                  typography.title1,
                  styles.readyTitle,
                  { color: orbitPalette.text },
                ]}>
                You&apos;re in.
              </Text>
              <Text style={[styles.readySub, { color: orbitPalette.textMuted }]}>
                Share a personal invite for each person from Settings → Members, or from your roster above.
              </Text>

              {shareStatus ? (
                <Text style={[styles.shareHint, { color: accent }]}>{shareStatus}</Text>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <OrbitButton onPress={handleEnter}>Enter Choremaxx</OrbitButton>
              <Pressable onPress={handleEnter} style={styles.secondary}>
                <Text style={[typography.headline, { color: orbitPalette.textMuted, textAlign: 'center' }]}>
                  Send invites later
                </Text>
              </Pressable>
            </ScrollView>
          ) : null}
        </Animated.View>
      ) : null}

      <InviteQrScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={(code) => {
          setScannerOpen(false);
          setError('');
          const kind = classifyInviteCode(code);
          if (kind === 'profile') {
            router.replace(`/join-profile?code=${encodeURIComponent(code)}` as never);
            return;
          }
          router.replace(inviteHref('invite-unsupported', code) as never);
        }}
      />
      <PersonalizeLookSheet
        visible={lookSheetOpen}
        memberName={displayName.trim() || 'you'}
        currentAvatar={draftAvatar || undefined}
        onDismiss={() => setLookSheetOpen(false)}
        onSelect={(avatar) => {
          setDraftAvatar(avatar);
        }}
      />
    </View>
  );
}

function Header({
  progress,
  accent,
  onBack,
}: {
  progress: number;
  accent: string;
  onBack?: () => void;
}) {
  return (
    <View style={styles.topRow}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <MaterialIcons name="chevron-left" size={22} color={accent} />
          <Text style={[styles.backLabel, { color: accent }]}>Back</Text>
        </Pressable>
      ) : (
        <ChoremaxxLogo size="sm" />
      )}
      <OnboardingProgress activeIndex={progress} accent={accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  ambient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  stepFade: {
    flex: 1,
  },
  stepTitle: {
    letterSpacing: -0.45,
    marginBottom: 4,
  },
  profileAvatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginBottom: space.md,
    paddingVertical: 4,
  },
  splashScreen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
  },
  splashCenter: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingBottom: 24,
    width: '100%',
  },
  splashHooks: {
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 8,
    width: '100%',
  },
  hookRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  hookDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  hookText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  splashBottom: {
    alignItems: 'stretch',
    gap: 16,
    opacity: 1,
    paddingBottom: 4,
    width: '100%',
  },
  splashBottomHidden: {
    opacity: 0,
  },
  splashCtaBlock: {
    alignSelf: 'stretch',
    gap: 14,
  },
  splashLegal: {
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 4,
    width: '100%',
  },
  emoji: {
    fontSize: 24,
  },
  error: {
    color: orbitColors.danger,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  mb: {
    marginBottom: space.md,
  },
  miniCheck: {
    alignItems: 'center',
    backgroundColor: orbitColors.primary,
    borderRadius: 999,
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  modeChip: {
    alignItems: 'center',
    borderRadius: radius.card,
    flex: 1,
    paddingVertical: 10,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  modeRow: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.cardLarge,
    flexDirection: 'row',
    gap: 4,
    marginBottom: space.md,
    padding: 4,
  },
  motivationCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: 2,
    gap: 4,
    padding: space.md,
    width: '48%',
  },
  motivationDesc: {
    fontSize: 12,
  },
  motivationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: space.md,
  },
  motivationLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  motivationTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  motivationWide: {
    width: '100%',
  },
  recommendedPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rewardModeList: {
    gap: 12,
    marginBottom: space.sm,
  },
  rewardModeCard: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: 2,
    gap: 12,
    padding: space.md,
  },
  rewardModeHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  rewardExampleList: {
    gap: 6,
  },
  rewardExampleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rewardExampleTask: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  rewardExampleXp: {
    fontSize: 13,
    fontWeight: '700',
  },
  rewardSettingsHint: {
    marginBottom: space.md,
    marginTop: 4,
  },
  perk: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  perkText: {
    fontSize: 11,
    fontWeight: '500',
  },
  perkWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  radio: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    marginTop: 4,
    width: 22,
  },
  radioCheck: {
    color: orbitColors.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  readyBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: orbitColors.primary,
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  readyEmoji: {
    fontSize: 48,
  },
  readyRole: {
    color: orbitColors.primary,
    fontWeight: '600',
  },
  readyScroll: {
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingTop: space.xxl,
  },
  readySub: {
    fontSize: 14,
    marginBottom: space.md,
    textAlign: 'center',
  },
  readyTitle: {
    textAlign: 'center',
  },
  secondary: {
    gap: 6,
    paddingVertical: 8,
  },
  inviteCode: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  invitePanel: {
    marginBottom: space.md,
  },
  kidInviteBox: {
    marginBottom: space.md,
  },
  kidInviteCard: {
    backgroundColor: 'rgba(7,13,28,0.35)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 12,
    padding: space.md,
  },
  kidInviteEyebrow: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  kidInviteName: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  tabletCodeRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
  },
  tabletCodeInput: {
    flex: 1,
  },
  tabletChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabletChip: {
    backgroundColor: 'rgba(245,158,11,0.16)',
    borderColor: 'rgba(245,158,11,0.4)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabletChipText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
  },
  qrWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: space.md,
  },
  shareHint: {
    color: orbitColors.primary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  roleBody: {
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minWidth: 0,
    paddingRight: 4,
  },
  roleCaption: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  roleCard: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.09)',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 14,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  roleEmoji: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  roleFooter: {
    marginTop: 'auto',
    paddingBottom: 8,
    paddingTop: 28,
  },
  roleIntro: {
    gap: 10,
    marginBottom: 8,
    marginTop: 8,
  },
  roleList: {
    flexGrow: 1,
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  roleScroll: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  roleSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  roleTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  scroll: {
    gap: 4,
    paddingBottom: space.xxl,
    paddingHorizontal: space.xl,
  },
  memberWizardShell: {
    flex: 1,
  },
  memberWizardContent: {
    flexGrow: 1,
    gap: 4,
    paddingBottom: space.md,
    paddingHorizontal: space.xl,
  },
  appleButton: {
    height: 48,
    width: '100%',
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginVertical: 4,
  },
  divider: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  signInLink: {
    paddingVertical: 8,
  },
  signInText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  signInAccent: {
    color: orbitColors.primary,
    fontWeight: '700',
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  backBtn: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    marginLeft: -6,
    paddingVertical: 4,
    paddingRight: 8,
  },
  inviteBack: {
    alignSelf: 'flex-start',
    marginLeft: -10,
    marginBottom: 8,
    width: '100%',
  },
  backLabel: {
    color: orbitColors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  typeChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: orbitColors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: space.md,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});

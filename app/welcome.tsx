import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { Avatar } from '@/components/orbit/avatar';
import { BrandLegalFooter } from '@/components/orbit/brand-legal-footer';
import { BrandOpening } from '@/components/orbit/brand-opening';
import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { OnboardingProgress } from '@/components/orbit/onboarding-progress';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { PersonalizeLookSheet } from '@/components/orbit/personalize-look-sheet';
import { SetupMemberWizard } from '@/components/orbit/setup-member-wizard';
import { SetupRosterHub } from '@/components/orbit/setup-roster-hub';
import { SplashHooks } from '@/components/orbit/splash-hooks';
import { StreakFootnote } from '@/components/orbit/streak-marker';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { orbitColors, radius, space, typography } from '@/constants/orbit-theme';
import {
  ONBOARDING_ROLES,
  loadOnboardingPrefs,
  saveOnboardingPrefs,
  skipsMotivation,
  type OnboardingRole,
} from '@/lib/onboarding-prefs';
import {
  clearSetupDraft,
  createEmptyDraft,
  loadSetupDraft,
  saveSetupDraft,
  type DraftMember,
  type HouseholdSetupDraft,
} from '@/lib/onboarding/setup-draft';
import { rewardsFromDraftMember, tasksFromDraftMember } from '@/lib/onboarding/materialize-setup';
import {
  DEFAULT_REWARD_MODEL,
  REWARD_MODEL_OPTIONS,
  type RewardModel,
} from '@/lib/rewards/reward-model';
import {
  REWARD_MODE_COPY,
  REWARD_MODE_EXAMPLES,
  type RewardMode,
} from '@/lib/rewards/reward-mode';
import { isAppleAuthAvailable, signInWithApple } from '@/lib/auth/apple-auth';
import { isAuthRateLimitError } from '@/lib/auth/auth-errors';
import {
  getPendingSignup,
  markAuthEmailSent,
} from '@/lib/auth/email-confirmation';

import { buildInviteLinks, normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import { shareInvite } from '@/lib/invites/share-invite';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

type Step =
  | 'splash'
  | 'role'
  | 'motivation'
  | 'reward-system'
  | 'account'
  | 'profile'
  | 'household'
  | 'roster'
  | 'member-wizard'
  | 'child-invite'
  | 'tablet-invite'
  | 'ready';

export default function WelcomeOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const {
    accentTheme,
    connectSharedTabletProfiles,
    createChildInvites,
    createHousehold,
    createProfile,
    createReward,
    createTask,
    currentUser,
    hasHousehold,
    household,
    inviteLinks,
    isLoading,
    isSignedIn,
    hydrateFromSession,
    joinHousehold,
    orbitPalette,
    redeemChildInvite,
    signUp,
    updateHouseholdRewardSettings,
  } = useOrbit();

  const accent = accentTheme.primary;
  const ink = orbitPalette.ink;
  const bg = orbitPalette.background;

  const [step, setStep] = useState<Step>('splash');
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [selectedRole, setSelectedRole] = useState<OnboardingRole | null>(null);
  const [selectedRewardModel, setSelectedRewardModel] = useState<RewardModel | null>(
    DEFAULT_REWARD_MODEL
  );
  const [selectedRewardMode, setSelectedRewardMode] = useState<RewardMode>('weighted');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [draftAvatar, setDraftAvatar] = useState('');
  const [lookSheetOpen, setLookSheetOpen] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [householdMode, setHouseholdMode] = useState<'create' | 'join'>('create');
  const [createdHousehold, setCreatedHousehold] = useState(false);
  const [setupDraft, setSetupDraft] = useState<HouseholdSetupDraft>(() => createEmptyDraft());
  const [editingMember, setEditingMember] = useState<DraftMember | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const [error, setError] = useState('');
  const [signupRateLimited, setSignupRateLimited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [splashReady, setSplashReady] = useState(false);
  const [kidNameOne, setKidNameOne] = useState('');
  const [kidNameTwo, setKidNameTwo] = useState('');
  const [kidInvites, setKidInvites] = useState<
    { id: string; name: string; code: string; deepLink: string; webLink: string }[]
  >([]);
  const [tabletCodes, setTabletCodes] = useState<string[]>([]);
  const [tabletCodeDraft, setTabletCodeDraft] = useState('');
  const [tabletLabel, setTabletLabel] = useState('Shared tablet');

  const stepOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (step === 'splash') return;
    stepOpacity.setValue(0);
    Animated.timing(stepOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [step, stepOpacity]);

  const roleMeta = useMemo(
    () => ONBOARDING_ROLES.find((role) => role.id === selectedRole),
    [selectedRole],
  );

  // Resume mid-flow for signed-in users; hydrate prefs.
  useEffect(() => {
    if (isLoading || resumed) return;

    loadOnboardingPrefs().then((prefs) => {
      if (prefs) {
        setSelectedRole(prefs.role);
        setSelectedRewardModel(prefs.rewardModel ?? DEFAULT_REWARD_MODEL);
        setSelectedRewardMode(prefs.rewardMode ?? 'weighted');
      }
    });
    loadSetupDraft().then((draft) => {
      if (draft) {
        setSetupDraft(draft);
        if (draft.householdName) setHouseholdName(draft.householdName);
        if (draft.rewardModel) setSelectedRewardModel(draft.rewardModel);
        if (draft.scoringMode) setSelectedRewardMode(draft.scoringMode);
      }
    });

    if (isSignedIn && hasHousehold && currentUser?.profileComplete) {
      setResumed(true);
      return;
    }

    if (isSignedIn && currentUser?.profileComplete && !hasHousehold) {
      setDisplayName(currentUser.name || '');
      setStep('household');
      setResumed(true);
      return;
    }

    if (isSignedIn && !currentUser?.profileComplete) {
      setDisplayName(currentUser?.name || '');
      setStep('profile');
      setResumed(true);
      return;
    }

    setResumed(true);
  }, [isLoading, isSignedIn, hasHousehold, currentUser, resumed]);

  const readyInvite = useMemo(() => {
    const code = inviteLinks?.code || household.inviteCode;
    if (!code) return null;
    return {
      code,
      deepLink: inviteLinks?.deepLink || buildInviteLinks(code).deepLink,
      webLink: inviteLinks?.webLink || buildInviteLinks(code).webLink,
    };
  }, [household.inviteCode, inviteLinks]);

  const progressIndex = (() => {
    switch (step) {
      case 'role':
        return 0;
      case 'motivation':
      case 'reward-system':
        return 1;
      case 'child-invite':
      case 'tablet-invite':
        return 1;
      case 'account':
      case 'profile':
        return 2;
      case 'household':
      case 'roster':
      case 'member-wizard':
        return 3;
      case 'ready':
        return 4;
      default:
        return -1;
    }
  })();

  const goBack = () => {
    setError('');
    switch (step) {
      case 'role':
        setStep('splash');
        break;
      case 'motivation':
        setStep('role');
        break;
      case 'reward-system':
        setStep('motivation');
        break;
      case 'child-invite':
      case 'tablet-invite':
        setStep('role');
        break;
      case 'account':
        setStep(selectedRole && skipsMotivation(selectedRole) ? 'role' : 'reward-system');
        break;
      case 'profile':
        setStep('account');
        break;
      case 'household':
        setStep(currentUser?.profileComplete ? 'profile' : 'account');
        break;
      case 'roster':
        setStep('household');
        break;
      case 'member-wizard':
        setStep('roster');
        break;
      case 'ready':
        setStep(
          selectedRole === 'child'
            ? 'child-invite'
            : selectedRole === 'shared-tablet'
              ? 'tablet-invite'
              : 'roster',
        );
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

  if (!isLoading && isSignedIn && currentUser?.profileComplete && hasHousehold) {
    return <Redirect href="/" />;
  }

  const handleRoleContinue = () => {
    if (!selectedRole) return;
    setError('');
    // Kids never create an account — they redeem a parent AirDrop / invite.
    if (selectedRole === 'child') {
      setSelectedRewardModel(selectedRewardModel ?? DEFAULT_REWARD_MODEL);
      setHouseholdMode('join');
      setStep('child-invite');
      return;
    }
    // Shared / tablet — invite codes or AirDrop, no tablet email.
    if (selectedRole === 'shared-tablet') {
      setSelectedRewardModel(selectedRewardModel ?? DEFAULT_REWARD_MODEL);
      setHouseholdMode('join');
      setStep('tablet-invite');
      return;
    }
    if (skipsMotivation(selectedRole)) {
      setSelectedRewardModel(selectedRewardModel ?? DEFAULT_REWARD_MODEL);
      setStep(isSignedIn ? (currentUser?.profileComplete ? 'household' : 'profile') : 'account');
      return;
    }
    setStep('motivation');
  };

  const handleMotivationContinue = () => {
    if (!selectedRewardModel) return;
    setError('');
    setStep('reward-system');
  };

  const advanceAfterPrefs = () => {
    setStep(isSignedIn ? (currentUser?.profileComplete ? 'household' : 'profile') : 'account');
  };

  const handleRewardSystemContinue = async () => {
    setError('');
    const rewardMode = selectedRewardMode ?? 'weighted';
    const rewardModel = selectedRewardModel ?? DEFAULT_REWARD_MODEL;
    try {
      await saveOnboardingPrefs({
        role: selectedRole ?? 'parent',
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
    advanceAfterPrefs();
  };

  const persistPrefs = async () => {
    await saveOnboardingPrefs({
      role: selectedRole ?? 'parent',
      rewardModel: selectedRewardModel ?? DEFAULT_REWARD_MODEL,
      rewardMode: selectedRewardMode ?? 'weighted',
    });
  };

  const handleAccountContinue = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter an email and password to continue.');
      return;
    }
    setBusy(true);
    setError('');
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
      if (isAuthRateLimitError(err)) {
        markAuthEmailSent();
        setSignupRateLimited(true);
        setError(err.message);
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      setBusy(false);
    }
  };

  const handleAppleContinue = async () => {
    setBusy(true);
    setError('');
    try {
      await persistPrefs();
      const session = await signInWithApple();
      await hydrateFromSession(session);
      if (session.user.name) {
        setDisplayName(session.user.name);
      }
      setStep(session.user.profileComplete ? 'household' : 'profile');
    } catch (err) {
      if ((err as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      const msg = err instanceof Error ? err.message : 'Apple Sign-In failed.';
      setError(msg);
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
      if (!householdName.trim() && roleMeta) {
        setHouseholdName(`The ${displayName.trim().split(' ')[0]} Home`);
      }
      setStep('household');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleHouseholdContinue = async () => {
    setBusy(true);
    setError('');
    try {
      await persistPrefs();
      if (householdMode === 'join') {
        const parsed =
          parseInvitePayload(inviteCode) ?? (inviteCode.trim() ? normalizeInviteCode(inviteCode) : null);
        if (!parsed) {
          setError('Enter or scan a valid invite code.');
          setBusy(false);
          return;
        }
        setInviteCode(parsed);
        await joinHousehold({ inviteCode: parsed });
        setCreatedHousehold(false);
        setStep('ready');
        return;
      }
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
      setStep('roster');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Household setup failed.');
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
    await createHousehold({
      name: draft.householdName.trim(),
      rewardModel: draft.rewardModel,
      rewardMode: draft.scoringMode,
      setupComplete,
    });
    updateHouseholdRewardSettings({ rewardMode: draft.scoringMode });
    const completeMembers = draft.members.filter((m) => m.setupComplete && m.name.trim());
    if (completeMembers.length > 0) {
      const created = await createChildInvites(completeMembers.map((m) => m.name.trim()));
      for (const member of completeMembers) {
        const matched = created.find(
          (c) => c.name.trim().toLowerCase() === member.name.trim().toLowerCase()
        );
        for (const task of tasksFromDraftMember(member)) {
          await createTask(task);
        }
        for (const reward of rewardsFromDraftMember(member)) {
          await createReward({
            ...reward,
            assignedMemberId: matched?.id,
            assignedMemberName: matched?.name ?? member.name.trim(),
            cost: 0,
          });
        }
      }
    }
    setCreatedHousehold(true);
    await clearSetupDraft();
  };

  const handleCreateFromRoster = async () => {
    setBusy(true);
    setError('');
    try {
      await persistPrefs();
      await materializeDraft(setupDraft, true);
      setStep('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create household.');
    } finally {
      setBusy(false);
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
      await materializeDraft(draft, false);
      setStep('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save household.');
    } finally {
      setBusy(false);
    }
  };

  const handleAirDropInvite = async () => {
    if (!readyInvite) return;
    setShareStatus('');
    try {
      const result = await shareInvite({
        householdName: household.householdName || householdName,
        inviteCode: readyInvite.code,
        deepLink: readyInvite.deepLink,
        webLink: readyInvite.webLink,
      });
      setShareStatus(
        result === 'shared'
          ? Platform.OS === 'ios'
            ? 'Shared — pick AirDrop or Messages in the sheet.'
            : 'Invite shared.'
          : 'Share dismissed.',
      );
    } catch {
      setShareStatus('Could not open share sheet.');
    }
  };

  const handleChildInviteContinue = async () => {
    setBusy(true);
    setError('');
    try {
      await saveOnboardingPrefs({
        role: 'child',
        rewardModel: selectedRewardModel ?? DEFAULT_REWARD_MODEL,
      });
      const parsed =
        parseInvitePayload(inviteCode) ?? (inviteCode.trim() ? normalizeInviteCode(inviteCode) : null);
      if (!parsed) {
        setError('Enter or scan the kid invite your parent sent.');
        setBusy(false);
        return;
      }
      setInviteCode(parsed);
      await redeemChildInvite(parsed);
      router.replace('/' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open kid invite.');
    } finally {
      setBusy(false);
    }
  };

  const addTabletCode = (raw: string) => {
    const parsed = parseInvitePayload(raw) ?? (raw.trim() ? normalizeInviteCode(raw) : null);
    if (!parsed) {
      setError('Enter or scan a valid profile invite code.');
      return;
    }
    setError('');
    setTabletCodes((current) => (current.includes(parsed) ? current : [...current, parsed]));
    setTabletCodeDraft('');
    setInviteCode(parsed);
  };

  const handleTabletInviteContinue = async () => {
    setBusy(true);
    setError('');
    try {
      await saveOnboardingPrefs({
        role: 'shared-tablet',
        rewardModel: selectedRewardModel ?? DEFAULT_REWARD_MODEL,
      });
      const codes = tabletCodes.length
        ? tabletCodes
        : tabletCodeDraft.trim()
          ? [tabletCodeDraft]
          : inviteCode.trim()
            ? [inviteCode]
            : [];
      const result = await connectSharedTabletProfiles(codes, tabletLabel);
      router.replace((result.needsProfilePick ? '/select-profile' : '/') as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set up this tablet.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateKidInvites = async () => {
    setBusy(true);
    setError('');
    setShareStatus('');
    try {
      const created = await createChildInvites([kidNameOne, kidNameTwo]);
      const next = created.map((member) => {
        const links = buildInviteLinks(member.profileInviteCode || member.id);
        return {
          id: member.id,
          name: member.name,
          code: links.code,
          deepLink: links.deepLink,
          webLink: links.webLink,
        };
      });
      setKidInvites(next);
      setShareStatus(
        next.length === 1
          ? 'Kid profile saved on your admin account. AirDrop the invite below.'
          : 'Kid profiles saved on your admin account. AirDrop each invite below.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create kid invites.');
    } finally {
      setBusy(false);
    }
  };

  const handleShareKidInvite = async (invite: {
    name: string;
    code: string;
    deepLink: string;
    webLink: string;
  }) => {
    setShareStatus('');
    try {
      const result = await shareInvite({
        householdName: household.householdName || householdName,
        inviteCode: invite.code,
        deepLink: invite.deepLink,
        webLink: invite.webLink,
        kind: 'kid',
        childName: invite.name,
      });
      setShareStatus(
        result === 'shared'
          ? Platform.OS === 'ios'
            ? `Shared ${invite.name}'s invite — pick AirDrop or Messages.`
            : `Shared ${invite.name}'s invite.`
          : 'Share dismissed.',
      );
    } catch {
      setShareStatus('Could not open share sheet.');
    }
  };

  const handleEnter = () => {
    router.replace('/' as never);
  };

  const showKidInviteBox =
    createdHousehold &&
    selectedRole !== 'child' &&
    selectedRole !== 'shared-tablet';

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
              <OrbitButton onPress={() => setStep('role')}>Get Started</OrbitButton>
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
          {step === 'role' ? (
            <KeyboardScreen contentContainerStyle={[styles.scroll, styles.roleScroll]}>
              <Header progress={progressIndex} accent={accent} onBack={goBack} />
              <View style={styles.roleIntro}>
                <Text style={[typography.title1, styles.stepTitle, { color: orbitPalette.text }]}>
                  Who&apos;s using Choremaxx?
                </Text>
                <Text style={[styles.roleCaption, { color: orbitPalette.textMuted }]}>
                  We&apos;ll shape the home around you.
                </Text>
              </View>
              <View style={styles.roleList}>
                {ONBOARDING_ROLES.map((role) => {
                  const active = selectedRole === role.id;
                  return (
                    <Pressable
                      key={role.id}
                      onPress={() => setSelectedRole(role.id)}
                      style={[
                        styles.roleCard,
                        {
                          backgroundColor: active
                            ? `${role.color}18`
                            : orbitPalette.card,
                          borderColor: active ? `${role.color}66` : orbitPalette.border,
                        },
                        active && {
                          shadowColor: role.color,
                          shadowOpacity: 0.35,
                          shadowRadius: 14,
                          shadowOffset: { width: 0, height: 0 },
                          elevation: 4,
                        },
                      ]}>
                      <View
                        style={[
                          styles.roleEmoji,
                          {
                            backgroundColor: active
                              ? `${role.color}28`
                              : orbitPalette.cardMuted,
                            borderColor: active ? `${role.color}44` : orbitPalette.border,
                          },
                        ]}>
                        <Text style={styles.emoji}>{role.emoji}</Text>
                      </View>
                      <View style={styles.roleBody}>
                        <Text style={[styles.roleTitle, { color: orbitPalette.text }]}>
                          {role.title}
                        </Text>
                        <Text
                          style={[
                            styles.roleSubtitle,
                            { color: active ? role.color : orbitPalette.textMuted },
                          ]}>
                          {role.subtitle}
                        </Text>
                        <View style={styles.perkWrap}>
                          {role.perks.map((perk) => (
                            <View
                              key={perk}
                              style={[
                                styles.perk,
                                {
                                  backgroundColor: active
                                    ? `${role.color}18`
                                    : orbitPalette.cardMuted,
                                },
                              ]}>
                              <Text
                                style={[
                                  styles.perkText,
                                  {
                                    color: active
                                      ? orbitPalette.textSoft
                                      : orbitPalette.textMuted,
                                  },
                                ]}>
                                {perk}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <View
                        style={[
                          styles.radio,
                          active && { backgroundColor: role.color, borderColor: role.color },
                        ]}>
                        {active ? (
                          <Text style={[styles.radioCheck, { color: ink }]}>✓</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.roleFooter}>
                <OrbitButton disabled={!selectedRole} onPress={handleRoleContinue}>
                  Continue
                </OrbitButton>
              </View>
            </KeyboardScreen>
          ) : null}

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
                What reward system would you like to put in place?
              </Text>
              <Text style={[typography.footnote, styles.mb, { color: orbitPalette.textMuted }]}>
                You can change this in Settings.
              </Text>
              <View
                style={styles.rewardModeList}
                accessibilityRole="radiogroup"
                accessibilityLabel="What reward system would you like to put in place?">
                {(['weighted', 'flat'] as const).map((mode) => {
                  const active = selectedRewardMode === mode;
                  const copy = REWARD_MODE_COPY[mode];
                  const examples = REWARD_MODE_EXAMPLES[mode];
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
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={[styles.motivationLabel, { color: orbitPalette.text }]}>
                            {copy.label}
                          </Text>
                          <Text style={[styles.motivationDesc, { color: orbitPalette.textSubtle }]}>
                            {copy.blurb}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.radio,
                            active && { backgroundColor: accent, borderColor: accent },
                          ]}>
                          {active ? (
                            <Text style={[styles.radioCheck, { color: ink }]}>✓</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.rewardExampleList}>
                        {examples.map((row) => (
                          <View key={row.task} style={styles.rewardExampleRow}>
                            <Text
                              style={[styles.rewardExampleTask, { color: orbitPalette.textSoft }]}
                              numberOfLines={1}>
                              {row.task}
                            </Text>
                            <Text style={[styles.rewardExampleXp, { color: orbitPalette.textMuted }]}>
                              {selectedRewardModel === 'allowance'
                                ? `$${(row.xp / 10).toFixed(0)}`
                                : `${row.xp} XP`}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <StreakFootnote />
              <OrbitButton onPress={() => void handleRewardSystemContinue()}>Continue</OrbitButton>
            </KeyboardScreen>
          ) : null}

          {step === 'child-invite' ? (
            <KeyboardScreen contentContainerStyle={styles.scroll}>
              <Header progress={progressIndex} accent={accent} onBack={goBack} />
              <Text style={[typography.title1, styles.stepTitle, { color: orbitPalette.text }]}>
                Join with an invite
              </Text>
              <Text style={[typography.footnote, styles.mb, { color: orbitPalette.textMuted }]}>
                No email needed. Open the AirDrop your parent sent, scan their QR, or enter your kid
                code.
              </Text>
              <OrbitButton onPress={() => setScannerOpen(true)}>Scan invite QR</OrbitButton>
              <OrbitInput
                autoCapitalize="characters"
                label="Kid invite code"
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="e.g. CMX-EMMA"
              />
              <Text style={[typography.footnote, { color: orbitPalette.textSubtle }]}>
                Demo: CMX-EMMA · CMX-LIAM · CMX-JOSH · CMX-TODD
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <OrbitButton disabled={busy} onPress={() => void handleChildInviteContinue()}>
                {busy ? 'Opening…' : 'Enter Choremaxx'}
              </OrbitButton>
            </KeyboardScreen>
          ) : null}

          {step === 'tablet-invite' ? (
            <KeyboardScreen contentContainerStyle={styles.scroll}>
              <Header progress={progressIndex} accent={accent} onBack={goBack} />
              <Text style={[typography.title1, styles.stepTitle, { color: orbitPalette.text }]}>
                Connect this tablet
              </Text>
              <Text style={[typography.footnote, styles.mb, { color: orbitPalette.textMuted }]}>
                Add profiles via AirDrop or invite codes from a parent. No tablet email — the admin
                account keeps everything saved.
              </Text>
              <OrbitInput
                label="Device name"
                value={tabletLabel}
                onChangeText={setTabletLabel}
                placeholder="Shared tablet"
              />
              <OrbitButton onPress={() => setScannerOpen(true)}>Scan invite QR</OrbitButton>
              <View style={styles.tabletCodeRow}>
                <View style={styles.tabletCodeInput}>
                  <OrbitInput
                    autoCapitalize="characters"
                    label="Profile invite code"
                    value={tabletCodeDraft}
                    onChangeText={setTabletCodeDraft}
                    placeholder="e.g. CMX-JOSH"
                  />
                </View>
                <OrbitButton
                  tone="secondary"
                  disabled={!tabletCodeDraft.trim()}
                  onPress={() => addTabletCode(tabletCodeDraft)}>
                  Add
                </OrbitButton>
              </View>
              {tabletCodes.length > 0 ? (
                <View style={styles.tabletChipWrap}>
                  {tabletCodes.map((code) => (
                    <Pressable
                      key={code}
                      onPress={() =>
                        setTabletCodes((current) => current.filter((item) => item !== code))
                      }
                      style={[
                        styles.tabletChip,
                        {
                          backgroundColor: `${orbitColors.warning}22`,
                          borderColor: `${orbitColors.warning}66`,
                        },
                      ]}>
                      <Text style={[styles.tabletChipText, { color: orbitColors.warning }]}>
                        {code} ✕
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={[typography.footnote, { color: orbitPalette.textSubtle }]}>
                  Demo: add CMX-JOSH and CMX-TODD for a two-profile tablet.
                </Text>
              )}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <OrbitButton
                disabled={busy || (tabletCodes.length === 0 && !tabletCodeDraft.trim())}
                onPress={() => void handleTabletInviteContinue()}>
                {busy ? 'Setting up…' : 'Continue on this tablet'}
              </OrbitButton>
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
                onChangeText={setEmail}
              />
              <OrbitInput
                autoCapitalize="none"
                secureTextEntry
                label="Password"
                value={password}
                onChangeText={setPassword}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <OrbitButton disabled={busy} onPress={() => void handleAccountContinue()}>
                {busy ? 'Creating…' : 'Continue'}
              </OrbitButton>
              {signupRateLimited ? (
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
                Your name inside the household. Add a photo if you like.
              </Text>
              <Pressable
                onPress={() => setLookSheetOpen(true)}
                style={styles.profileAvatarRow}
                accessibilityRole="button"
                accessibilityLabel="Personalize your look">
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
                  <Text style={[typography.headline, { color: orbitPalette.text }]}>Photo</Text>
                  <Text style={[typography.footnote, { color: orbitPalette.textMuted, marginTop: 2 }]}>
                    Photos, Image Playground, or emoji — optional
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
              <Pressable
                onPress={() => {
                  setHouseholdMode('join');
                  setError('');
                }}
                style={{ marginBottom: 12 }}>
                <Text style={[typography.footnote, { color: accent, fontWeight: '600' }]}>
                  Have an invite code?
                </Text>
              </Pressable>
              {householdMode === 'join' ? (
                <>
                  <OrbitButton onPress={() => setScannerOpen(true)}>Scan invite QR</OrbitButton>
                  <OrbitInput
                    autoCapitalize="characters"
                    label="Invite code"
                    value={inviteCode}
                    onChangeText={setInviteCode}
                  />
                  <Pressable
                    onPress={() => {
                      setHouseholdMode('create');
                      setError('');
                    }}>
                    <Text style={[typography.footnote, { color: orbitPalette.textSubtle }]}>
                      Back to create
                    </Text>
                  </Pressable>
                </>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <OrbitButton
                disabled={busy || (householdMode === 'create' && !householdName.trim())}
                onPress={handleHouseholdContinue}>
                {busy
                  ? 'Working…'
                  : householdMode === 'join'
                    ? 'Join household'
                    : 'Continue'}
              </OrbitButton>
            </KeyboardScreen>
          ) : null}

          {step === 'roster' ? (
            <KeyboardScreen contentContainerStyle={styles.scroll}>
              <Header progress={progressIndex} accent={accent} onBack={goBack} />
              <SetupRosterHub
                draft={setupDraft}
                busy={busy}
                onEditName={() => setStep('household')}
                onAddMember={() => {
                  setEditingMember(null);
                  setStep('member-wizard');
                }}
                onEditMember={(member) => {
                  setEditingMember(member);
                  setStep('member-wizard');
                }}
                onCreateHousehold={() => void handleCreateFromRoster()}
                onFinishLater={() => void handleFinishLater()}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </KeyboardScreen>
          ) : null}

          {step === 'member-wizard' ? (
            <KeyboardScreen contentContainerStyle={styles.scroll}>
              <Header progress={progressIndex} accent={accent} onBack={goBack} />
              <SetupMemberWizard
                rewardModel={selectedRewardModel ?? DEFAULT_REWARD_MODEL}
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
                <Text style={styles.readyEmoji}>{roleMeta?.emoji ?? '🏠'}</Text>
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
                Welcome to Choremaxx
                {roleMeta ? (
                  <>
                    , <Text style={[styles.readyRole, { color: accent }]}>{roleMeta.title}</Text>
                  </>
                ) : null}
              </Text>

              {showKidInviteBox ? (
                <GlassCard elevated style={styles.kidInviteBox}>
                  <Text style={[styles.kidInviteEyebrow, { color: orbitColors.success }]}>
                    Kids
                  </Text>
                  <Text style={[typography.headline, { color: orbitPalette.text }]}>
                    Invite kids (no sign-in)
                  </Text>
                  <Text style={[typography.footnote, styles.mb, { color: orbitPalette.textMuted }]}>
                    Create up to two kid profiles, then AirDrop each invite. Kids never need email.
                  </Text>
                  <OrbitInput
                    label="Kid 1 name"
                    value={kidNameOne}
                    onChangeText={setKidNameOne}
                    placeholder="e.g. Emma"
                  />
                  <OrbitInput
                    label="Kid 2 name (optional)"
                    value={kidNameTwo}
                    onChangeText={setKidNameTwo}
                    placeholder="e.g. Liam"
                  />
                  <OrbitButton
                    disabled={busy || (!kidNameOne.trim() && !kidNameTwo.trim())}
                    onPress={() => void handleCreateKidInvites()}>
                    {busy ? 'Saving…' : 'Create kid invites'}
                  </OrbitButton>

                  {kidInvites.map((invite) => (
                    <View
                      key={invite.id}
                      style={[
                        styles.kidInviteCard,
                        {
                          backgroundColor: orbitPalette.cardMuted,
                          borderColor: orbitPalette.border,
                        },
                      ]}>
                      <Text style={[styles.kidInviteName, { color: orbitPalette.text }]}>
                        {invite.name}
                      </Text>
                      <View style={styles.qrWrap}>
                        <QRCode
                          value={invite.webLink}
                          size={132}
                          backgroundColor="#FFFFFF"
                          color={ink}
                        />
                      </View>
                      <Text selectable style={[styles.inviteCode, { color: orbitPalette.text }]}>
                        {invite.code}
                      </Text>
                      <OrbitButton onPress={() => void handleShareKidInvite(invite)}>
                        {Platform.OS === 'ios'
                          ? `AirDrop / Share ${invite.name}`
                          : `Share ${invite.name}`}
                      </OrbitButton>
                    </View>
                  ))}
                </GlassCard>
              ) : null}

              {createdHousehold && readyInvite ? (
                <GlassCard style={styles.invitePanel}>
                  <Text style={[typography.headline, { color: orbitPalette.text }]}>
                    Invite adults
                  </Text>
                  <Text style={[typography.footnote, { color: orbitPalette.textMuted }]}>
                    AirDrop, share the link, or scan the QR.
                  </Text>
                  <View style={styles.qrWrap}>
                    <QRCode
                      value={readyInvite.webLink}
                      size={160}
                      backgroundColor="#FFFFFF"
                      color={ink}
                    />
                  </View>
                  <Text selectable style={[styles.inviteCode, { color: orbitPalette.text }]}>
                    {readyInvite.code}
                  </Text>
                  <OrbitButton onPress={handleAirDropInvite}>
                    {Platform.OS === 'ios' ? 'AirDrop / Share invite' : 'Share invite'}
                  </OrbitButton>
                </GlassCard>
              ) : null}

              {shareStatus ? (
                <Text style={[styles.shareHint, { color: accent }]}>{shareStatus}</Text>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <OrbitButton onPress={handleEnter}>Enter Choremaxx →</OrbitButton>
            </ScrollView>
          ) : null}
        </Animated.View>
      ) : null}

      <InviteQrScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={(code) => {
          setError('');
          setHouseholdMode('join');
          if (step === 'tablet-invite') {
            addTabletCode(code);
            return;
          }
          setInviteCode(code);
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
    gap: 28,
    justifyContent: 'center',
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

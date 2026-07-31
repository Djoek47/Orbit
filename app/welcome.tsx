import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { BrandLegalFooter } from '@/components/orbit/brand-legal-footer';
import { BrandOpening } from '@/components/orbit/brand-opening';
import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors, orbitRadius, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import {
  ONBOARDING_MOTIVATIONS,
  ONBOARDING_ROLES,
  loadOnboardingPrefs,
  onboardingRoleToHouseholdType,
  saveOnboardingPrefs,
  skipsMotivation,
  type MotivationMode,
  type OnboardingRole,
} from '@/lib/onboarding-prefs';
import { DEFAULT_HOUSEHOLD_ROOMS } from '@/data/household-rooms';
import { ROOM_EMOJIS } from '@/constants/accent-themes';
import { buildInviteLinks, normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import { shareInvite } from '@/lib/invites/share-invite';
import { createLocalId } from '@/repositories/repository-utils';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdRoom, HouseholdType } from '@/types/orbit';

type Step =
  | 'splash'
  | 'role'
  | 'motivation'
  | 'account'
  | 'profile'
  | 'household'
  | 'child-invite'
  | 'tablet-invite'
  | 'ready';

const HOUSEHOLD_TYPES: { label: string; value: HouseholdType }[] = [
  { label: 'Family', value: 'family' },
  { label: 'Single Parent', value: 'single-parent' },
  { label: 'Roommates', value: 'roommates' },
  { label: 'Multi-Gen', value: 'multi-generational' },
  { label: 'Custom', value: 'custom' },
];

export default function WelcomeOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const {
    connectSharedTabletProfiles,
    createChildInvites,
    createHousehold,
    createProfile,
    currentUser,
    hasHousehold,
    household,
    inviteLinks,
    isLoading,
    isSignedIn,
    joinHousehold,
    redeemChildInvite,
    signUp,
  } = useOrbit();

  const [step, setStep] = useState<Step>('splash');
  const [selectedRole, setSelectedRole] = useState<OnboardingRole | null>(null);
  const [selectedMotivation, setSelectedMotivation] = useState<MotivationMode | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [householdType, setHouseholdType] = useState<HouseholdType>('family');
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(() =>
    DEFAULT_HOUSEHOLD_ROOMS.map((room) => room.id),
  );
  const [customRooms, setCustomRooms] = useState<HouseholdRoom[]>([]);
  const [customRoomName, setCustomRoomName] = useState('');
  const [customRoomEmoji, setCustomRoomEmoji] = useState<string>('🚪');
  const [inviteCode, setInviteCode] = useState('');
  const [householdMode, setHouseholdMode] = useState<'create' | 'join'>('create');
  const [createdHousehold, setCreatedHousehold] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const [error, setError] = useState('');
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

  const roomCatalog = useMemo(
    () => [...DEFAULT_HOUSEHOLD_ROOMS, ...customRooms],
    [customRooms],
  );
  const selectedRooms = useMemo(
    () => roomCatalog.filter((room) => selectedRoomIds.includes(room.id)),
    [roomCatalog, selectedRoomIds],
  );

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
        setSelectedMotivation(prefs.motivation);
        setHouseholdType(onboardingRoleToHouseholdType(prefs.role));
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
        return 1;
      case 'child-invite':
      case 'tablet-invite':
        return 1;
      case 'account':
      case 'profile':
        return 2;
      case 'household':
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
      case 'child-invite':
      case 'tablet-invite':
        setStep('role');
        break;
      case 'account':
        setStep(selectedRole && skipsMotivation(selectedRole) ? 'role' : 'motivation');
        break;
      case 'profile':
        setStep('account');
        break;
      case 'household':
        setStep(currentUser?.profileComplete ? 'profile' : 'account');
        break;
      case 'ready':
        setStep(
          selectedRole === 'child'
            ? 'child-invite'
            : selectedRole === 'shared-tablet'
              ? 'tablet-invite'
              : 'household',
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

  if (!isLoading && isSignedIn && currentUser?.profileComplete && hasHousehold) {
    return <Redirect href="/" />;
  }

  const handleRoleContinue = () => {
    if (!selectedRole) return;
    setError('');
    setHouseholdType(onboardingRoleToHouseholdType(selectedRole));
    // Kids never create an account — they redeem a parent AirDrop / invite.
    if (selectedRole === 'child') {
      setSelectedMotivation(selectedMotivation ?? 'xp');
      setHouseholdMode('join');
      setStep('child-invite');
      return;
    }
    // Shared / tablet sits under Roommate — invite codes or AirDrop, no tablet email.
    if (selectedRole === 'shared-tablet') {
      setSelectedMotivation(selectedMotivation ?? 'xp');
      setHouseholdMode('join');
      setStep('tablet-invite');
      return;
    }
    if (selectedRole === 'roommate') {
      setHouseholdMode('create');
    }
    if (skipsMotivation(selectedRole)) {
      setSelectedMotivation(selectedMotivation ?? 'xp');
      setStep(isSignedIn ? (currentUser?.profileComplete ? 'household' : 'profile') : 'account');
      return;
    }
    setStep('motivation');
  };

  const handleMotivationContinue = () => {
    if (!selectedMotivation) return;
    setError('');
    setStep(isSignedIn ? (currentUser?.profileComplete ? 'household' : 'profile') : 'account');
  };

  const persistPrefs = async () => {
    await saveOnboardingPrefs({
      role: selectedRole ?? 'parent',
      motivation: selectedMotivation ?? 'xp',
    });
  };

  const handleAccountContinue = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter an email and password to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await persistPrefs();
      await signUp({ email: email.trim(), password });
      const guessedName = email.split('@')[0]?.replace(/[._]/g, ' ') || '';
      setDisplayName((current) => current || guessedName);
      setStep('profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
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
      await createProfile({ name: displayName.trim() });
      if (!householdName.trim() && roleMeta) {
        setHouseholdName(
          selectedRole === 'roommate' ? 'Our Place' : `The ${displayName.trim().split(' ')[0]} Home`,
        );
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
      if (householdMode === 'create') {
        if (!householdName.trim()) {
          setError('Add a household name to continue.');
          setBusy(false);
          return;
        }
        if (selectedRooms.length < 1) {
          setError('Pick at least one room.');
          setBusy(false);
          return;
        }
        await createHousehold({
          name: householdName.trim(),
          type: householdType,
          rooms: selectedRooms,
        });
        setCreatedHousehold(true);
      } else {
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
      }
      setStep('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Household setup failed.');
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
      await saveOnboardingPrefs({ role: 'child', motivation: selectedMotivation ?? 'xp' });
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
        motivation: selectedMotivation ?? 'xp',
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
    selectedRole !== 'roommate' &&
    selectedRole !== 'child' &&
    selectedRole !== 'shared-tablet';

  return (
    <View
      style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}
      {...swipeBack.panHandlers}>
      {step === 'splash' ? (
        <View style={styles.splashScreen}>
          <View style={styles.splashCenter}>
            <BrandOpening tagline="Run the household" onReady={() => setSplashReady(true)} />
          </View>

          <View
            style={[styles.splashBottom, !splashReady && styles.splashBottomHidden]}
            pointerEvents={splashReady ? 'auto' : 'none'}>
            <View style={styles.splashCtaBlock}>
              <OrbitButton onPress={() => setStep('role')}>Get Started</OrbitButton>
              <Pressable onPress={() => router.push('/sign-in' as never)} style={styles.signInLink}>
                <Text style={styles.signInText}>
                  Already have an account? <Text style={styles.signInAccent}>Sign in</Text>
                </Text>
              </Pressable>
            </View>
            <BrandLegalFooter compact showLogo={false} style={styles.splashLegal} />
          </View>
        </View>
      ) : null}

      {step === 'role' ? (
        <KeyboardScreen contentContainerStyle={[styles.scroll, styles.roleScroll]}>
          <Header progress={progressIndex} onBack={goBack} />
          <View style={styles.roleIntro}>
            <Text style={[orbitTypography.title, styles.roleHeading]}>Who are you?</Text>
            <Text style={styles.roleCaption}>Choremaxx adapts to your role in the household.</Text>
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
                    active && {
                      backgroundColor: `${role.color}14`,
                      borderColor: `${role.color}66`,
                    },
                  ]}>
                  <View
                    style={[
                      styles.roleEmoji,
                      {
                        backgroundColor: active ? `${role.color}22` : 'rgba(255,255,255,0.05)',
                        borderColor: active ? `${role.color}40` : 'rgba(255,255,255,0.08)',
                      },
                    ]}>
                    <Text style={styles.emoji}>{role.emoji}</Text>
                  </View>
                  <View style={styles.roleBody}>
                    <Text style={styles.roleTitle}>{role.title}</Text>
                    <Text
                      style={[
                        styles.roleSubtitle,
                        active ? { color: role.color } : null,
                      ]}>
                      {role.subtitle}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      active && { backgroundColor: role.color, borderColor: role.color },
                    ]}>
                    {active ? <Text style={styles.radioCheck}>✓</Text> : null}
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
          <Header progress={progressIndex} onBack={goBack} />
          <Text style={orbitTypography.title}>How do you motivate your household?</Text>
          <Text style={[orbitTypography.caption, styles.mb]}>You can change this anytime in Settings.</Text>
          <View style={styles.motivationGrid}>
            {ONBOARDING_MOTIVATIONS.map((opt) => {
              const active = selectedMotivation === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setSelectedMotivation(opt.id)}
                  style={[
                    styles.motivationCard,
                    opt.wide && styles.motivationWide,
                    active && styles.motivationActive,
                  ]}>
                  <View style={styles.motivationTop}>
                    <Text style={styles.emoji}>{opt.emoji}</Text>
                    {active ? (
                      <View style={styles.miniCheck}>
                        <Text style={styles.radioCheck}>✓</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.motivationLabel}>{opt.label}</Text>
                  <Text style={styles.motivationDesc}>{opt.desc}</Text>
                </Pressable>
              );
            })}
          </View>
          <OrbitButton disabled={!selectedMotivation} onPress={handleMotivationContinue}>
            Continue
          </OrbitButton>
        </KeyboardScreen>
      ) : null}

      {step === 'child-invite' ? (
        <KeyboardScreen contentContainerStyle={styles.scroll}>
          <Header progress={progressIndex} onBack={goBack} />
          <Text style={orbitTypography.title}>Got a parent invite?</Text>
          <Text style={[orbitTypography.caption, styles.mb]}>
            No email or password. Open the AirDrop your parent sent, scan their QR, or type your kid
            code. Your parent&apos;s account keeps the household saved.
          </Text>
          <OrbitButton onPress={() => setScannerOpen(true)}>Scan invite QR</OrbitButton>
          <OrbitInput
            autoCapitalize="characters"
            label="Kid invite code"
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="e.g. CMX-EMMA"
          />
          <Text style={orbitTypography.caption}>
            Demo profiles: CMX-EMMA · CMX-LIAM · CMX-JOSH · CMX-TODD
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <OrbitButton disabled={busy} onPress={() => void handleChildInviteContinue()}>
            {busy ? 'Opening…' : 'Enter Choremaxx'}
          </OrbitButton>
        </KeyboardScreen>
      ) : null}

      {step === 'tablet-invite' ? (
        <KeyboardScreen contentContainerStyle={styles.scroll}>
          <Header progress={progressIndex} onBack={goBack} />
          <Text style={orbitTypography.title}>Set up this shared tablet</Text>
          <Text style={[orbitTypography.caption, styles.mb]}>
            Add profiles with AirDrop or invite codes from a parent/admin. No email on the tablet —
            the admin account keeps everything saved. Add one or two people (or more).
          </Text>
          <OrbitInput
            label="Device name"
            value={tabletLabel}
            onChangeText={setTabletLabel}
            placeholder="Shared tablet"
          />
          <OrbitButton onPress={() => setScannerOpen(true)}>Scan AirDrop / invite QR</OrbitButton>
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
                  onPress={() => setTabletCodes((current) => current.filter((item) => item !== code))}
                  style={styles.tabletChip}>
                  <Text style={styles.tabletChipText}>{code} ✕</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={orbitTypography.caption}>
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
          <Header progress={progressIndex} onBack={goBack} />
          <Text style={orbitTypography.title}>Create your account</Text>
          <Text style={[orbitTypography.caption, styles.mb]}>
            One account unlocks your household — tasks, Plan, Rewards, and Nova.
          </Text>
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
          <OrbitButton disabled={busy} onPress={handleAccountContinue}>
            {busy ? 'Creating…' : 'Continue'}
          </OrbitButton>
          <Pressable onPress={() => router.push('/sign-in' as never)} style={styles.signInLink}>
            <Text style={styles.signInText}>Already have an account? Sign in</Text>
          </Pressable>
        </KeyboardScreen>
      ) : null}

      {step === 'profile' ? (
        <KeyboardScreen contentContainerStyle={styles.scroll}>
          <Header progress={progressIndex} onBack={goBack} />
          <Text style={orbitTypography.title}>What should we call you?</Text>
          <Text style={[orbitTypography.caption, styles.mb]}>
            This name is your identity inside the household.
          </Text>
          <OrbitInput label="Display name" value={displayName} onChangeText={setDisplayName} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <OrbitButton disabled={busy} onPress={handleProfileContinue}>
            {busy ? 'Saving…' : 'Continue'}
          </OrbitButton>
        </KeyboardScreen>
      ) : null}

      {step === 'household' ? (
        <KeyboardScreen contentContainerStyle={styles.scroll}>
          <Header progress={progressIndex} onBack={goBack} />
          <Text style={orbitTypography.title}>Set up your household</Text>
          <Text style={[orbitTypography.caption, styles.mb]}>
            Create a new home or join one with an invite code.
          </Text>

          <View style={styles.modeRow}>
            {(
              [
                { id: 'create' as const, label: 'Create' },
                { id: 'join' as const, label: 'Join' },
              ] as const
            ).map((mode) => {
              const active = householdMode === mode.id;
              return (
                <Pressable
                  key={mode.id}
                  onPress={() => {
                    setError('');
                    setHouseholdMode(mode.id);
                  }}
                  style={[styles.modeChip, active && styles.modeChipActive]}>
                  <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{mode.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {householdMode === 'create' ? (
            <>
              <OrbitInput
                label="Household name"
                value={householdName}
                onChangeText={setHouseholdName}
              />
              <Text style={styles.fieldLabel}>Household type</Text>
              <View style={styles.typeGrid}>
                {HOUSEHOLD_TYPES.map((item) => {
                  const selected = item.value === householdType;
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => setHouseholdType(item.value)}
                      style={[styles.typeChip, selected && styles.typeChipSelected]}>
                      <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.fieldLabel}>Rooms</Text>
              <Text style={[orbitTypography.caption, styles.mb]}>
                Pick the spaces you manage. Add custom rooms if needed.
              </Text>
              <View style={styles.typeGrid}>
                {roomCatalog.map((room) => {
                  const selected = selectedRoomIds.includes(room.id);
                  return (
                    <Pressable
                      key={room.id}
                      onPress={() =>
                        setSelectedRoomIds((current) =>
                          current.includes(room.id)
                            ? current.filter((id) => id !== room.id)
                            : [...current, room.id],
                        )
                      }
                      style={[styles.typeChip, selected && styles.typeChipSelected]}>
                      <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>
                        {room.emoji} {room.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.typeGrid}>
                {ROOM_EMOJIS.map((emoji) => {
                  const selected = customRoomEmoji === emoji;
                  return (
                    <Pressable
                      key={emoji}
                      onPress={() => setCustomRoomEmoji(emoji)}
                      style={[styles.typeChip, selected && styles.typeChipSelected]}>
                      <Text style={{ fontSize: 16 }}>{emoji}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.customRoomRow}>
                <View style={styles.customRoomInput}>
                  <OrbitInput
                    label="Custom room"
                    value={customRoomName}
                    onChangeText={setCustomRoomName}
                    placeholder="e.g. Garage"
                  />
                </View>
                <OrbitButton
                  tone="secondary"
                  onPress={() => {
                    const trimmed = customRoomName.trim();
                    if (!trimmed) return;
                    const room: HouseholdRoom = {
                      id: createLocalId('room'),
                      name: trimmed,
                      emoji: customRoomEmoji,
                      kind: 'custom',
                    };
                    setCustomRooms((current) => [...current, room]);
                    setSelectedRoomIds((current) => [...current, room.id]);
                    setCustomRoomName('');
                  }}>
                  Add
                </OrbitButton>
              </View>
            </>
          ) : (
            <>
              <OrbitButton onPress={() => setScannerOpen(true)}>Scan invite QR</OrbitButton>
              <OrbitInput
                autoCapitalize="characters"
                label="Invite code"
                value={inviteCode}
                onChangeText={setInviteCode}
              />
              <Text style={orbitTypography.caption}>
                Demo code: CMX-7429 — or scan a household QR from an invite.
              </Text>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <OrbitButton disabled={busy} onPress={handleHouseholdContinue}>
            {busy ? 'Working…' : householdMode === 'create' ? 'Create household' : 'Join household'}
          </OrbitButton>
        </KeyboardScreen>
      ) : null}

      {step === 'ready' ? (
        <ScrollView contentContainerStyle={[styles.scroll, styles.readyScroll]} showsVerticalScrollIndicator={false}>
          <View style={styles.readyBadge}>
            <Text style={styles.readyEmoji}>{roleMeta?.emoji ?? '🏠'}</Text>
          </View>
          <Text style={[orbitTypography.title, styles.readyTitle]}>You&apos;re all set!</Text>
          <Text style={styles.readySub}>
            Welcome to Choremaxx
            {roleMeta ? (
              <>
                , <Text style={styles.readyRole}>{roleMeta.title}</Text>
              </>
            ) : null}
          </Text>

          {showKidInviteBox ? (
            <View style={styles.kidInviteBox}>
              <Text style={styles.kidInviteEyebrow}>Kids</Text>
              <Text style={orbitTypography.cardTitle}>Invite kids (no sign-in)</Text>
              <Text style={[orbitTypography.caption, styles.mb]}>
                Create up to two kid profiles on your admin account, then AirDrop or share each
                invite. Young kids never need email — you keep everything saved. On a shared tablet,
                pick Shared / tablet under Roommate and add these same codes.
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
                <View key={invite.id} style={styles.kidInviteCard}>
                  <Text style={styles.kidInviteName}>{invite.name}</Text>
                  <View style={styles.qrWrap}>
                    <QRCode value={invite.webLink} size={132} backgroundColor="#FFFFFF" color="#070D1C" />
                  </View>
                  <Text selectable style={styles.inviteCode}>
                    {invite.code}
                  </Text>
                  <OrbitButton onPress={() => void handleShareKidInvite(invite)}>
                    {Platform.OS === 'ios'
                      ? `AirDrop / Share ${invite.name}`
                      : `Share ${invite.name}`}
                  </OrbitButton>
                </View>
              ))}
            </View>
          ) : null}

          {createdHousehold && readyInvite ? (
            <View style={styles.invitePanel}>
              <Text style={orbitTypography.cardTitle}>
                {selectedRole === 'roommate' ? 'Invite roommates' : 'Invite adults'}
              </Text>
              <Text style={orbitTypography.caption}>
                For parents, partners, or roommates who can create their own account. AirDrop,
                share the link, or scan the QR.
              </Text>
              <View style={styles.qrWrap}>
                <QRCode value={readyInvite.webLink} size={160} backgroundColor="#FFFFFF" color="#070D1C" />
              </View>
              <Text selectable style={styles.inviteCode}>
                {readyInvite.code}
              </Text>
              <OrbitButton onPress={handleAirDropInvite}>
                {Platform.OS === 'ios' ? 'AirDrop / Share invite' : 'Share invite'}
              </OrbitButton>
            </View>
          ) : null}

          {shareStatus ? <Text style={styles.shareHint}>{shareStatus}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <OrbitButton onPress={handleEnter}>Enter Choremaxx →</OrbitButton>
        </ScrollView>
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
    </View>
  );
}

function Header({ progress, onBack }: { progress: number; onBack?: () => void }) {
  return (
    <View style={styles.topRow}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <MaterialIcons name="chevron-left" size={22} color={orbitColors.primary} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      ) : (
        <ChoremaxxLogo size="sm" />
      )}
      <View style={styles.dots}>
        {[0, 1, 2, 3, 4].map((index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === progress && styles.dotActive,
              index < progress && styles.dotDone,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bulletDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  bulletRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  bulletText: {
    color: orbitColors.textMuted,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  bullets: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 16,
    paddingVertical: 8,
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: orbitSpacing.xl,
    justifyContent: 'center',
    paddingHorizontal: orbitSpacing.lg,
  },
  splashScreen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: orbitSpacing.lg,
    paddingTop: 12,
    paddingBottom: 8,
    width: '100%',
  },
  splashCenter: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    width: '100%',
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
  splashHero: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: orbitSpacing.md,
    width: '100%',
  },
  splashLogo: {
    alignSelf: 'center',
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
  customRoomInput: {
    flex: 1,
  },
  customRoomRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    marginBottom: orbitSpacing.md,
  },
  dot: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    height: 4,
    width: 8,
  },
  dotActive: {
    backgroundColor: orbitColors.primary,
    width: 20,
  },
  dotDone: {
    backgroundColor: orbitColors.primary,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
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
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  mb: {
    marginBottom: orbitSpacing.md,
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
    borderRadius: orbitRadius.md,
    flex: 1,
    paddingVertical: 10,
  },
  modeChipActive: {
    backgroundColor: 'rgba(59,181,240,0.2)',
    borderColor: 'rgba(59,181,240,0.3)',
    borderWidth: 1,
  },
  modeLabel: {
    color: orbitColors.textSubtle,
    fontSize: 14,
    fontWeight: '500',
  },
  modeLabelActive: {
    color: orbitColors.primary,
    fontWeight: '700',
  },
  modeRow: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: orbitRadius.lg,
    flexDirection: 'row',
    gap: 4,
    marginBottom: orbitSpacing.md,
    padding: 4,
  },
  motivationActive: {
    backgroundColor: 'rgba(59,181,240,0.15)',
    borderColor: 'rgba(59,181,240,0.35)',
  },
  motivationCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: orbitRadius.lg,
    borderWidth: 2,
    gap: 4,
    padding: orbitSpacing.md,
    width: '48%',
  },
  motivationDesc: {
    color: orbitColors.textSubtle,
    fontSize: 12,
  },
  motivationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: orbitSpacing.md,
  },
  motivationLabel: {
    color: orbitColors.text,
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
  perk: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  perkText: {
    color: orbitColors.textMuted,
    fontSize: 11,
  },
  perkWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  radio: {
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  radioCheck: {
    color: orbitColors.background,
    fontSize: 11,
    fontWeight: '800',
  },
  readyBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: orbitColors.primary,
    borderCurve: 'continuous',
    borderRadius: orbitRadius.lg,
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
    paddingTop: orbitSpacing.xl,
  },
  readySub: {
    color: orbitColors.textMuted,
    fontSize: 14,
    marginBottom: orbitSpacing.md,
    textAlign: 'center',
  },
  readyTitle: {
    textAlign: 'center',
  },
  inviteCode: {
    color: orbitColors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  invitePanel: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    gap: orbitSpacing.md,
    marginBottom: orbitSpacing.md,
    padding: orbitSpacing.lg,
  },
  kidInviteBox: {
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderColor: 'rgba(52,211,153,0.28)',
    borderCurve: 'continuous',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    gap: orbitSpacing.md,
    marginBottom: orbitSpacing.md,
    padding: orbitSpacing.lg,
    width: '100%',
  },
  kidInviteCard: {
    backgroundColor: 'rgba(7,13,28,0.35)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    gap: 12,
    padding: orbitSpacing.md,
  },
  kidInviteEyebrow: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  kidInviteName: {
    color: orbitColors.text,
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
    borderRadius: orbitRadius.md,
    padding: orbitSpacing.md,
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
    color: orbitColors.textMuted,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  roleCard: {
    alignItems: 'center',
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
  roleHeading: {
    letterSpacing: -0.4,
    marginBottom: 0,
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
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  roleTitle: {
    color: orbitColors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  roleTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  root: {
    backgroundColor: orbitColors.background,
    flex: 1,
  },
  scroll: {
    gap: 4,
    paddingBottom: orbitSpacing.xl,
    paddingHorizontal: orbitSpacing.lg,
  },
  signInLink: {
    paddingVertical: 8,
  },
  signInText: {
    color: orbitColors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  signInAccent: {
    color: orbitColors.primary,
    fontWeight: '700',
  },
  splashCopy: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  splashLead: {
    color: orbitColors.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 32,
    textAlign: 'center',
  },
  splashSub: {
    color: orbitColors.textMuted,
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 24,
    textAlign: 'center',
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: orbitSpacing.md,
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
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeChipSelected: {
    backgroundColor: 'rgba(59,181,240,0.18)',
    borderColor: 'rgba(59,181,240,0.45)',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: orbitSpacing.md,
  },
  typeLabel: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  typeLabelSelected: {
    color: orbitColors.primary,
  },
});

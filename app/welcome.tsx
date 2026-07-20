import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
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
import { buildInviteLinks, normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import { shareInvite } from '@/lib/invites/share-invite';
import { createLocalId } from '@/repositories/repository-utils';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdRoom, HouseholdType } from '@/types/orbit';

type Step = 'splash' | 'role' | 'motivation' | 'account' | 'profile' | 'household' | 'ready';

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
    createHousehold,
    createProfile,
    currentUser,
    hasHousehold,
    household,
    inviteLinks,
    isLoading,
    isSignedIn,
    joinHousehold,
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
  const [inviteCode, setInviteCode] = useState('');
  const [householdMode, setHouseholdMode] = useState<'create' | 'join'>('create');
  const [createdHousehold, setCreatedHousehold] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resumed, setResumed] = useState(false);

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

  if (!isLoading && isSignedIn && currentUser?.profileComplete && hasHousehold) {
    return <Redirect href="/" />;
  }

  const progressIndex = (() => {
    switch (step) {
      case 'role':
        return 0;
      case 'motivation':
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

  const handleRoleContinue = () => {
    if (!selectedRole) return;
    setError('');
    setHouseholdType(onboardingRoleToHouseholdType(selectedRole));
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

  const handleEnter = () => {
    router.replace('/' as never);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      {step === 'splash' ? (
        <View style={styles.centered}>
          <ChoremaxxLogo size="xl" />
          <View style={styles.splashCopy}>
            <Text style={styles.splashLead}>Your AI-powered</Text>
            <Text style={styles.splashSub}>Household Operating System</Text>
          </View>
          <View style={styles.bullets}>
            {[
              { text: 'Zero clutter. Maximum harmony.', color: orbitColors.primary },
              { text: 'AI that manages your home.', color: orbitColors.accent },
              { text: 'Family-first. Always.', color: orbitColors.rewardsGold },
            ].map((item) => (
              <View key={item.text} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: item.color }]} />
                <Text style={styles.bulletText}>{item.text}</Text>
              </View>
            ))}
          </View>
          <OrbitButton onPress={() => setStep('role')}>Get Started</OrbitButton>
          <Pressable onPress={() => router.push('/sign-in' as never)} style={styles.signInLink}>
            <Text style={styles.signInText}>Already have an account? Sign in</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'role' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Header progress={progressIndex} />
          <Text style={orbitTypography.title}>Who are you?</Text>
          <Text style={[orbitTypography.caption, styles.mb]}>
            Choremaxx adapts to your role in the household.
          </Text>
          {ONBOARDING_ROLES.map((role) => {
            const active = selectedRole === role.id;
            return (
              <Pressable
                key={role.id}
                onPress={() => setSelectedRole(role.id)}
                style={[
                  styles.roleCard,
                  active && { backgroundColor: `${role.color}22`, borderColor: `${role.color}55` },
                ]}>
                <View
                  style={[
                    styles.roleEmoji,
                    { backgroundColor: `${role.color}18`, borderColor: `${role.color}33` },
                  ]}>
                  <Text style={styles.emoji}>{role.emoji}</Text>
                </View>
                <View style={styles.roleBody}>
                  <View style={styles.roleTitleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roleTitle}>{role.title}</Text>
                      <Text style={[styles.roleSubtitle, { color: role.color }]}>{role.subtitle}</Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        active && { backgroundColor: role.color, borderColor: role.color },
                      ]}>
                      {active ? <Text style={styles.radioCheck}>✓</Text> : null}
                    </View>
                  </View>
                  <View style={styles.perkWrap}>
                    {role.perks.map((perk) => (
                      <View key={perk} style={styles.perk}>
                        <Text style={styles.perkText}>{perk}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Pressable>
            );
          })}
          <OrbitButton disabled={!selectedRole} onPress={handleRoleContinue}>
            Continue
          </OrbitButton>
        </ScrollView>
      ) : null}

      {step === 'motivation' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Header progress={progressIndex} />
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
        </ScrollView>
      ) : null}

      {step === 'account' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Header progress={progressIndex} />
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
        </ScrollView>
      ) : null}

      {step === 'profile' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Header progress={progressIndex} />
          <Text style={orbitTypography.title}>What should we call you?</Text>
          <Text style={[orbitTypography.caption, styles.mb]}>
            This name is your identity inside the household.
          </Text>
          <OrbitInput label="Display name" value={displayName} onChangeText={setDisplayName} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <OrbitButton disabled={busy} onPress={handleProfileContinue}>
            {busy ? 'Saving…' : 'Continue'}
          </OrbitButton>
        </ScrollView>
      ) : null}

      {step === 'household' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Header progress={progressIndex} />
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
                      emoji: '🚪',
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
        </ScrollView>
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

          {createdHousehold && readyInvite ? (
            <View style={styles.invitePanel}>
              <Text style={orbitTypography.cardTitle}>Invite your household</Text>
              <Text style={orbitTypography.caption}>
                AirDrop this invite on iPhone, share the link, or let someone scan the QR.
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
              {shareStatus ? <Text style={styles.shareHint}>{shareStatus}</Text> : null}
            </View>
          ) : null}

          <OrbitButton onPress={handleEnter}>Enter Choremaxx →</OrbitButton>
        </ScrollView>
      ) : null}

      <InviteQrScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={(code) => {
          setInviteCode(code);
          setHouseholdMode('join');
          setError('');
        }}
      />
    </View>
  );
}

function Header({ progress }: { progress: number }) {
  return (
    <View style={styles.topRow}>
      <ChoremaxxLogo size="sm" />
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
    height: 6,
    width: 6,
  },
  bulletRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bulletText: {
    color: orbitColors.textMuted,
    fontSize: 14,
  },
  bullets: {
    alignSelf: 'stretch',
    gap: 10,
    marginBottom: orbitSpacing.md,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: orbitSpacing.lg,
    justifyContent: 'center',
    paddingHorizontal: orbitSpacing.lg,
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
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    width: 20,
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
  },
  roleCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: orbitRadius.lg,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    overflow: 'hidden',
    padding: orbitSpacing.md,
  },
  roleEmoji: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  roleSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  roleTitle: {
    color: orbitColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  roleTitleRow: {
    alignItems: 'flex-start',
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
  splashCopy: {
    alignItems: 'center',
    gap: 4,
  },
  splashLead: {
    color: orbitColors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  splashSub: {
    color: orbitColors.textMuted,
    fontSize: 18,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: orbitSpacing.md,
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

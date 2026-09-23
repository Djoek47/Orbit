import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { GlassCard } from '@/components/orbit/glass-card';
import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { radius, space, typography } from '@/constants/orbit-theme';
import { userFacingMessage } from '@/lib/auth/auth-errors';
import { dataMode } from '@/config/data-mode';
import { clearDeviceSession } from '@/lib/device/device-session';
import { saveChildInviteRecord } from '@/lib/household/child-invites';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import {
  resolveMemberByProfileCode,
} from '@/lib/household/profile-codes';
import {
  DEFAULT_SHARED_IPAD_NAME,
  listSharedDevices,
  resolveSharedDevicePeople,
} from '@/lib/household/shared-device';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';

type SetupStep = 1 | 2 | 3 | 4;

const STEP_COUNT = 4;

function parseStep(raw: string | string[] | undefined): SetupStep | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return null;
}

function isTruthyParam(raw: string | string[] | undefined): boolean {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === '1' || value === 'true' || value === 'yes';
}

/**
 * Family iPad setup — 4 steps: What / Name / Who / Ready.
 * Entry: Step 1 by default; `?step=3` from face picker; `?readonly=1` explainer from phone.
 */
export default function SetupKidDeviceScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ step?: string; readonly?: string }>();
  const {
    connectSharedTabletProfiles,
    createSharedDevice,
    ensureMemberProfileInviteCode,
    household,
    permissions,
    updateSharedDeviceLinks,
  } = useOrbit();
  const { c } = useOrbitColors();

  const readOnly = isTruthyParam(params.readonly);
  const initialStep = readOnly ? 1 : (parseStep(params.step) ?? 1);

  const [step, setStep] = useState<SetupStep>(initialStep);
  const [deviceLabel, setDeviceLabel] = useState(DEFAULT_SHARED_IPAD_NAME);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [codeMode, setCodeMode] = useState(false);
  const [code, setCode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hydratedExisting = useRef(false);

  const isAdmin = permissions.canManageHousehold;

  const sidekicks = useMemo(
    () =>
      household.members.filter(
        (member) => member.status === 'active' && member.role === 'child'
      ),
    [household.members]
  );

  const hostedMembers = useMemo(
    () =>
      selectedIds
        .map((id) => household.members.find((m) => m.id === id))
        .filter((m): m is HouseholdMember => Boolean(m)),
    [household.members, selectedIds]
  );

  useEffect(() => {
    if (hydratedExisting.current) return;
    const existing = listSharedDevices(household.members)[0];
    if (!existing) return;
    hydratedExisting.current = true;
    if (existing.name?.trim()) {
      setDeviceLabel(existing.name.trim());
    }
    const people = resolveSharedDevicePeople(existing, household.members);
    if (people.length > 0) {
      setSelectedIds(people.map((person) => person.id));
    }
  }, [household.members]);

  useEffect(() => {
    const fromParams = readOnly ? 1 : (parseStep(params.step) ?? null);
    if (fromParams) setStep(fromParams);
  }, [params.step, readOnly]);

  const goBack = () => {
    if (readOnly || step === 1) {
      router.back();
      return;
    }
    setError('');
    setStep((current) => (current - 1) as SetupStep);
  };

  const goNext = () => {
    setError('');
    if (step < STEP_COUNT) {
      setStep((current) => (current + 1) as SetupStep);
    }
  };

  const toggleSidekick = async (member: HouseholdMember) => {
    setError('');
    const already = selectedIds.includes(member.id);
    if (already) {
      setSelectedIds((current) => current.filter((id) => id !== member.id));
      return;
    }
    try {
      await ensureMemberProfileInviteCode(member.id);
      setSelectedIds((current) =>
        current.includes(member.id) ? current : [...current, member.id]
      );
    } catch (err) {
      setError(userFacingMessage(err, 'Could not prepare this Sidekick for the iPad.'));
    }
  };

  const addCode = async (raw: string) => {
    setError('');
    const member = resolveMemberByProfileCode(raw, household.members);
    if (!member) {
      setError('That code does not match anyone here. Ask an admin for their profile code.');
      return;
    }
    if (selectedIds.includes(member.id)) {
      setError(`${member.name} is already on this iPad.`);
      return;
    }
    try {
      await ensureMemberProfileInviteCode(member.id);
      setSelectedIds((current) => [...current, member.id]);
      setCode('');
      setCodeMode(false);
    } catch (err) {
      setError(userFacingMessage(err, 'Could not add this Sidekick.'));
    }
  };

  const finish = async () => {
    if (hostedMembers.length === 0) {
      setError('Pick at least one person.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      const codes: string[] = [];
      for (const person of hostedMembers) {
        const code = await ensureMemberProfileInviteCode(person.id);
        if (!code) {
          throw new Error(`Could not make a profile code for ${person.name}.`);
        }
        codes.push(code);
        if (!household.id) {
          throw new Error('Create the household before setting up this iPad.');
        }
        await saveChildInviteRecord({
          member: { ...person, profileInviteCode: code, role: 'child' },
          householdId: household.id,
          householdName: household.householdName,
          code,
        });
      }
      const label = deviceLabel.trim() || DEFAULT_SHARED_IPAD_NAME;
      let sharedDeviceId: string | null =
        listSharedDevices(household.members).find((d) => d.name === label)?.id ??
        listSharedDevices(household.members)[0]?.id ??
        null;

      if (!sharedDeviceId) {
        const created = await createSharedDevice(label);
        sharedDeviceId = created?.id ?? null;
      }

      if (sharedDeviceId) {
        await updateSharedDeviceLinks(
          sharedDeviceId,
          hostedMembers.map((person) => person.id)
        );
      }

      await connectSharedTabletProfiles(codes, label);

      // Parent GoTrue session must not stay on the kids' iPad. Local scope only —
      // do not sign the parent out of their phone.
      if (dataMode !== 'mock') {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
          if (signOutError) console.warn('setupKidDevice.localSignOut', signOutError.message);
        }
      }

      router.replace('/select-profile' as never);
    } catch (err) {
      setError(userFacingMessage(err, 'Could not set up this iPad.'));
    } finally {
      setBusy(false);
    }
  };

  const useAsPersonalPhone = () => {
    Alert.alert('Use as a personal phone?', 'This iPad will stop asking who is using it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Use as personal',
        onPress: () => {
          void clearDeviceSession().then(() => router.replace('/(tabs)' as never));
        },
      },
    ]);
  };

  const sidekickWord = hostedMembers.length === 1 ? 'Sidekick' : 'Sidekicks';
  const labelPreview = deviceLabel.trim() || DEFAULT_SHARED_IPAD_NAME;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.root, { paddingTop: insets.top + 8, backgroundColor: c.background }]}>
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Back">
            <MaterialIcons name="arrow-back" size={20} color={c.text} />
          </Pressable>
          <View style={styles.dots} accessibilityLabel={`Step ${step} of ${STEP_COUNT}`}>
            {Array.from({ length: STEP_COUNT }, (_, index) => {
              const active = index + 1 === step;
              return (
                <View
                  key={`dot-${index}`}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: active ? c.primary : c.textSubtle,
                      opacity: active ? 1 : 0.35,
                    },
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.backSpacer} />
        </View>

        <KeyboardScreen style={styles.scroll} contentContainerStyle={styles.content}>
          {step === 1 ? (
            <>
              <Text style={[typography.title1, { color: c.text }]}>A family iPad</Text>
              <Text style={[styles.body, { color: c.textMuted }]}>
                One iPad your kids share. Each Sidekick taps their face to open their own tasks, XP
                and rewards.
              </Text>
              <GlassCard>
                <Bullet
                  title="Their own space."
                  body="Everyone sees only what is theirs."
                  color={c.text}
                  muted={c.textMuted}
                />
                <Bullet
                  title="Switching is one tap."
                  body="Tap your face at the top of Home to hand it to someone else."
                  color={c.text}
                  muted={c.textMuted}
                />
                <Bullet
                  title="Grown-up tools stay on your phone."
                  body="Poppins, billing and household admin settings aren't on the family iPad."
                  color={c.text}
                  muted={c.textMuted}
                />
              </GlassCard>
              {readOnly ? (
                <OrbitButton tone="secondary" onPress={() => router.back()}>
                  Done
                </OrbitButton>
              ) : (
                <>
                  <OrbitButton onPress={goNext}>Set up this iPad</OrbitButton>
                  <Pressable onPress={useAsPersonalPhone} accessibilityRole="button">
                    <Text style={[styles.link, { color: c.textSubtle, textAlign: 'center' }]}>
                      This is my personal phone
                    </Text>
                  </Pressable>
                </>
              )}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={[typography.title1, { color: c.text }]}>Name this iPad</Text>
              <Text style={[styles.body, { color: c.textMuted }]}>
                So you can tell it apart in Settings.
              </Text>
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: c.textSoft }]}>Device name</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    value={deviceLabel}
                    onChangeText={setDeviceLabel}
                    placeholder={DEFAULT_SHARED_IPAD_NAME}
                    placeholderTextColor={c.textSubtle}
                    accessibilityLabel="Device name"
                    style={[styles.input, styles.inputFlex, { color: c.text }]}
                    returnKeyType="done"
                    onSubmitEditing={goNext}
                  />
                  {deviceLabel.length > 0 ? (
                    <Pressable
                      onPress={() => setDeviceLabel('')}
                      accessibilityRole="button"
                      accessibilityLabel="Clear name"
                      hitSlop={8}
                      style={styles.clearBtn}>
                      <MaterialIcons name="close" size={18} color={c.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <OrbitButton onPress={goNext}>Continue</OrbitButton>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={[typography.title1, { color: c.text }]}>Who uses it</Text>
              <Text style={[styles.body, { color: c.textMuted }]}>
                {isAdmin
                  ? 'Tap each Sidekick who shares this iPad.'
                  : 'Scan or type each Sidekick profile code.'}
              </Text>

              {isAdmin && sidekicks.length > 0 ? (
                <View style={styles.faceGrid}>
                  {sidekicks.map((member) => {
                    const selected = selectedIds.includes(member.id);
                    const photo = isAvatarImageUri(member.avatar);
                    return (
                      <Pressable
                        key={member.id}
                        onPress={() => void toggleSidekick(member)}
                        style={styles.faceTile}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={`${member.name}${selected ? ', selected' : ''}`}>
                        <View
                          style={[
                            styles.faceRing,
                            {
                              borderColor: selected ? c.primary : 'transparent',
                            },
                          ]}>
                          <Avatar
                            name={member.name}
                            emoji={memberDisplayEmoji(member)}
                            imageUri={photo ? member.avatar : undefined}
                            size="l"
                          />
                          {selected ? (
                            <View style={[styles.check, { backgroundColor: c.primary }]}>
                              <MaterialIcons name="check" size={14} color={c.ink ?? '#070D1C'} />
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.faceName, { color: c.text }]} numberOfLines={1}>
                          {member.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {isAdmin ? (
                <Text style={[styles.hint, { color: c.textSubtle }]}>
                  Someone missing? Add them in Settings → Members first.
                </Text>
              ) : null}

              {codeMode ? (
                <View style={styles.codeBlock}>
                  <OrbitButton tone="secondary" onPress={() => setScannerOpen(true)}>
                    Scan profile QR
                  </OrbitButton>
                  <View style={styles.codeRow}>
                    <TextInput
                      value={code}
                      onChangeText={setCode}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      placeholder="CMX-MAYA"
                      placeholderTextColor={c.textSubtle}
                      accessibilityLabel="Profile code"
                      style={[styles.input, styles.codeInput, { color: c.text }]}
                      onSubmitEditing={() => void addCode(code)}
                      returnKeyType="done"
                    />
                    <OrbitButton
                      tone="secondary"
                      onPress={() => void addCode(code)}
                      disabled={!code.trim()}
                      style={styles.addBtn}>
                      Add
                    </OrbitButton>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setCodeMode(true)}
                  accessibilityRole="button"
                  style={styles.secondaryBlock}>
                  <Text style={[styles.link, { color: c.textMuted }]}>
                    Scan or type a code instead
                  </Text>
                  <Text style={[styles.hint, { color: c.textSubtle }]}>
                    Each Sidekick&apos;s code is on their card: Settings → Members → tap their name →
                    Show code.
                  </Text>
                </Pressable>
              )}

              {!isAdmin && hostedMembers.length > 0 ? (
                <View style={styles.hosted}>
                  {hostedMembers.map((person) => (
                    <View key={person.id} style={styles.hostedRow}>
                      <Avatar
                        name={person.name}
                        emoji={memberDisplayEmoji(person)}
                        imageUri={isAvatarImageUri(person.avatar) ? person.avatar : undefined}
                        size="s"
                      />
                      <Text style={[styles.hostedName, { color: c.text }]}>{person.name}</Text>
                      <Pressable
                        onPress={() =>
                          setSelectedIds((current) => current.filter((id) => id !== person.id))
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${person.name}`}>
                        <MaterialIcons name="close" size={18} color="#F87171" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              {error ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : selectedIds.length === 0 ? (
                <Text style={[styles.hint, { color: c.textSubtle }]}>Pick at least one person.</Text>
              ) : null}

              <OrbitButton disabled={selectedIds.length === 0} onPress={goNext}>
                Continue
              </OrbitButton>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Text style={[typography.title1, { color: c.text }]}>Ready to hand over</Text>
              <Text style={[styles.body, { color: c.textMuted }]}>
                {hostedMembers.length} {sidekickWord} on {labelPreview}. When the iPad opens,
                they&apos;ll tap their face.
              </Text>
              <GlassCard>
                <View style={styles.readyFaces}>
                  {hostedMembers.map((person) => (
                    <View key={person.id} style={styles.readyFace}>
                      <Avatar
                        name={person.name}
                        emoji={memberDisplayEmoji(person)}
                        imageUri={isAvatarImageUri(person.avatar) ? person.avatar : undefined}
                        size="m"
                      />
                      <Text style={[styles.faceName, { color: c.text }]} numberOfLines={1}>
                        {person.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </GlassCard>
              {error ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}
              <OrbitButton disabled={busy || hostedMembers.length === 0} onPress={() => void finish()}>
                {busy ? 'Saving…' : 'Start'}
              </OrbitButton>
            </>
          ) : null}
        </KeyboardScreen>
      </View>

      <InviteQrScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={(scanned) => {
          setScannerOpen(false);
          void addCode(scanned);
        }}
      />
    </>
  );
}

function Bullet({
  title,
  body,
  color,
  muted,
}: {
  title: string;
  body: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.bullet}>
      <Text style={[styles.bulletTitle, { color }]}>{title}</Text>
      <Text style={[styles.bulletBody, { color: muted }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
  },
  back: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backSpacer: { width: 44 },
  dots: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  scroll: { flex: 1 },
  content: {
    gap: space.md,
    paddingBottom: 48,
    paddingHorizontal: space.xl,
  },
  body: { fontSize: 16, lineHeight: 22 },
  bullet: { gap: 4 },
  bulletTitle: { fontSize: 15, fontWeight: '700' },
  bulletBody: { fontSize: 14, lineHeight: 20 },
  fieldBlock: { gap: 8 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.card,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: '600',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputFlex: { flex: 1 },
  clearBtn: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  faceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },
  faceTile: {
    alignItems: 'center',
    gap: 8,
    width: 88,
  },
  faceRing: {
    borderRadius: 36,
    borderWidth: 3,
    padding: 2,
    position: 'relative',
  },
  check: {
    alignItems: 'center',
    borderRadius: 12,
    bottom: 0,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 24,
  },
  faceName: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: { fontSize: 14, lineHeight: 20 },
  secondaryBlock: { gap: 6 },
  codeBlock: { gap: space.sm },
  codeRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  codeInput: { flex: 1 },
  addBtn: { minWidth: 72 },
  error: { color: '#F87171', fontSize: 14, lineHeight: 20 },
  hosted: { gap: 8 },
  hostedRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    padding: 12,
  },
  hostedName: { flex: 1, fontSize: 16, fontWeight: '700' },
  readyFaces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  readyFace: {
    alignItems: 'center',
    gap: 6,
    width: 72,
  },
  link: { fontSize: 15, fontWeight: '600', paddingVertical: 8 },
});

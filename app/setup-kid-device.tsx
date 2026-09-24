/**
 * Shared devices — WO14 §3.
 * List first; setup is a horizontal pager (next card peeks ~60px) with
 * Name · Who · Faces · Hand over pills.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { SettingsModalChrome } from '@/components/orbit/settings/modal-chrome';
import { userFacingMessage } from '@/lib/auth/auth-errors';
import { dataMode } from '@/config/data-mode';
import { clearDeviceSession } from '@/lib/device/device-session';
import { saveChildInviteRecord } from '@/lib/household/child-invites';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { resolveMemberByProfileCode } from '@/lib/household/profile-codes';
import {
  DEFAULT_SHARED_IPAD_NAME,
  listSharedDevices,
  resolveSharedDevicePeople,
} from '@/lib/household/shared-device';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';

type SetupStep = 1 | 2 | 3 | 4;

const STEP_COUNT = 4;
const STEP_PILLS = ['Name', 'Who', 'Faces', 'Hand over'] as const;
const PEEK = 60;
const H_PAD = 20;
const CARD_GAP = 12;

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
  const { c, isDark, glassBorder } = useOrbitColors();
  const accent = c.primary;

  const readOnly = isTruthyParam(params.readonly);
  const fromStepParam = parseStep(params.step);
  const [flowOpen, setFlowOpen] = useState(Boolean(fromStepParam) && !readOnly);
  const [step, setStep] = useState<SetupStep>(fromStepParam ?? 1);
  const [deviceLabel, setDeviceLabel] = useState(DEFAULT_SHARED_IPAD_NAME);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [codeMode, setCodeMode] = useState(false);
  const [code, setCode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hydratedExisting = useRef(false);
  const addingAnotherRef = useRef(false);
  const pagerRef = useRef<FlatList>(null);
  const screenW = Dimensions.get('window').width;
  const cardW = screenW - H_PAD * 2 - PEEK;

  const isAdmin = permissions.canManageHousehold;

  const devices = useMemo(() => listSharedDevices(household.members), [household.members]);

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
    // Only prefill when opening an empty flow with exactly one existing device
    // and the user did not tap "Add another".
    if (addingAnotherRef.current) return;
    const existing = devices[0];
    if (!existing) return;
    hydratedExisting.current = true;
    if (existing.name?.trim()) setDeviceLabel(existing.name.trim());
    const people = resolveSharedDevicePeople(existing, household.members);
    if (people.length > 0) setSelectedIds(people.map((person) => person.id));
  }, [devices, household.members]);

  useEffect(() => {
    if (fromStepParam && !readOnly) {
      setFlowOpen(true);
      setStep(fromStepParam);
    }
  }, [fromStepParam, readOnly]);

  useEffect(() => {
    if (!flowOpen) return;
    const timer = setTimeout(() => {
      pagerRef.current?.scrollToIndex({ index: step - 1, animated: true });
    }, 16);
    return () => clearTimeout(timer);
  }, [flowOpen, step]);

  const goToStep = (next: SetupStep) => {
    setError('');
    setStep(next);
  };

  const goBackStep = () => {
    if (step === 1) {
      setFlowOpen(false);
      return;
    }
    goToStep((step - 1) as SetupStep);
  };

  const goNextStep = () => {
    if (step === 1 && !deviceLabel.trim()) {
      setError('Give the device a name.');
      return;
    }
    if (step === 2 && selectedIds.length === 0) {
      setError('Pick at least one person.');
      return;
    }
    if (step < STEP_COUNT) {
      goToStep((step + 1) as SetupStep);
      return;
    }
    void finish();
  };

  const onPagerScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / (cardW + CARD_GAP));
    const next = Math.min(STEP_COUNT, Math.max(1, index + 1)) as SetupStep;
    if (next !== step) goToStep(next);
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
      setError(userFacingMessage(err, 'Could not prepare this Sidekick.'));
    }
  };

  const addCode = async (raw: string) => {
    setError('');
    const member = resolveMemberByProfileCode(raw, household.members);
    if (!member) {
      setError('That code does not match anyone here.');
      return;
    }
    if (selectedIds.includes(member.id)) {
      setError(`${member.name} is already on this device.`);
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
        const personCode = await ensureMemberProfileInviteCode(person.id);
        if (!personCode) {
          throw new Error(`Could not make a profile code for ${person.name}.`);
        }
        codes.push(personCode);
        if (!household.id) {
          throw new Error('Create the household before setting up this device.');
        }
        await saveChildInviteRecord({
          member: { ...person, profileInviteCode: personCode, role: 'child' },
          householdId: household.id,
          householdName: household.householdName,
          code: personCode,
        });
      }
      const label = deviceLabel.trim() || DEFAULT_SHARED_IPAD_NAME;
      // Match by name only — never fall back to devices[0] (audit WO14 P1).
      let sharedDeviceId: string | null =
        listSharedDevices(household.members).find((d) => d.name === label)?.id ?? null;

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

      if (dataMode !== 'mock') {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
          if (signOutError) console.warn('setupKidDevice.localSignOut', signOutError.message);
        }
      }

      router.replace('/select-profile' as never);
    } catch (err) {
      setError(userFacingMessage(err, 'Could not set up this shared device.'));
    } finally {
      setBusy(false);
    }
  };

  const useAsPersonalPhone = () => {
    Alert.alert('Use as a personal phone?', 'This device will stop asking who is using it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Use as personal',
        onPress: () => {
          void clearDeviceSession().then(() => router.replace('/(tabs)' as never));
        },
      },
    ]);
  };

  const labelPreview = deviceLabel.trim() || DEFAULT_SHARED_IPAD_NAME;
  const nextLabel =
    step === 1
      ? 'Next · who uses it'
      : step === 2
        ? 'Next · faces'
        : step === 3
          ? 'Next · hand over'
          : busy
            ? 'Saving…'
            : 'Hand over';

  const cardStyle = [
    styles.stepCard,
    {
      width: cardW,
      backgroundColor: glassFill(isDark),
      borderColor: glassBorder(0.1),
    },
  ];

  const renderStep = (index: number) => {
    if (index === 0) {
      return (
        <View style={cardStyle}>
          <Text style={[styles.stepTitle, { color: c.text }]}>Name the device</Text>
          <Text style={[styles.stepSub, { color: c.textMuted }]}>Only you see this name.</Text>
          <Text style={[styles.fieldLabel, { color: c.textSubtle }]}>DEVICE NAME</Text>
          <TextInput
            value={deviceLabel}
            onChangeText={setDeviceLabel}
            placeholder={DEFAULT_SHARED_IPAD_NAME}
            placeholderTextColor={c.textSubtle}
            accessibilityLabel="Device name"
            style={[
              styles.input,
              { color: c.text, borderColor: glassBorder(0.12), backgroundColor: glassFill(isDark) },
            ]}
            returnKeyType="done"
            onSubmitEditing={goNextStep}
          />
          <Text style={[styles.hint, { color: c.textSubtle }]}>Do this on the device itself.</Text>
        </View>
      );
    }
    if (index === 1) {
      return (
        <View style={cardStyle}>
          <Text style={[styles.stepTitle, { color: c.text }]}>Who uses it</Text>
          <Text style={[styles.stepSub, { color: c.textMuted }]}>
            {isAdmin ? 'Tap each Sidekick who shares it.' : 'Scan or type a profile code.'}
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
                    accessibilityState={{ checked: selected }}>
                    <View
                      style={[
                        styles.faceRing,
                        { borderColor: selected ? accent : 'transparent' },
                      ]}>
                      <Avatar
                        name={member.name}
                        emoji={memberDisplayEmoji(member)}
                        imageUri={photo ? member.avatar : undefined}
                        size="l"
                      />
                    </View>
                    <Text style={[styles.faceName, { color: c.text }]} numberOfLines={1}>
                      {member.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
                  style={[
                    styles.input,
                    styles.codeInput,
                    {
                      color: c.text,
                      borderColor: glassBorder(0.12),
                      backgroundColor: glassFill(isDark),
                    },
                  ]}
                  onSubmitEditing={() => void addCode(code)}
                />
                <OrbitButton
                  tone="secondary"
                  onPress={() => void addCode(code)}
                  disabled={!code.trim()}>
                  Add
                </OrbitButton>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setCodeMode(true)} accessibilityRole="button">
              <Text style={[styles.link, { color: c.textMuted }]}>Scan or type a code instead</Text>
            </Pressable>
          )}
        </View>
      );
    }
    if (index === 2) {
      return (
        <View style={cardStyle}>
          <Text style={[styles.stepTitle, { color: c.text }]}>Faces</Text>
          <Text style={[styles.stepSub, { color: c.textMuted }]}>
            They tap their face to open their own Orbit.
          </Text>
          <View style={styles.faceGrid}>
            {hostedMembers.map((person) => (
              <View key={person.id} style={styles.faceTile}>
                <Avatar
                  name={person.name}
                  emoji={memberDisplayEmoji(person)}
                  imageUri={isAvatarImageUri(person.avatar) ? person.avatar : undefined}
                  size="l"
                />
                <Text style={[styles.faceName, { color: c.text }]} numberOfLines={1}>
                  {person.name}
                </Text>
              </View>
            ))}
          </View>
          {hostedMembers.length === 0 ? (
            <Text style={[styles.hint, { color: c.textSubtle }]}>Pick people in Who first.</Text>
          ) : null}
        </View>
      );
    }
    return (
      <View style={cardStyle}>
        <Text style={[styles.stepTitle, { color: c.text }]}>Hand over</Text>
        <Text style={[styles.stepSub, { color: c.textMuted }]}>
          {hostedMembers.length} on {labelPreview}. This phone signs out here so they can pick a
          face.
        </Text>
        <View style={styles.faceGrid}>
          {hostedMembers.map((person) => (
            <View key={person.id} style={styles.faceTile}>
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
      </View>
    );
  };

  // ——— List mode ———
  if (!flowOpen) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SettingsModalChrome
          backLabel="People"
          title="Shared devices"
          purpose="One device the kids share. They tap their own face to switch.">
          <View style={[styles.listBody, { paddingBottom: insets.bottom + 24 }]}>
            {devices.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
                ]}>
                <Text style={[styles.emptyTitle, { color: c.text }]}>No shared devices yet</Text>
                <Text style={[styles.stepSub, { color: c.textMuted }]}>
                  Set one up on the tablet or phone the kids will share.
                </Text>
              </View>
            ) : (
              devices.map((device) => {
                const people = resolveSharedDevicePeople(device, household.members);
                const names = people.map((p) => p.name).join(', ') || 'No one yet';
                return (
                  <View
                    key={device.id}
                    style={[
                      styles.deviceCard,
                      { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
                    ]}>
                    <View style={[styles.deviceIcon, { backgroundColor: `${accent}22` }]}>
                      <MaterialIcons name="tablet-mac" size={20} color={accent} />
                    </View>
                    <View style={styles.deviceBody}>
                      <Text style={[styles.deviceName, { color: c.text }]}>
                        {device.name?.trim() || DEFAULT_SHARED_IPAD_NAME}
                      </Text>
                      <Text style={[styles.deviceMeta, { color: c.textMuted }]}>
                        {names} · ready
                      </Text>
                    </View>
                    <View style={[styles.livePill, { backgroundColor: `${accent}22` }]}>
                      <Text style={[styles.liveLabel, { color: accent }]}>Live</Text>
                    </View>
                  </View>
                );
              })
            )}

            {readOnly ? (
              <Text style={[styles.hint, { color: c.textSubtle, textAlign: 'center' }]}>
                Do this on the device itself.
              </Text>
            ) : (
              <>
                <OrbitButton
                  onPress={() => {
                    setFlowOpen(true);
                    setStep(1);
                  }}>
                  {devices.length ? 'Add another' : 'Add a device'}
                </OrbitButton>
                <Pressable onPress={useAsPersonalPhone} accessibilityRole="button">
                  <Text style={[styles.link, { color: c.textSubtle, textAlign: 'center' }]}>
                    This is my personal phone
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </SettingsModalChrome>
      </>
    );
  }

  // ——— Setup flow ———
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsModalChrome
        backLabel="Shared devices"
        onBack={() => setFlowOpen(false)}
        title="Shared devices"
        purpose={`Add a device · ${step} of ${STEP_COUNT}`}>
        <View style={styles.flowBody}>
          <View style={styles.dashRow} accessibilityLabel={`Step ${step} of ${STEP_COUNT}`}>
            {Array.from({ length: STEP_COUNT }, (_, i) => (
              <View
                key={`dash-${i}`}
                style={[
                  styles.dash,
                  {
                    backgroundColor: i + 1 <= step ? accent : glassBorder(0.14),
                  },
                ]}
              />
            ))}
          </View>

          <FlatList
            ref={pagerRef}
            horizontal
            data={[0, 1, 2, 3]}
            keyExtractor={(item) => `step-${item}`}
            renderItem={({ item }) => renderStep(item)}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardW + CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: H_PAD, gap: CARD_GAP }}
            onMomentumScrollEnd={onPagerScrollEnd}
            getItemLayout={(_, index) => ({
              length: cardW + CARD_GAP,
              offset: (cardW + CARD_GAP) * index,
              index,
            })}
            style={styles.pager}
          />

          <View style={styles.pillRow}>
            {STEP_PILLS.map((label, i) => {
              const active = i + 1 === step;
              return (
                <Pressable
                  key={label}
                  onPress={() => goToStep((i + 1) as SetupStep)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: active ? accent : glassFill(isDark),
                      borderColor: active ? accent : glassBorder(0.1),
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label}>
                  <Text
                    style={[
                      styles.pillLabel,
                      { color: active ? (isDark ? '#041018' : '#fff') : c.textMuted },
                    ]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <View style={[styles.navRow, { paddingBottom: insets.bottom + 12 }]}>
            <Pressable
              onPress={goBackStep}
              style={[styles.navBack, { borderColor: glassBorder(0.12) }]}
              accessibilityRole="button"
              accessibilityLabel="Back">
              <MaterialIcons name="chevron-left" size={28} color={c.textMuted} />
            </Pressable>
            <OrbitButton
              onPress={goNextStep}
              disabled={busy || (step === 2 && selectedIds.length === 0)}
              style={styles.navNext}>
              {nextLabel}
            </OrbitButton>
          </View>
        </View>
      </SettingsModalChrome>

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

const styles = StyleSheet.create({
  listBody: { gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  emptyCard: { borderRadius: 20, borderWidth: 1, gap: 8, padding: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  deviceCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  deviceIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  deviceBody: { flex: 1, gap: 2, minWidth: 0 },
  deviceName: { fontSize: 16, fontWeight: '600' },
  deviceMeta: { fontSize: 13 },
  livePill: {
    borderRadius: 999,
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  liveLabel: { fontSize: 12, fontWeight: '700' },
  flowBody: { flex: 1, gap: 14 },
  dashRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
  },
  dash: { borderRadius: 2, flex: 1, height: 4 },
  pager: { flexGrow: 0 },
  stepCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    minHeight: 280,
    padding: 16,
  },
  stepTitle: { fontSize: 22, fontWeight: '600', letterSpacing: -0.3 },
  stepSub: { fontSize: 14, lineHeight: 20 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: '600',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  hint: { fontSize: 13, lineHeight: 18 },
  faceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  faceTile: { alignItems: 'center', gap: 6, width: 80 },
  faceRing: { borderRadius: 36, borderWidth: 3, padding: 2 },
  faceName: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  codeBlock: { gap: 10 },
  codeRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  codeInput: { flex: 1 },
  link: { fontSize: 15, fontWeight: '600', paddingVertical: 8 },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillLabel: { fontSize: 13, fontWeight: '600' },
  error: { color: '#F87171', fontSize: 14, paddingHorizontal: 20 },
  navRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  navBack: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  navNext: { flex: 1 },
});

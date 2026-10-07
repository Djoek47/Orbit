/**
 * Shared devices — admin creates the device + invite QR on their phone;
 * the tablet scans that QR (join-shared-device) and hosts the faces.
 *
 * Pager: Name · Who · Faces (tutorial) · Hand over (QR).
 * DEV simulates the tablet connect locally without a second device.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import {
  Alert,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
import { MemberPresencePill } from '@/components/orbit/members/member-presence-pill';
import { ProfileQrCard } from '@/components/orbit/members/profile-qr-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { SettingsModalChrome } from '@/components/orbit/settings/modal-chrome';
import { SwitchPeopleIcon } from '@/components/orbit/switch-people-icon';
import { userFacingMessage } from '@/lib/auth/auth-errors';
import { useContentWidth } from '@/components/orbit/layout/app-column';
import { sharedDeviceReadiness } from '@/lib/household/shared-device-readiness';
import { clearDeviceSession } from '@/lib/device/device-session';
import { saveChildInviteRecord } from '@/lib/household/child-invites';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { formatLastSeen, memberIsLive } from '@/lib/household/member-presence';
import { resolveMemberByProfileCode } from '@/lib/household/profile-codes';
import {
  DEFAULT_SHARED_IPAD_NAME,
  listSharedDevices,
  resolveSharedDevicePeople,
  SHARED_DEVICE_MAX_PEOPLE,
} from '@/lib/household/shared-device';
import {
  buildSharedDeviceInviteLink,
  parseSharedDeviceInvitePayload,
} from '@/lib/household/shared-device-invite';
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

function deviceLastActive(people: HouseholdMember[]): string | null {
  let latest: number | null = null;
  for (const person of people) {
    const iso = person.lastSeenAt?.trim();
    if (!iso) continue;
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) continue;
    if (latest == null || ms > latest) latest = ms;
  }
  return latest == null ? null : new Date(latest).toISOString();
}

export default function SetupKidDeviceScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ step?: string; readonly?: string; deviceId?: string }>();
  const {
    connectSharedTabletProfiles,
    createSharedDevice,
    ensureMemberProfileInviteCode,
    household,
    permissions,
    rotateMemberProfileInviteCode,
    updateSharedDeviceLinks,
  } = useOrbit();
  const { c, isDark, glassBorder } = useOrbitColors();
  const accent = c.primary;

  const readOnly = isTruthyParam(params.readonly);
  const fromStepParam = parseStep(params.step);
  const paramDeviceId = Array.isArray(params.deviceId) ? params.deviceId[0] : params.deviceId;
  const [flowOpen, setFlowOpen] = useState(Boolean(fromStepParam) && !readOnly);
  const [step, setStep] = useState<SetupStep>(fromStepParam ?? 1);
  const [deviceLabel, setDeviceLabel] = useState(DEFAULT_SHARED_IPAD_NAME);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [codeMode, setCodeMode] = useState(false);
  const [code, setCode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteReady, setInviteReady] = useState(false);
  const [viewingDeviceId, setViewingDeviceId] = useState<string | null>(paramDeviceId ?? null);
  const [detailLink, setDetailLink] = useState<string | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [regeneratingDetail, setRegeneratingDetail] = useState(false);
  const hydratedExisting = useRef(false);
  const addingAnotherRef = useRef(false);
  const pagerRef = useRef<FlatList>(null);
  // The column's width, live — not the window's, measured once. On an iPad the window is far
  // wider than the column the wizard sits in, and the cards came out ~950pt wide.
  const screenW = useContentWidth().width;
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

  /**
   * Can this household put anyone on a device yet? A Sidekick is only pickable once they have
   * signed in, so the grid can be empty for a reason the screen never used to give.
   */
  const readiness = useMemo(
    () => sharedDeviceReadiness(household.members),
    [household.members]
  );

  const hostedMembers = useMemo(
    () =>
      selectedIds
        .map((id) => household.members.find((m) => m.id === id))
        .filter((m): m is HouseholdMember => Boolean(m)),
    [household.members, selectedIds]
  );

  const switchCount = Math.max(2, Math.min(SHARED_DEVICE_MAX_PEOPLE, hostedMembers.length || 2));

  useEffect(() => {
    if (hydratedExisting.current) return;
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
    if (paramDeviceId) {
      setViewingDeviceId(paramDeviceId);
      setFlowOpen(false);
    }
  }, [paramDeviceId]);

  useEffect(() => {
    if (!flowOpen) return;
    const timer = setTimeout(() => {
      pagerRef.current?.scrollToIndex({ index: step - 1, animated: true });
    }, 16);
    return () => clearTimeout(timer);
  }, [flowOpen, step]);

  const viewingDevice = useMemo(
    () =>
      viewingDeviceId
        ? household.members.find((m) => m.id === viewingDeviceId) ?? null
        : null,
    [household.members, viewingDeviceId]
  );

  const viewingPeople = useMemo(
    () => (viewingDevice ? resolveSharedDevicePeople(viewingDevice, household.members) : []),
    [viewingDevice, household.members]
  );

  const buildLinkForDevice = async (
    device: HouseholdMember,
    people: HouseholdMember[],
    rotateCodes: boolean
  ): Promise<string> => {
    const codes: string[] = [];
    for (const person of people) {
      const personCode = rotateCodes
        ? await rotateMemberProfileInviteCode(person.id)
        : await ensureMemberProfileInviteCode(person.id);
      if (!personCode) {
        throw new Error(`Could not make a profile code for ${person.name}.`);
      }
      codes.push(personCode);
      if (household.id) {
        await saveChildInviteRecord({
          member: { ...person, profileInviteCode: personCode, role: 'child' },
          householdId: household.id,
          householdName: household.householdName,
          code: personCode,
        });
      }
    }
    if (codes.length === 0) {
      throw new Error('Add at least one Sidekick on this device before showing a QR code.');
    }
    const label = device.name?.trim() || DEFAULT_SHARED_IPAD_NAME;
    return buildSharedDeviceInviteLink({ label, codes });
  };

  useEffect(() => {
    if (!viewingDevice) {
      setDetailLink(null);
      return;
    }
    let cancelled = false;
    setDetailBusy(true);
    void buildLinkForDevice(viewingDevice, viewingPeople, false)
      .then((link) => {
        if (!cancelled) setDetailLink(link);
      })
      .catch((err) => {
        if (!cancelled) {
          setDetailLink(null);
          setError(userFacingMessage(err, 'Could not load this device QR code.'));
        }
      })
      .finally(() => {
        if (!cancelled) setDetailBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // Rebuild when device or linked people change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingDevice?.id, viewingPeople.map((p) => p.id).join('|')]);

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

  const prepareInvite = async (): Promise<string> => {
    if (hostedMembers.length === 0) {
      throw new Error('Pick at least one person.');
    }
    if (hostedMembers.length > SHARED_DEVICE_MAX_PEOPLE) {
      throw new Error(
        `This tablet is full — up to ${SHARED_DEVICE_MAX_PEOPLE} people can share it. Remove someone first, or set up another shared device.`
      );
    }

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

    return buildSharedDeviceInviteLink({ label, codes });
  };

  /** Admin phone: create device + QR code. Never signs the admin out. */
  const finishWithQr = async () => {
    try {
      setBusy(true);
      setError('');
      const link = await prepareInvite();
      setInviteLink(link);
      setInviteReady(true);
    } catch (err) {
      setError(userFacingMessage(err, 'Could not create this shared-device invite.'));
    } finally {
      setBusy(false);
    }
  };

  /**
   * DEV only — pretend this phone is the tablet so we can test Switch / face picker
   * without a second device. Normal Hand over never does this.
   */
  const finishDevOnThisPhone = async () => {
    try {
      setBusy(true);
      setError('');
      const link = inviteLink ?? (await prepareInvite());
      setInviteLink(link);
      setInviteReady(true);
      const invite = parseSharedDeviceInvitePayload(link);
      if (!invite?.codes.length) {
        throw new Error('Invite has no profile codes.');
      }
      await connectSharedTabletProfiles(invite.codes, invite.label);
      router.replace('/select-profile' as never);
    } catch (err) {
      setError(userFacingMessage(err, 'DEV connect failed.'));
    } finally {
      setBusy(false);
    }
  };

  const goNextStep = () => {
    if (step === 1 && !deviceLabel.trim()) {
      setError('Give the device a name.');
      return;
    }
    if (step === 2 && readiness.blocked) {
      // Nobody can be picked yet — say why rather than asking for the impossible.
      setError(readiness.body);
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
    void finishWithQr();
  };

  const onPagerScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / (cardW + CARD_GAP));
    const next = Math.min(STEP_COUNT, Math.max(1, index + 1)) as SetupStep;
    if (next !== step) goToStep(next);
  };

  const toggleSidekick = async (member: HouseholdMember) => {
    setError('');
    setInviteReady(false);
    setInviteLink(null);
    const already = selectedIds.includes(member.id);
    if (already) {
      setSelectedIds((current) => current.filter((id) => id !== member.id));
      return;
    }
    if (selectedIds.length >= SHARED_DEVICE_MAX_PEOPLE) {
      setError(
        `This tablet is full — up to ${SHARED_DEVICE_MAX_PEOPLE} people can share it. Remove someone first, or set up another shared device.`
      );
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
    if (selectedIds.length >= SHARED_DEVICE_MAX_PEOPLE) {
      setError(
        `This tablet is full — up to ${SHARED_DEVICE_MAX_PEOPLE} people can share it. Remove someone first, or set up another shared device.`
      );
      return;
    }
    try {
      await ensureMemberProfileInviteCode(member.id);
      setSelectedIds((current) => [...current, member.id]);
      setCode('');
      setCodeMode(false);
      setInviteReady(false);
      setInviteLink(null);
    } catch (err) {
      setError(userFacingMessage(err, 'Could not add this Sidekick.'));
    }
  };

  const useAsPersonalPhone = () => {
    orbitAlert('Use as a personal phone?', 'This device will stop asking who is using it.', [
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
            ? 'Creating…'
            : inviteReady
              ? 'Done'
              : 'Create QR code';

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
          <Text style={[styles.stepSub, { color: c.textMuted }]}>
            Only you see this name. The tablet joins by scanning a QR code next.
          </Text>
          <Text style={[styles.fieldLabel, { color: c.textSubtle }]}>DEVICE NAME</Text>
          <TextInput
            value={deviceLabel}
            onChangeText={(value) => {
              setDeviceLabel(value);
              setInviteReady(false);
              setInviteLink(null);
            }}
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
          <Text style={[styles.hint, { color: c.textSubtle }]}>
            Do this on your phone — then scan the QR code on the shared tablet.
          </Text>
        </View>
      );
    }
    if (index === 1) {
      return (
        <View style={cardStyle}>
          <Text style={[styles.stepTitle, { color: c.text }]}>Who uses it</Text>
          <Text style={[styles.stepSub, { color: c.textMuted }]}>
            {isAdmin
              ? `Tap each Sidekick who shares it (max ${SHARED_DEVICE_MAX_PEOPLE}). Admins stay on their own phones.`
              : 'Scan or type a profile code.'}
          </Text>

          {isAdmin && readiness.title ? (
            <View
              style={[
                styles.readiness,
                {
                  backgroundColor: readiness.blocked ? `${c.danger}14` : glassFill(isDark),
                  borderColor: readiness.blocked ? `${c.danger}55` : glassBorder(0.12),
                },
              ]}>
              <View style={styles.readinessHead}>
                <MaterialIcons
                  name={readiness.blocked ? 'hourglass-empty' : 'lightbulb-outline'}
                  size={18}
                  color={readiness.blocked ? c.danger : c.textMuted}
                />
                <Text style={[styles.readinessTitle, { color: c.text }]}>{readiness.title}</Text>
              </View>
              <Text style={[styles.readinessBody, { color: c.textMuted }]}>{readiness.body}</Text>
            </View>
          ) : null}

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
                Scan profile QR code
              </OrbitButton>
              <View style={styles.codeRow}>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="CMX-EM7K4Q"
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
            On the tablet, each person taps their profile to open their own Orbit.
          </Text>

          <View
            style={[
              styles.tutorialBox,
              { backgroundColor: `${accent}14`, borderColor: `${accent}33` },
            ]}>
            <View style={[styles.tutorialIcon, { backgroundColor: accent }]}>
              <SwitchPeopleIcon count={switchCount} size={22} color={isDark ? '#041018' : '#fff'} />
            </View>
            <View style={styles.tutorialCopy}>
              <Text style={[styles.tutorialTitle, { color: c.text }]}>Switch button</Text>
              <Text style={[styles.tutorialBody, { color: c.textMuted }]}>
                Where Poppins sits on an admin phone, the tablet shows Switch —{' '}
                {hostedMembers.length >= 2
                  ? `${hostedMembers.length} double-arrows`
                  : 'double-arrows'}{' '}
                so anyone can hand the device over without leaving the app.
              </Text>
            </View>
          </View>

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
          ) : (
            <Text style={[styles.hint, { color: c.textSubtle }]}>
              Tip: long-press a face later to remove them from this tablet.
            </Text>
          )}
        </View>
      );
    }
    return (
      <View style={cardStyle}>
        <Text style={[styles.stepTitle, { color: c.text }]}>Hand over</Text>
        <Text style={[styles.stepSub, { color: c.textMuted }]}>
          {inviteReady
            ? `Scan this on ${labelPreview}. Your admin account stays signed in here.`
            : `${hostedMembers.length} on ${labelPreview}. Create a QR code — the tablet scans it to join. You stay signed in.`}
        </Text>

        {inviteReady && inviteLink ? (
          <View style={styles.qrBlock}>
            <View style={styles.qrWrap}>
              <QRCode value={inviteLink} size={168} backgroundColor="#FFFFFF" color="#0F1C2A" />
            </View>
            <Text style={[styles.hint, { color: c.textSubtle, textAlign: 'center' }]}>
              On the tablet, open ChoreMaxx, tap Get Started, then scan this code.
            </Text>
            <Pressable
              onPress={() => {
                void Clipboard.setStringAsync(inviteLink);
                orbitAlert('Copied', 'Shared-device invite link copied.');
              }}
              style={styles.copyRow}
              accessibilityRole="button">
              <MaterialIcons name="content-copy" size={15} color={c.textSubtle} />
              <Text style={[styles.copyLabel, { color: c.textSubtle }]}>Copy invite link</Text>
            </Pressable>
          </View>
        ) : (
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
        )}
      </View>
    );
  };

  // ——— Existing device detail (QR + presence + regenerate) ———
  if (!flowOpen && viewingDevice) {
    const label = viewingDevice.name?.trim() || DEFAULT_SHARED_IPAD_NAME;
    const lastIso = deviceLastActive(viewingPeople);
    const anyoneLive = viewingPeople.some((p) => memberIsLive(p));
    const statusLine = anyoneLive
      ? 'Someone is connected'
      : lastIso
        ? `Last active ${formatLastSeen(lastIso)}`
        : viewingPeople.length
          ? 'No one connected yet'
          : 'No one on this device yet';

    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SettingsModalChrome
          backLabel="Shared devices"
          onBack={() => {
            setViewingDeviceId(null);
            setDetailLink(null);
            setError('');
          }}
          title={label}
          purpose="Show the QR code the tablet already uses — or mint a fresh one.">
          <ScrollView
            contentContainerStyle={[styles.listBody, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}>
            <Animated.View
              entering={FadeInDown.duration(260)}
              style={[
                styles.detailCard,
                { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
              ]}>
              <View style={styles.detailHead}>
                <View style={[styles.deviceIcon, { backgroundColor: `${accent}22` }]}>
                  <MaterialIcons name="tablet-mac" size={20} color={accent} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.deviceName, { color: c.text }]}>{label}</Text>
                  <Text style={[styles.deviceMeta, { color: anyoneLive ? '#38BDF8' : c.textMuted }]}>
                    {statusLine}
                  </Text>
                </View>
                <View
                  style={[
                    styles.livePill,
                    { backgroundColor: anyoneLive ? 'rgba(56,189,248,0.22)' : glassBorder(0.08) },
                  ]}>
                  <Text style={[styles.liveLabel, { color: anyoneLive ? '#38BDF8' : c.textSubtle }]}>
                    {anyoneLive ? 'Live' : 'Idle'}
                  </Text>
                </View>
              </View>

              {viewingPeople.length > 0 ? (
                <View style={styles.detailFaces}>
                  {viewingPeople.map((person) => (
                    <View
                      key={person.id}
                      style={[
                        styles.detailFace,
                        { backgroundColor: `${accent}14`, borderColor: glassBorder(0.1) },
                      ]}>
                      <Avatar
                        name={person.name}
                        emoji={memberDisplayEmoji(person)}
                        imageUri={isAvatarImageUri(person.avatar) ? person.avatar : undefined}
                        size="s"
                      />
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={[styles.faceName, { color: c.text }]} numberOfLines={1}>
                          {person.name}
                        </Text>
                        <MemberPresencePill member={person} variant="full" />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.hint, { color: c.textSubtle }]}>
                  Add Sidekicks under Shared devices in People, then come back for the code.
                </Text>
              )}
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(70).duration(260)}
              style={[
                styles.detailCard,
                { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
              ]}>
              <Text style={[styles.emptyTitle, { color: c.text }]}>Device QR code</Text>
              {detailBusy && !detailLink ? (
                <Text style={[styles.hint, { color: c.textMuted }]}>Preparing QR code…</Text>
              ) : detailLink ? (
                <ProfileQrCard
                  qrValue={detailLink}
                  caption="On the tablet, open ChoreMaxx, tap Get Started, then scan this code."
                  onShare={async () => {
                    await Clipboard.setStringAsync(detailLink);
                    orbitAlert('Copied', 'Shared-device invite link copied.');
                  }}
                  shareLabel="Copy invite link"
                  onRegenerate={
                    readOnly || !isAdmin
                      ? undefined
                      : async () => {
                          setRegeneratingDetail(true);
                          try {
                            const link = await buildLinkForDevice(
                              viewingDevice,
                              viewingPeople,
                              true
                            );
                            setDetailLink(link);
                            orbitAlert(
                              'New QR code ready',
                              'Old tablet scans for this handoff will stop working.'
                            );
                          } catch (err) {
                            orbitAlert(
                              'QR code',
                              userFacingMessage(err, 'Could not generate a new QR code.')
                            );
                          } finally {
                            setRegeneratingDetail(false);
                          }
                        }
                  }
                  regenerating={regeneratingDetail}
                />
              ) : (
                <Text style={[styles.hint, { color: c.textMuted }]}>
                  {error || 'Add at least one Sidekick to show a QR code.'}
                </Text>
              )}
            </Animated.View>
          </ScrollView>
        </SettingsModalChrome>
      </>
    );
  }

  // ——— List mode ———
  if (!flowOpen) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SettingsModalChrome
          backLabel="People"
          title="Shared devices"
          purpose="Create a QR code on your phone. The tablet scans it — kids tap their profile to switch.">
          <View style={[styles.listBody, { paddingBottom: insets.bottom + 24 }]}>
            {devices.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
                ]}>
                <Text style={[styles.emptyTitle, { color: c.text }]}>No shared devices yet</Text>
                <Text style={[styles.stepSub, { color: c.textMuted }]}>
                  Name it, pick Sidekicks, then hand the QR code to the tablet.
                </Text>
              </View>
            ) : (
              devices.map((device) => {
                const people = resolveSharedDevicePeople(device, household.members);
                const names = people.map((p) => p.name).join(', ') || 'No one yet';
                const anyoneLive = people.some((p) => memberIsLive(p));
                const lastIso = deviceLastActive(people);
                const meta = anyoneLive
                  ? `${names} · connected`
                  : lastIso
                    ? `${names} · last active ${formatLastSeen(lastIso)}`
                    : `${names} · tap for QR code`;
                return (
                  <Pressable
                    key={device.id}
                    onPress={() => {
                      setError('');
                      setViewingDeviceId(device.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${device.name?.trim() || DEFAULT_SHARED_IPAD_NAME} QR code`}
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
                      <Text style={[styles.deviceMeta, { color: c.textMuted }]} numberOfLines={2}>
                        {meta}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.livePill,
                        {
                          backgroundColor: anyoneLive
                            ? 'rgba(56,189,248,0.22)'
                            : glassBorder(0.08),
                        },
                      ]}>
                      <Text
                        style={[
                          styles.liveLabel,
                          { color: anyoneLive ? '#38BDF8' : c.textSubtle },
                        ]}>
                        {anyoneLive ? 'Live' : 'QR code'}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
                  </Pressable>
                );
              })
            )}

            {readOnly ? (
              <Text style={[styles.hint, { color: c.textSubtle, textAlign: 'center' }]}>
                Ask an admin to create the invite QR code on their phone.
              </Text>
            ) : (
              <>
                <OrbitButton
                  onPress={() => {
                    addingAnotherRef.current = true;
                    hydratedExisting.current = true;
                    setDeviceLabel('');
                    setSelectedIds([]);
                    setError('');
                    setInviteLink(null);
                    setInviteReady(false);
                    setViewingDeviceId(null);
                    setFlowOpen(true);
                    setStep(1);
                  }}>
                  {devices.length ? 'Add another' : 'Add a device'}
                </OrbitButton>
                {__DEV__ ? (
                  <Pressable onPress={useAsPersonalPhone} accessibilityRole="button">
                    <Text style={[styles.link, { color: c.textSubtle, textAlign: 'center' }]}>
                      DEV · clear device binding
                    </Text>
                  </Pressable>
                ) : null}
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
            {step === 4 && __DEV__ ? (
              <Pressable
                onPress={() => void finishDevOnThisPhone()}
                disabled={busy || selectedIds.length === 0}
                style={[styles.devBtn, { borderColor: glassBorder(0.2) }]}
                accessibilityRole="button"
                accessibilityLabel="DEV connect on this phone">
                <Text style={[styles.devLabel, { color: c.textSubtle }]}>DEV</Text>
              </Pressable>
            ) : null}
            <OrbitButton
              onPress={() => {
                if (step === 4 && inviteReady) {
                  setFlowOpen(false);
                  return;
                }
                goNextStep();
              }}
              disabled={
                busy || (step === 2 && (readiness.blocked || selectedIds.length === 0))
              }
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
  detailCard: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  detailHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  detailFaces: { gap: 8 },
  detailFace: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
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
  readiness: {
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    marginTop: 12,
    padding: 14,
  },
  readinessHead: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  readinessTitle: { flex: 1, fontSize: 15, fontWeight: '800' },
  readinessBody: { fontSize: 13.5, lineHeight: 19 },
  codeBlock: { gap: 10 },
  codeRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  codeInput: { flex: 1 },
  link: { fontSize: 15, fontWeight: '600', paddingVertical: 8 },
  tutorialBox: {
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  tutorialIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  tutorialCopy: { flex: 1, gap: 4 },
  tutorialTitle: { fontSize: 15, fontWeight: '700' },
  tutorialBody: { fontSize: 13, lineHeight: 18 },
  qrBlock: { alignItems: 'center', gap: 10 },
  qrWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
  },
  copyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 6,
  },
  copyLabel: { fontSize: 13, fontWeight: '600' },
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
  devBtn: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    minWidth: 52,
    paddingHorizontal: 10,
  },
  devLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  navNext: { flex: 1 },
});

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitColors, orbitRadius, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { setupSharedDeviceSession } from '@/lib/device/device-session';
import { memberDisplayEmoji } from '@/lib/game-levels';
import {
  ensureProfileInviteCode,
  resolveMemberByProfileCode,
} from '@/lib/household/profile-codes';
import {
  listSharedDevices,
  resolveSharedDevicePeople,
} from '@/lib/household/shared-device';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';

/**
 * Kid / shared tablet setup: enter or scan multiple per-profile codes/QR
 * so one physical device can host several Netflix-style profiles.
 */
export default function SetupKidDeviceScreen() {
  const insets = useSafeAreaInsets();
  const { createSharedDevice, household, switchPersona, updateSharedDeviceLinks } = useOrbit();
  const [code, setCode] = useState('');
  const [hosted, setHosted] = useState<HouseholdMember[]>([]);
  const [deviceLabel, setDeviceLabel] = useState('Kids tablet');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const demoCodes = useMemo(() => {
    return household.members
      .filter((m) => m.profileInviteCode && m.status === 'active')
      .map((m) => `${m.name}: ${ensureProfileInviteCode(m)}`);
  }, [household.members]);

  useEffect(() => {
    const existing = listSharedDevices(household.members)[0];
    if (existing && hosted.length === 0) {
      const people = resolveSharedDevicePeople(existing, household.members);
      if (people.length > 0) {
        setHosted(people);
        setDeviceLabel(existing.name);
      }
    }
  }, [household.members, hosted.length]);

  const addCode = (raw: string) => {
    setError('');
    const member = resolveMemberByProfileCode(raw, household.members);
    if (!member) {
      setError('That code does not match a household profile. Ask an admin for a profile QR.');
      return;
    }
    if (hosted.some((item) => item.id === member.id)) {
      setError(`${member.name} is already on this device.`);
      return;
    }
    setHosted((current) => [...current, member]);
    setCode('');
  };

  const removeHosted = (memberId: string) => {
    setHosted((current) => current.filter((item) => item.id !== memberId));
  };

  const finish = async () => {
    if (hosted.length === 0) {
      setError('Add at least one profile with a code or QR.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      let sharedDeviceId: string | null =
        listSharedDevices(household.members).find((d) => d.name === deviceLabel.trim())?.id ??
        listSharedDevices(household.members)[0]?.id ??
        null;

      if (!sharedDeviceId) {
        const created = await createSharedDevice(deviceLabel.trim() || 'Kids tablet');
        sharedDeviceId = created?.id ?? null;
      }

      if (sharedDeviceId) {
        await updateSharedDeviceLinks(
          sharedDeviceId,
          hosted.map((person) => person.id)
        );
      }

      await setupSharedDeviceSession({
        profileMemberIds: hosted.map((person) => person.id),
        deviceLabel: deviceLabel.trim() || 'Kids tablet',
        sharedDeviceId,
      });

      router.replace('/select-profile' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set up this device.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <MaterialIcons name="arrow-back" size={20} color={orbitColors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={orbitTypography.caption}>Shared / kid device</Text>
            <Text style={orbitTypography.title}>Host multiple profiles</Text>
          </View>
        </View>

        <KeyboardScreen style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.body}>
            Enter or scan each person&apos;s profile code. This tablet will ask “Who&apos;s logging
            in?” before opening Choremaxx — like Netflix on a shared TV.
          </Text>

          <Text style={styles.label}>Device name</Text>
          <TextInput
            value={deviceLabel}
            onChangeText={setDeviceLabel}
            placeholder="Kids tablet"
            placeholderTextColor={orbitColors.textSubtle}
            style={styles.input}
          />

          <Text style={styles.label}>Add profile code</Text>
          <View style={styles.codeRow}>
            <TextInput
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              placeholder="CMX-JOSH"
              placeholderTextColor={orbitColors.textSubtle}
              style={[styles.input, styles.codeInput]}
              onSubmitEditing={() => addCode(code)}
            />
            <Pressable style={styles.scanBtn} onPress={() => setScannerOpen(true)}>
              <MaterialIcons name="qr-code-scanner" size={22} color="#38BDF8" />
            </Pressable>
          </View>
          <OrbitButton tone="secondary" onPress={() => addCode(code)} disabled={!code.trim()}>
            Add profile
          </OrbitButton>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {hosted.length > 0 ? (
            <View style={styles.hosted}>
              <Text style={styles.label}>Profiles on this device</Text>
              {hosted.map((person) => (
                <View key={person.id} style={styles.hostedRow}>
                  <Text style={styles.hostedEmoji}>{memberDisplayEmoji(person)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hostedName}>{person.name}</Text>
                    <Text style={styles.hostedCode}>{ensureProfileInviteCode(person)}</Text>
                  </View>
                  <Pressable onPress={() => removeHosted(person.id)}>
                    <MaterialIcons name="close" size={18} color="#F87171" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {demoCodes.length > 0 ? (
            <Text style={styles.hint}>Demo profile codes · {demoCodes.join(' · ')}</Text>
          ) : null}

          <OrbitButton disabled={busy || hosted.length === 0} onPress={() => void finish()}>
            {busy ? 'Saving…' : 'Continue to profile picker'}
          </OrbitButton>

          <OrbitButton
            tone="secondary"
            onPress={() => {
              if (hosted[0]) {
                switchPersona(hosted[0].id);
              }
              Alert.alert(
                'Personal device?',
                'Clear shared mode on this phone and use a single account instead.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Use personal',
                    onPress: () => {
                      void import('@/lib/device/device-session').then(({ clearDeviceSession }) =>
                        clearDeviceSession().then(() => router.replace('/(tabs)' as never))
                      );
                    },
                  },
                ]
              );
            }}>
            This is my personal phone
          </OrbitButton>
        </KeyboardScreen>
      </View>

      <InviteQrScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={(scanned) => addCode(scanned)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: orbitColors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: orbitSpacing.md,
    paddingHorizontal: orbitSpacing.lg,
    paddingVertical: orbitSpacing.sm,
  },
  back: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  scroll: { flex: 1 },
  content: {
    gap: orbitSpacing.md,
    paddingBottom: 48,
    paddingHorizontal: orbitSpacing.lg,
  },
  body: {
    color: orbitColors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    color: orbitColors.textSoft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    color: orbitColors.text,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  codeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  codeInput: { flex: 1 },
  scanBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderColor: 'rgba(56,189,248,0.35)',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  error: {
    color: '#F87171',
    fontSize: 13,
  },
  hosted: {
    gap: 8,
  },
  hostedRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  hostedEmoji: { fontSize: 28 },
  hostedName: { color: orbitColors.text, fontSize: 15, fontWeight: '700' },
  hostedCode: { color: orbitColors.textMuted, fontSize: 12, marginTop: 2 },
  hint: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    lineHeight: 17,
  },
});

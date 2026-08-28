import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { dataMode } from '@/config/data-mode';
import { radius, space, typography } from '@/constants/orbit-theme';
import { userFacingMessage } from '@/lib/auth/auth-errors';
import { clearDeviceSession, setupSharedDeviceSession } from '@/lib/device/device-session';
import { memberDisplayEmoji } from '@/lib/game-levels';
import {
  ensureProfileInviteCode,
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

/**
 * This iPad: add people by QR or code, then pick a face.
 * Device name is an excellent default — not a first-class field.
 */
export default function SetupKidDeviceScreen() {
  const insets = useSafeAreaInsets();
  const { createSharedDevice, household, updateSharedDeviceLinks } = useOrbit();
  const { c } = useOrbitColors();
  const [code, setCode] = useState('');
  const [hosted, setHosted] = useState<HouseholdMember[]>([]);
  const [deviceLabel, setDeviceLabel] = useState(DEFAULT_SHARED_IPAD_NAME);
  const [naming, setNaming] = useState(false);
  const [showTypeCode, setShowTypeCode] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const existing = listSharedDevices(household.members)[0];
    if (existing && hosted.length === 0) {
      const people = resolveSharedDevicePeople(existing, household.members);
      if (people.length > 0) {
        setHosted(people);
        setDeviceLabel(existing.name || DEFAULT_SHARED_IPAD_NAME);
      }
    }
  }, [household.members, hosted.length]);

  const addCode = (raw: string) => {
    setError('');
    const member = resolveMemberByProfileCode(raw, household.members);
    if (!member) {
      setError('That code doesn’t match anyone here. Ask an admin for their profile QR.');
      return;
    }
    if (hosted.some((item) => item.id === member.id)) {
      setError(`${member.name} is already on this iPad.`);
      return;
    }
    setHosted((current) => [...current, member]);
    setCode('');
    setShowTypeCode(false);
  };

  const removeHosted = (memberId: string) => {
    setHosted((current) => current.filter((item) => item.id !== memberId));
  };

  const finish = async () => {
    if (hosted.length === 0) {
      setError('Add someone before continuing.');
      return;
    }
    try {
      setBusy(true);
      setError('');
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
          hosted.map((person) => person.id)
        );
      }

      await setupSharedDeviceSession({
        profileMemberIds: hosted.map((person) => person.id),
        deviceLabel: label,
        sharedDeviceId,
      });

      router.replace('/select-profile' as never);
    } catch (err) {
      setError(userFacingMessage(err, 'Could not set up this iPad.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.root, { paddingTop: insets.top + 8, backgroundColor: c.background }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Back">
            <MaterialIcons name="arrow-back" size={20} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[typography.footnote, { color: c.textMuted }]}>{deviceLabel}</Text>
            <Text style={[typography.title2, { color: c.text }]}>Who uses this iPad?</Text>
          </View>
        </View>

        <KeyboardScreen style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={[styles.body, { color: c.textMuted }]}>
            Scan each person’s profile QR. Next time this iPad opens, they’ll pick their face.
          </Text>

          <OrbitButton onPress={() => setScannerOpen(true)}>Scan profile QR</OrbitButton>

          {showTypeCode ? (
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
                onSubmitEditing={() => addCode(code)}
                returnKeyType="done"
              />
              <OrbitButton
                tone="secondary"
                onPress={() => addCode(code)}
                disabled={!code.trim()}
                style={styles.addBtn}>
                Add
              </OrbitButton>
            </View>
          ) : (
            <Pressable onPress={() => setShowTypeCode(true)} accessibilityRole="button">
              <Text style={[styles.link, { color: c.textMuted }]}>Or type a code</Text>
            </Pressable>
          )}

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          {hosted.length > 0 ? (
            <View style={styles.hosted}>
              <Text style={[styles.label, { color: c.textSoft }]}>On this iPad</Text>
              {hosted.map((person) => (
                <View key={person.id} style={styles.hostedRow}>
                  <Text style={styles.hostedEmoji}>{memberDisplayEmoji(person)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.hostedName, { color: c.text }]}>{person.name}</Text>
                    {dataMode === 'mock' ? (
                      <Text style={[styles.hostedCode, { color: c.textMuted }]}>
                        {ensureProfileInviteCode(person)}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => removeHosted(person.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${person.name}`}>
                    <MaterialIcons name="close" size={18} color="#F87171" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.empty, { color: c.textSubtle }]}>
              No one yet. Scan a Sidekick’s QR to add them.
            </Text>
          )}

          <OrbitButton disabled={busy || hosted.length === 0} onPress={() => void finish()}>
            {busy ? 'Saving…' : hosted.length === 1 ? `Continue as ${hosted[0].name}` : 'Choose who starts'}
          </OrbitButton>

          {naming ? (
            <TextInput
              value={deviceLabel}
              onChangeText={setDeviceLabel}
              placeholder={DEFAULT_SHARED_IPAD_NAME}
              placeholderTextColor={c.textSubtle}
              accessibilityLabel="iPad name"
              style={[styles.input, { color: c.text }]}
            />
          ) : (
            <Pressable onPress={() => setNaming(true)} accessibilityRole="button">
              <Text style={[styles.link, { color: c.textSubtle }]}>Name this iPad</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              Alert.alert('Use as a personal phone?', 'This iPad will stop asking who is using it.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Use as personal',
                  onPress: () => {
                    void clearDeviceSession().then(() => router.replace('/(tabs)' as never));
                  },
                },
              ]);
            }}
            accessibilityRole="button">
            <Text style={[styles.link, { color: c.textSubtle, textAlign: 'center' }]}>
              This is my personal phone
            </Text>
          </Pressable>
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
  scroll: { flex: 1 },
  content: {
    gap: space.md,
    paddingBottom: 48,
    paddingHorizontal: space.xl,
  },
  body: { fontSize: 16, lineHeight: 22 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
  codeRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  codeInput: { flex: 1 },
  addBtn: { minWidth: 72 },
  error: { color: '#F87171', fontSize: 14, lineHeight: 20 },
  empty: { fontSize: 15, lineHeight: 21 },
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
  hostedEmoji: { fontSize: 28 },
  hostedName: { fontSize: 16, fontWeight: '700' },
  hostedCode: { fontSize: 12, marginTop: 2 },
  link: { fontSize: 15, fontWeight: '600', paddingVertical: 8 },
});

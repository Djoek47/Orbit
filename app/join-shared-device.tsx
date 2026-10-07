/**
 * Shared-device invite redeem — tablet scans admin's QR, then hosts the faces.
 * Distinct from Sidekick join-profile (single CMX code).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { FrostedPanel } from '@/components/orbit/frosted-panel';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { SettingsModalChrome } from '@/components/orbit/settings/modal-chrome';
import { userFacingMessage } from '@/lib/auth/auth-errors';
import { memberDisplayEmoji, isAvatarImageUri } from '@/lib/game-levels';
import {
  buildSharedDeviceInviteLink,
  parseSharedDeviceInvitePayload,
} from '@/lib/household/shared-device-invite';
import { resolveMemberByProfileCode } from '@/lib/household/profile-codes';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';

export default function JoinSharedDeviceScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ payload?: string; label?: string; codes?: string }>();
  const { connectSharedTabletProfiles, household, accentTheme } = useOrbit();
  const { c, isDark, glassBorder } = useOrbitColors();
  const accent = accentTheme.primary;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const invite = useMemo(() => {
    const rawPayload = Array.isArray(params.payload) ? params.payload[0] : params.payload;
    if (rawPayload?.trim()) {
      return parseSharedDeviceInvitePayload(rawPayload);
    }
    const label = Array.isArray(params.label) ? params.label[0] : params.label;
    const codesRaw = Array.isArray(params.codes) ? params.codes[0] : params.codes;
    if (!codesRaw?.trim()) return null;
    return parseSharedDeviceInvitePayload(
      buildSharedDeviceInviteLink({
        label: label?.trim() || 'Shared device',
        codes: codesRaw.split(','),
      })
    );
  }, [params.codes, params.label, params.payload]);

  const people = useMemo(() => {
    if (!invite) return [];
    return invite.codes
      .map((code) => resolveMemberByProfileCode(code, household.members))
      .filter((m): m is HouseholdMember => Boolean(m));
  }, [household.members, invite]);

  useEffect(() => {
    if (!invite) setError('This shared-device invite looks broken. Ask an admin for a new QR code.');
  }, [invite]);

  const accept = async () => {
    if (!invite) return;
    try {
      setBusy(true);
      setError('');
      const result = await connectSharedTabletProfiles(invite.codes, invite.label);
      if (result.needsProfilePick) {
        router.replace('/select-profile' as never);
        return;
      }
      router.replace('/(tabs)' as never);
    } catch (err) {
      setError(userFacingMessage(err, 'Could not set up this shared device.'));
    } finally {
      setBusy(false);
    }
  };

  const householdLabel = household.householdName?.trim() || 'the household';
  const deviceLabel = invite?.label?.trim() || 'Shared device';

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Join shared device' }} />
      <SettingsModalChrome
        backLabel="Back"
        title="Join shared device"
        purpose="Everyone on this code will be able to use the tablet. It is not a personal sign-in.">
        <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={[styles.eyebrow, { color: accent }]}>Join shared device</Text>
          <Text style={[styles.hero, { color: isDark ? '#F7F2EC' : c.text }]}>
            Join {householdLabel}
          </Text>
          <Text style={[styles.sub, { color: c.textMuted }]}>
            You&apos;re setting up <Text style={{ fontWeight: '800', color: c.text }}>{deviceLabel}</Text>
            . Everyone below will share this tablet — Switch to change who&apos;s on.
          </Text>

          <FrostedPanel borderColor={`${accent}44`} style={styles.card}>
            <LinearGradient
              colors={[`${accent}28`, `${accent}08`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <Text style={[styles.cardLabel, { color: accent }]}>Who can use it</Text>
            {people.length > 0 ? (
              <View style={styles.faces}>
                {people.map((person) => (
                  <View
                    key={person.id}
                    style={[
                      styles.face,
                      {
                        backgroundColor: glassFill(isDark),
                        borderColor: glassBorder(0.12),
                      },
                    ]}>
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
            ) : invite ? (
              <View style={styles.codeList}>
                {invite.codes.map((code) => (
                  <Text key={code} style={[styles.codeChip, { color: c.textSoft }]}>
                    {code}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={[styles.sub, { color: c.textSubtle }]}>Waiting for a valid invite…</Text>
            )}
            <Text style={[styles.hint, { color: c.textSubtle }]}>
              {invite
                ? `${invite.codes.length} profile${invite.codes.length === 1 ? '' : 's'} on this QR code`
                : 'Ask an admin to open Shared devices and show the code'}
            </Text>
          </FrostedPanel>

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <OrbitButton onPress={() => void accept()} disabled={busy || !invite}>
            {busy
              ? 'Joining…'
              : people.length > 1
                ? `Accept · ${people.length} people`
                : 'Accept · Join household'}
          </OrbitButton>
          <Text style={[styles.footnote, { color: c.textSubtle }]}>
            Personal Sidekick phones use a single profile code. This QR code is for the shared tablet only.
          </Text>
        </View>
      </SettingsModalChrome>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  hero: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  sub: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  card: { gap: 12, overflow: 'hidden', padding: 16 },
  cardLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  faces: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  face: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: 96,
  },
  faceName: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  codeList: { gap: 6 },
  codeChip: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  hint: { fontSize: 12, fontWeight: '600' },
  error: { color: '#F87171', fontSize: 14, fontWeight: '600' },
  footnote: { fontSize: 12, fontWeight: '600', lineHeight: 18, textAlign: 'center' },
});

/**
 * Shared-device invite redeem — tablet scans admin's QR, then hosts the faces.
 * Same accept pattern as Sidekick join-profile, but multi-code.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
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
  const { connectSharedTabletProfiles, household } = useOrbit();
  const { c, isDark, glassBorder } = useOrbitColors();
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
    if (!invite) setError('This shared-device invite looks broken. Ask an admin for a new QR.');
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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsModalChrome
        backLabel="Back"
        title={invite?.label || 'Shared device'}
        purpose="Accept this tablet invite">
        <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
          <View
            style={[
              styles.card,
              { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
            ]}>
            <Text style={[styles.title, { color: c.text }]}>Set up this tablet</Text>
            <Text style={[styles.sub, { color: c.textMuted }]}>
              {invite
                ? `${invite.codes.length} face${invite.codes.length === 1 ? '' : 's'} will share ${invite.label}. Tap Accept, then pick who you are.`
                : 'Waiting for a valid invite…'}
            </Text>

            {people.length > 0 ? (
              <View style={styles.faces}>
                {people.map((person) => (
                  <View key={person.id} style={styles.face}>
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
              <Text style={[styles.sub, { color: c.textSubtle }]}>
                Codes: {invite.codes.join(', ')}
              </Text>
            ) : null}
          </View>

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <OrbitButton onPress={() => void accept()} disabled={busy || !invite}>
            {busy ? 'Setting up…' : 'Accept shared device'}
          </OrbitButton>
        </View>
      </SettingsModalChrome>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  card: { borderRadius: 20, borderWidth: 1, gap: 12, padding: 16 },
  title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.3 },
  sub: { fontSize: 14, lineHeight: 20 },
  faces: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  face: { alignItems: 'center', gap: 6, width: 72 },
  faceName: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  error: { color: '#F87171', fontSize: 14 },
});

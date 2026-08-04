import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors } from '@/constants/orbit-theme';
import { normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

export default function JoinHouseholdScreen() {
  const { joinHousehold } = useOrbit();
  const { c } = useOrbitColors();
  const [inviteCode, setInviteCode] = useState('CMX-7429');
  const [error, setError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleJoinHousehold = async (code = inviteCode) => {
    const parsed = parseInvitePayload(code) ?? (code.trim() ? normalizeInviteCode(code) : null);
    if (!parsed) {
      setError('Enter or scan a valid invite code.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      setInviteCode(parsed);
      await joinHousehold({ inviteCode: parsed });
      router.replace('/' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join household.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AuthShell
        showBack
        kicker="Join a household"
        title="Invite code"
        subtitle="Scan a QR or enter an invite code. Access stays pending until an owner or admin approves you.">
        <OrbitButton onPress={() => setScannerOpen(true)}>Scan invite QR</OrbitButton>
        <OrbitInput
          autoCapitalize="characters"
          label="Invite code"
          value={inviteCode}
          onChangeText={setInviteCode}
        />
        <Text style={[styles.hint, { color: c.textSubtle }]}>
          Demo code: CMX-7429 — or scan a household QR from an invite.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <OrbitButton disabled={busy} onPress={() => void handleJoinHousehold()}>
          {busy ? 'Joining…' : 'Join household'}
        </OrbitButton>
      </AuthShell>

      <InviteQrScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={(code) => {
          setInviteCode(code);
          void handleJoinHousehold(code);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  error: {
    color: orbitColors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
  },
});

import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import { useOrbit } from '@/store/orbit-store';

export default function JoinHouseholdScreen() {
  const { joinHousehold } = useOrbit();
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
      <ScrollView
        style={orbitScreen.container}
        contentContainerStyle={orbitScreen.content}
        contentInsetAdjustmentBehavior="automatic">
        <View style={orbitScreen.header}>
          <Text style={orbitTypography.caption}>Join a household</Text>
          <Text style={orbitTypography.display}>Invite code</Text>
          <Text style={orbitTypography.body}>
            Scan a QR or enter an invite code. Access stays pending until an owner or admin approves you.
          </Text>
        </View>

        <GlassCard elevated style={styles.form}>
          <StatusPill label="Pending role: Adult" tone="amber" />
          <OrbitButton onPress={() => setScannerOpen(true)}>Scan invite QR</OrbitButton>
          <OrbitInput
            autoCapitalize="characters"
            label="Invite code"
            value={inviteCode}
            onChangeText={setInviteCode}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <OrbitButton disabled={busy} onPress={() => handleJoinHousehold()}>
            {busy ? 'Joining…' : 'Join Household'}
          </OrbitButton>
        </GlassCard>
      </ScrollView>

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
  form: {
    gap: orbitSpacing.md,
  },
});

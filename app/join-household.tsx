import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { consumeInviteCode, peekInviteCode } from '@/lib/invite/invite-code-store';
import { useOrbit } from '@/store/orbit-store';

export default function JoinHouseholdScreen() {
  const { joinHousehold } = useOrbit();
  const params = useLocalSearchParams<{ code?: string }>();
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    async function loadCode() {
      const fromParams = typeof params.code === 'string' ? params.code : '';
      const fromStash = (await peekInviteCode()) ?? '';
      const next = (fromParams || fromStash || 'ORBIT-7429').trim().toUpperCase();
      setInviteCode(next);
    }
    loadCode().catch(() => undefined);
  }, [params.code]);

  const handleJoinHousehold = async () => {
    if (!inviteCode.trim()) {
      setError('Enter an invite code to continue.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await joinHousehold({ inviteCode });
      await consumeInviteCode();
      router.replace('/pending-approval' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Join failed. Check the code and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Join a household</Text>
        <Text style={orbitTypography.display}>Invite code</Text>
        <Text style={orbitTypography.body}>
          Scan a QR code or enter an invite code. Your access stays pending until an owner or admin approves you.
        </Text>
      </View>

      <GlassCard elevated style={styles.form}>
        <StatusPill label="Pending role: Adult" tone="amber" />
        {scanning ? (
          <InviteQrScanner
            onCode={(code) => {
              setInviteCode(code);
              setScanning(false);
            }}
            onClose={() => setScanning(false)}
          />
        ) : (
          <OrbitButton tone="secondary" onPress={() => setScanning(true)}>
            Scan QR code
          </OrbitButton>
        )}
        <OrbitInput label="Invite code" value={inviteCode} onChangeText={setInviteCode} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <OrbitButton disabled={busy} onPress={handleJoinHousehold}>
          {busy ? 'Joining…' : 'Join Household'}
        </OrbitButton>
      </GlassCard>
    </ScrollView>
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

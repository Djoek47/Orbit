import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors } from '@/constants/orbit-theme';
import { consumeInviteCode, peekInviteCode } from '@/lib/invite/invite-code-store';
import { useOrbit } from '@/store/orbit-store';

export default function JoinHouseholdScreen() {
  const { accentTheme, joinHousehold } = useOrbit();
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
    <AuthShell
      showBack
      kicker="Join a household"
      title="Invite code"
      subtitle="Scan a QR code or enter an invite. Access stays pending until an owner or admin approves you.">
      <View style={styles.pill}>
        <Text style={styles.pillText}>Pending role: Adult</Text>
      </View>

      {scanning ? (
        <View style={styles.scanner}>
          <InviteQrScanner
            onCode={(code) => {
              setInviteCode(code);
              setScanning(false);
            }}
            onClose={() => setScanning(false)}
          />
        </View>
      ) : (
        <Pressable onPress={() => setScanning(true)} style={styles.scanBtn}>
          <MaterialIcons name="qr-code-scanner" size={18} color={orbitColors.novaCyan} />
          <Text style={styles.scanText}>Scan QR code</Text>
        </Pressable>
      )}

      <OrbitInput
        autoCapitalize="characters"
        label="Invite code"
        value={inviteCode}
        onChangeText={(value) => setInviteCode(value.toUpperCase())}
        placeholder="ORBIT-7429"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={() => void handleJoinHousehold()} disabled={busy} style={styles.ctaWrap}>
        <LinearGradient
          colors={[accentTheme.primary, accentTheme.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cta}>
          <Text style={styles.ctaText}>{busy ? 'Joining…' : 'Join household'}</Text>
        </LinearGradient>
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(251,146,60,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { color: orbitColors.warning, fontSize: 12, fontWeight: '700' },
  scanner: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.35)',
    backgroundColor: 'rgba(6,182,212,0.1)',
    paddingVertical: 13,
  },
  scanText: { color: orbitColors.novaCyan, fontSize: 14, fontWeight: '700' },
  error: { color: orbitColors.danger, fontSize: 13, fontWeight: '700' },
  ctaWrap: { borderRadius: 18, overflow: 'hidden', marginTop: 4 },
  cta: { alignItems: 'center', paddingVertical: 15 },
  ctaText: { color: '#070D1C', fontSize: 15, fontWeight: '800' },
});

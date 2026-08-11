import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors } from '@/constants/orbit-theme';
import { consumeInviteCode, peekInviteCode } from '@/lib/invite/invite-code-store';
import { normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

export default function JoinHouseholdScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { joinHousehold } = useOrbit();
  const { c } = useOrbitColors();
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const autoJoinCode = useRef<string | null>(null);

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
      await consumeInviteCode();
      await joinHousehold({ inviteCode: parsed });
      router.replace('/' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join household.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fromParam =
        typeof params.code === 'string' && params.code.trim()
          ? parseInvitePayload(params.code) ?? normalizeInviteCode(params.code)
          : null;
      const fromStash = fromParam ? null : await peekInviteCode();
      const next = fromParam || (fromStash ? normalizeInviteCode(fromStash) : '');
      if (cancelled || !next) return;
      setInviteCode(next);
      // AirDrop / universal link: join immediately once (not when user types manually).
      if (!autoJoinCode.current) {
        autoJoinCode.current = next;
        void handleJoinHousehold(next);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / param hydrate only
  }, [params.code]);

  return (
    <>
      <AuthShell
        showBack
        brandHero
        kicker="Join a household"
        title="Invite code"
        subtitle="AirDrop, QR, or paste a code. You’ll land in the household once an owner or admin approves (if required).">
        <OrbitButton onPress={() => setScannerOpen(true)}>Scan invite QR</OrbitButton>
        <OrbitInput
          autoCapitalize="characters"
          label="Invite code"
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="CMX-1234"
        />
        <Text style={[styles.hint, { color: c.textSubtle }]}>
          Tip: on iPhone, AirDrop the invite from Settings → Members → Share household invite.
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

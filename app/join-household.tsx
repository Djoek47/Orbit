import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { AuthShell } from '@/components/orbit/auth-shell';
import { InviteQrScanner } from '@/components/orbit/invite-qr-scanner';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { typography } from '@/constants/orbit-theme';
import { consumeInviteCode, peekInviteCode } from '@/lib/invite/invite-code-store';
import { normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

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
      setError('Enter a valid invite code.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      setInviteCode(parsed);
      await consumeInviteCode();
      const outcome = await joinHousehold({ inviteCode: parsed });
      router.replace((outcome === 'pending' ? '/pending-approval' : '/') as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t join.');
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
        kicker="Join"
        title="Enter code"
        subtitle="Paste a code, or scan the household QR.">
        <OrbitInput
          autoCapitalize="characters"
          label="Invite code"
          value={inviteCode}
          onChangeText={(value) => {
            setInviteCode(value);
            setError('');
          }}
          placeholder="CMX-0000"
        />

        {error ? (
          <Text style={[typography.footnote, styles.error, { color: c.danger }]}>{error}</Text>
        ) : null}

        <OrbitButton disabled={busy} onPress={() => void handleJoinHousehold()}>
          {busy ? 'Joining…' : 'Continue'}
        </OrbitButton>

        <OrbitButton tone="secondary" onPress={() => setScannerOpen(true)}>
          Scan QR
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
    textAlign: 'center',
  },
});

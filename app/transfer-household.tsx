/**
 * Owner: generate a 15-minute ownership transfer QR.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { ProfileQrCard } from '@/components/orbit/members/profile-qr-card';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import { radius, space, typography } from '@/constants/orbit-theme';
import { isMockMode } from '@/repositories/repository-utils';
import { canGenerateHouseholdTransfer, formatTransferCountdown } from '@/lib/household/household-transfer';
import { createHouseholdTransferToken } from '@/lib/household/send-household-transfer';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

type ActiveTransfer = {
  token: string;
  expiresAt: string;
  householdName: string;
  shareLink: string;
  webLink: string;
};

export default function TransferHouseholdScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const { accentTheme, currentMember, currentUser, household } = useOrbit();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveTransfer | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const canGenerate = canGenerateHouseholdTransfer({
    role: currentMember?.role,
    householdName: household.householdName,
    deletionScheduledFor: household.deletionScheduledFor,
  });

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const mint = useCallback(() => {
    if (!household.id || !currentUser?.id || busy) return;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const result = await createHouseholdTransferToken({
          householdId: household.id!,
          householdName: household.householdName,
          userId: currentUser.id,
          mock: isMockMode(),
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setActive({
          token: result.token,
          expiresAt: result.expiresAt,
          householdName: result.householdName,
          shareLink: result.shareLink,
          webLink: result.webLink,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create transfer QR.');
      } finally {
        setBusy(false);
      }
    })();
  }, [busy, currentUser?.id, household.householdName, household.id]);

  useEffect(() => {
    if (canGenerate && !active && !busy && !error) {
      mint();
    }
    // Initial mint once when eligible
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGenerate]);

  if (!canGenerate) {
    return (
      <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <Text style={[typography.title2, { color: c.text, textAlign: 'center' }]}>
            Owner only
          </Text>
          <Text style={[typography.body, { color: c.textMuted, textAlign: 'center' }]}>
            Only the household owner can transfer ownership — and the household must not be
            scheduled for deletion.
          </Text>
          <OrbitButton onPress={() => router.back()}>Go back</OrbitButton>
        </View>
      </View>
    );
  }

  const expired = active
    ? new Date(active.expiresAt).getTime() <= nowTick
    : false;
  const countdown = active ? formatTransferCountdown(active.expiresAt, new Date(nowTick)) : '—';

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <MaterialIcons name="chevron-left" size={22} color={accentTheme.primary} />
          <Text style={[styles.backText, { color: accentTheme.primary }]}>Close</Text>
        </Pressable>
      </View>

      <KeyboardScreen
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, space.xl) + space.lg },
        ]}>
        <Animated.View entering={FadeIn.duration(280)} style={styles.section}>
          <Text style={[typography.title2, { color: c.text, fontWeight: '700', textAlign: 'center' }]}>
            Transfer ownership
          </Text>
          <Text style={[typography.body, styles.lead, { color: c.textMuted }]}>
            Scan on an empty Choremaxx account (new, or only a household already scheduled for
            deletion). You become a regular member — they become the owner. QR expires in 15
            minutes.
          </Text>
        </Animated.View>

        {active && !expired ? (
          <View
            style={[
              styles.timerCard,
              { backgroundColor: glass(0.05), borderColor: `${accentTheme.primary}44` },
            ]}>
            <MaterialIcons name="timer" size={18} color={accentTheme.primary} />
            <Text style={[styles.timerText, { color: c.text }]}>Expires in {countdown}</Text>
          </View>
        ) : null}

        {active && !expired ? (
          <ProfileQrCard
            qrValue={active.shareLink}
            displayCode={active.token.slice(0, 8).toUpperCase()}
            caption={`Have them open Choremaxx → scan this QR, or open the link on an empty account.`}
            shareLabel="Share transfer link"
            onShare={async () => {
              await Share.share({
                message: `Take ownership of ${active.householdName} on Choremaxx: ${active.shareLink}`,
                url: active.shareLink,
              });
            }}
            onRegenerate={() => mint()}
            regenerateLabel="New QR"
            regenerating={busy}
          />
        ) : (
          <View style={styles.section}>
            {expired ? (
              <Text style={[typography.body, { color: c.warning ?? '#FBBF24', textAlign: 'center' }]}>
                This QR expired.
              </Text>
            ) : null}
            <OrbitButton disabled={busy} onPress={mint}>
              {busy ? 'Creating…' : 'Generate transfer QR'}
            </OrbitButton>
          </View>
        )}

        {active && !expired ? (
          <Pressable
            onPress={() => {
              void Clipboard.setStringAsync(active.shareLink).then(() => {
                orbitAlert('Copied', 'Transfer link copied to clipboard.');
              });
            }}
            style={[styles.copyRow, { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) }]}>
            <MaterialIcons name="content-copy" size={18} color={accentTheme.primary} />
            <Text style={[styles.copyText, { color: c.text }]}>Copy link</Text>
          </Pressable>
        ) : null}

        {error ? (
          <Text style={[styles.error, { color: c.danger ?? '#F87171' }]}>{error}</Text>
        ) : null}
      </KeyboardScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { paddingHorizontal: space.md, paddingTop: space.sm },
  back: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 2 },
  backText: { fontSize: 16, fontWeight: '600' },
  content: {
    flexGrow: 1,
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },
  section: { gap: space.sm },
  lead: { lineHeight: 22, textAlign: 'center' },
  timerCard: {
    alignItems: 'center',
    alignSelf: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  timerText: { fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '700' },
  copyRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  copyText: { fontSize: 15, fontWeight: '700' },
  error: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: space.md,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
});

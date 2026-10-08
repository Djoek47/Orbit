/**
 * Owner: generate a 15-minute ownership transfer QR.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { ProfileQrCard } from '@/components/orbit/members/profile-qr-card';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import { SettingsGroup, SettingsNavRow } from '@/components/orbit/settings/grouped';
import { radius, space, typography } from '@/constants/orbit-theme';
import { isMockMode } from '@/repositories/repository-utils';
import { canGenerateHouseholdTransfer, formatTransferCountdown } from '@/lib/household/household-transfer';
import { createHouseholdTransferToken } from '@/lib/household/send-household-transfer';
import { showNativeAppError } from '@/lib/errors/show-native-app-error';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

const TONE = '#38BDF8';

type ActiveTransfer = {
  token: string;
  expiresAt: string;
  householdName: string;
  shareLink: string;
  webLink: string;
};

export default function TransferHouseholdScreen() {
  const insets = useSafeAreaInsets();
  const { c, glassBorder, isDark } = useOrbitColors();
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
          void showNativeAppError('Couldn’t create transfer QR code', result.error, {
            source: 'transfer-household-create',
            category: 'settings',
          });
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
        const message = err instanceof Error ? err.message : 'Could not create transfer QR code.';
        setError(message);
        void showNativeAppError('Couldn’t create transfer QR code', err, {
          source: 'transfer-household-create',
          category: 'settings',
        });
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
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: glassFill(isDark), borderColor: `${TONE}44` },
            ]}>
            <Text style={[typography.title2, { color: c.text, textAlign: 'center' }]}>
              Owner only
            </Text>
            <Text style={[typography.body, { color: c.textMuted, textAlign: 'center', lineHeight: 22 }]}>
              Only the household owner can transfer ownership — and the household must not be
              scheduled for deletion.
            </Text>
            <OrbitButton onPress={() => router.back()}>Go back</OrbitButton>
          </View>
        </View>
      </View>
    );
  }

  const expired = active ? new Date(active.expiresAt).getTime() <= nowTick : false;
  const countdown = active ? formatTransferCountdown(active.expiresAt, new Date(nowTick)) : '—';
  const houseLabel = household.householdName.trim() || 'Household';

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
        <Animated.View entering={FadeInDown.duration(260)}>
          <LinearGradient
            colors={[`${TONE}3D`, `${TONE}0F`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { borderColor: `${TONE}55` }]}>
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <Text style={[styles.heroEyebrow, { color: TONE }]}>Transfer</Text>
              <Text style={[styles.heroTitle, { color: c.text }]} numberOfLines={2}>
                {houseLabel}
              </Text>
              <Text style={[styles.heroValue, { color: c.text }]}>
                {active && !expired ? countdown : expired ? 'Expired' : '15:00'}
              </Text>
              <Text style={[styles.heroSub, { color: c.textMuted }]}>
                {active && !expired
                  ? 'QR code live · empty or new account only'
                  : 'Scan on an empty Choremaxx account. You become a member; they become owner.'}
              </Text>
            </View>
            <View style={[styles.heroMoji, { backgroundColor: `${TONE}2E` }]}>
              <MaterialIcons name="qr-code-2" size={32} color={TONE} />
            </View>
          </LinearGradient>
        </Animated.View>

        {active && !expired ? (
          <Animated.View entering={FadeIn.duration(280)} style={styles.stack}>
            <ProfileQrCard
              qrValue={active.shareLink}
              displayCode={active.token.slice(0, 8).toUpperCase()}
              caption="Have them open Choremaxx and scan this code, or open the link on an empty account."
              shareLabel="Share transfer link"
              onShare={async () => {
                await Share.share({
                  message: `Take ownership of ${active.householdName} on Choremaxx: ${active.shareLink}`,
                  url: active.shareLink,
                });
              }}
              onRegenerate={() => mint()}
              regenerateLabel="New QR code"
              regenerating={busy}
            />

            <SettingsGroup header="Link">
              <SettingsNavRow
                icon="content-copy"
                iconColor={TONE}
                label="Copy link"
                subtitle="Paste into Messages or Notes"
                last
                onPress={() => {
                  void Clipboard.setStringAsync(active.shareLink).then(() => {
                    orbitAlert('Copied', 'Transfer link copied to clipboard.');
                  });
                }}
              />
            </SettingsGroup>
          </Animated.View>
        ) : (
          <View style={styles.stack}>
            {expired ? (
              <Text style={[typography.body, { color: '#FBBF24', textAlign: 'center' }]}>
                This QR code expired.
              </Text>
            ) : null}
            <OrbitButton disabled={busy} onPress={mint}>
              {busy ? 'Creating…' : 'Generate transfer QR code'}
            </OrbitButton>
          </View>
        )}

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
  stack: { gap: space.md },
  hero: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  heroValue: {
    fontSize: 36,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 40,
    marginTop: 4,
  },
  heroSub: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  heroMoji: {
    alignItems: 'center',
    borderRadius: 24,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  error: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  emptyCard: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: 1,
    gap: space.md,
    padding: space.lg,
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: space.md,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
});

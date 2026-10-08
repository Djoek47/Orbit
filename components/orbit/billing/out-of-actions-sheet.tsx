/**
 * Poppins is out of actions — for a household that already pays.
 *
 *   ┌ blurred Poppins behind ─────────────────┐
 *   │ ┌───────── glass ─────────────────────┐ │
 *   │ │            ( empty orb )            │ │
 *   │ │      You're out of actions          │ │
 *   │ │  Your 300 come back on Nov 1, or    │ │
 *   │ │  top up now. Bought actions never   │ │
 *   │ │  expire.                            │ │
 *   │ │  [ 200 · $1.99 ] [ 700 ] [ 2000 ]   │ │
 *   │ │               Not now               │ │
 *   │ └─────────────────────────────────────┘ │
 *   └─────────────────────────────────────────┘
 *
 * Buying fills the orb and counts the balance up in front of the person, then confirms that the
 * receipt went to their inbox. Only shown to admins on a paid household; a trial is sold the
 * subscription instead (see PoppinsTrialLock).
 */
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { PoppinsOrb } from '@/components/orbit/poppins-orb';
import { TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import { buyCreditPack } from '@/lib/billing/buy-credit-pack';
import { formatResetDate } from '@/lib/billing/credit-ledger';
import {
  fetchStorePrices,
  isUserCancelledPurchase,
  type IapTokenPackKey,
  type StorePrice,
} from '@/lib/billing/iap';
import { formatPrice, topUpPacks } from '@/lib/billing/topup-receipt';
import { friendlyErrorMessage } from '@/lib/errors/friendly-error';
import { formatUnknownError } from '@/lib/errors/unknown-error';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

/** A number that counts up to its target instead of jumping. */
function useCountUp(target: number, ms = 900): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = Date.now();
    const begin = from.current;
    if (begin === target) return;
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(begin + (target - begin) * eased));
      if (t >= 1) {
        clearInterval(timer);
        from.current = target;
      }
    }, 30);
    return () => clearInterval(timer);
  }, [target, ms]);
  return shown;
}

type Props = {
  visible: boolean;
  balance: number;
  onClose: () => void;
  /** On a trial there is no monthly allowance coming back — say so. */
  onTrial?: boolean;
};

export function OutOfActionsSheet({ visible, balance, onClose, onTrial }: Props) {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const { household, accentTheme, currentMember, currentUser } = useOrbit();
  const [prices, setPrices] = useState<Record<string, StorePrice>>({});
  const [buying, setBuying] = useState<IapTokenPackKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ tokens: number; mail: string } | null>(null);
  const [fill, setFill] = useState(0);
  const [shownTarget, setShownTarget] = useState(balance);
  const count = useCountUp(shownTarget);
  const packs = topUpPacks();

  useEffect(() => {
    if (!visible) return;
    setDone(null);
    setError(null);
    setFill(0);
    setShownTarget(balance);
    void fetchStorePrices().then(setPrices);
    // Only on opening — a later balance change is the purchase, animated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const priceOf = (productId: string, usd: number) => prices[productId]?.display ?? formatPrice(usd);

  const buy = async (key: IapTokenPackKey, productId: string, usd: number) => {
    if (buying || !household.id) return;
    setBuying(key);
    setError(null);
    try {
      const bought = await buyCreditPack({
        packKey: key,
        householdId: household.id,
        householdName: household.householdName,
        priceLabel: priceOf(productId, usd),
        email: currentUser?.email,
        name: currentMember?.name ?? currentUser?.name,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // The refill: water rises, the number counts up.
      setFill(1);
      setShownTarget((n) => n + bought.grant.tokens);
      setDone({ tokens: bought.grant.tokens, mail: 'Sending your receipt…' });
      void bought.mailed.then((m) =>
        setDone((d) =>
          d ? { ...d, mail: m.ok ? `Receipt sent to ${m.to}` : 'Receipt saved in Poppins credits' } : d
        )
      );
    } catch (err) {
      if (!isUserCancelledPurchase(err)) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(friendlyErrorMessage(formatUnknownError(err, 'That didn’t go through.')));
      }
    } finally {
      setBuying(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <Pressable style={[StyleSheet.absoluteFill, styles.scrim]} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.center, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} pointerEvents="box-none">
        <Animated.View
          entering={FadeInDown.duration(380)}
          style={[styles.card, { backgroundColor: glass(isDark ? 0.1 : 0.7), borderColor: glassBorder(0.2) }]}>
          <View style={styles.orb}>
            <PoppinsOrb size={120} dailyFill={fill} monthGlow={fill} accent={accentTheme.primary} state={done ? 'success' : 'idle'} />
          </View>

          <Text style={[styles.count, { color: c.text }]}>{count.toLocaleString()}</Text>
          <Text style={[styles.countLabel, { color: c.textMuted }]}>actions available</Text>

          {done ? (
            <Animated.View entering={ZoomIn.duration(320)} style={styles.copy}>
              <Text style={[styles.title, { color: c.text }]}>
                {done.tokens.toLocaleString()} actions added
              </Text>
              <Text style={[styles.body, { color: c.textMuted }]}>{done.mail}</Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                style={({ pressed }) => [styles.primary, { backgroundColor: accentTheme.primary, opacity: pressed ? 0.85 : 1 }]}>
                <Text style={styles.primaryText}>Back to Poppins</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(300)} style={styles.copy}>
              <Text style={[styles.title, { color: c.text }]}>You&apos;re out of actions</Text>
              <Text style={[styles.body, { color: c.textMuted }]}>
                {onTrial
                  ? `Your bought actions are used up. Top up to keep going, or subscribe for ${TOKENS_PER_MONTH} every month.`
                  : `Your ${TOKENS_PER_MONTH} come back on ${formatResetDate()}. Top up now to keep going — bought actions never expire.`}
              </Text>
              <View style={styles.packs}>
                {packs.map((pack) => (
                  <Pressable
                    key={pack.key}
                    disabled={buying != null}
                    onPress={() => void buy(pack.key, pack.productId, pack.priceUsd)}
                    accessibilityRole="button"
                    accessibilityLabel={`Buy ${pack.tokens} actions for ${priceOf(pack.productId, pack.priceUsd)}`}
                    style={({ pressed }) => [
                      styles.pack,
                      {
                        backgroundColor: glass(0.08),
                        borderColor: pack.best ? accentTheme.primary : glassBorder(0.16),
                        opacity: pressed ? 0.8 : buying && buying !== pack.key ? 0.5 : 1,
                      },
                    ]}>
                    {pack.best ? (
                      <Text style={[styles.best, { color: accentTheme.primary }]}>BEST VALUE</Text>
                    ) : null}
                    <Text style={[styles.packTokens, { color: c.text }]}>{pack.tokens.toLocaleString()}</Text>
                    <Text style={[styles.packLabel, { color: c.textMuted }]}>actions</Text>
                    {buying === pack.key ? (
                      <ActivityIndicator color={accentTheme.primary} style={{ marginTop: 6 }} />
                    ) : (
                      <Text style={[styles.packPrice, { color: accentTheme.primary }]}>
                        {priceOf(pack.productId, pack.priceUsd)}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
              {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
              <Pressable onPress={onClose} hitSlop={10} style={styles.later} accessibilityRole="button">
                <Text style={[styles.laterText, { color: c.textMuted }]}>Not now</Text>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(0,0,0,0.25)' },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 18 },
  card: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 30,
    borderWidth: 1,
    maxWidth: 440,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 24,
    width: '100%',
  },
  orb: { marginBottom: 6 },
  count: { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  countLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  copy: { alignItems: 'center', alignSelf: 'stretch', gap: 10 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  packs: { alignSelf: 'stretch', flexDirection: 'row', gap: 8, marginTop: 6 },
  pack: { alignItems: 'center', borderRadius: 18, borderWidth: 1, flex: 1, paddingVertical: 12 },
  best: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  packTokens: { fontSize: 22, fontWeight: '800' },
  packLabel: { fontSize: 12 },
  packPrice: { fontSize: 15, fontWeight: '800', marginTop: 6 },
  error: { fontSize: 13.5, textAlign: 'center' },
  later: { minHeight: 40, justifyContent: 'center' },
  laterText: { fontSize: 15, fontWeight: '600' },
  primary: { alignItems: 'center', alignSelf: 'stretch', borderRadius: 999, minHeight: 50, justifyContent: 'center', marginTop: 6 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

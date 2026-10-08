/**
 * Poppins on a free trial, before any actions have been bought.
 *
 *   ┌──────────────────────────────────┐
 *   │            (quiet orb)           │
 *   │  Poppins runs on actions         │
 *   │  Your trial covers chores, XP    │
 *   │  and rewards. Buy a pack to try  │
 *   │  Poppins now — your 300 monthly  │
 *   │  actions start when the trial    │
 *   │  ends on Oct 14.                 │
 *   │        [ Buy actions ]           │
 *   │   200 actions from $1.99 · never │
 *   │          expire                  │
 *   └──────────────────────────────────┘
 *
 * On a trial this sells the subscription — that is what brings Poppins its monthly actions.
 * Packs stay available from Settings, under Poppins credits, for anyone who goes looking.
 * Earlier note: this is a sale, not a scolding. The trial household has already said yes to ChoreMaxx; the
 * screen explains what Poppins costs and offers the one thing that unlocks it today. It does
 * not offer "subscribe" — they already have, and Apple will start charging on its own when
 * the trial ends. Offering to sell them the thing they bought would be wrong and confusing.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { PoppinsOrb } from '@/components/orbit/poppins-orb';
import { TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import { space } from '@/constants/orbit-theme';
import { useAccess } from '@/lib/billing/access-provider';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

/** Bought actions this household holds. Re-read on focus, so coming back from a purchase unlocks. */
export function useBoughtBalance(): number | null {
  const { household } = useOrbit();
  const [balance, setBalance] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (!household.id) {
          if (!cancelled) setBalance(0);
          return;
        }
        try {
          const { loadTokenGrants, topUpBalanceFromGrants } = await import(
            '@/lib/billing/token-grants'
          );
          const next = topUpBalanceFromGrants(await loadTokenGrants(household.id));
          if (!cancelled) setBalance(next);
        } catch {
          if (!cancelled) setBalance(0);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [household.id])
  );
  return balance;
}

/**
 * The orb's water rising and settling, over and over — a living orb rather than a picture of
 * one. `target` moves the level; PoppinsOrb animates every change itself.
 */
export function useSloshingFill(levels: number[], everyMs = 2400): number {
  const [i, setI] = useState(0);
  useEffect(() => {
    const first = setTimeout(() => setI(1), 120);
    const timer = setInterval(() => setI((n) => n + 1), everyMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [everyMs]);
  return i === 0 ? 0 : levels[(i - 1) % levels.length]!;
}

export function PoppinsTrialLock() {
  const insets = useSafeAreaInsets();
  const { c } = useOrbitColors();
  const { accentTheme } = useOrbit();
  const access = useAccess();
  const fill = useSloshingFill([0.82, 0.62, 0.9, 0.7]);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: c.background,
          // Clear the global header chips above and the tab bar below, then centre between them.
          paddingTop: insets.top + 84,
          paddingBottom: insets.bottom + 110,
        },
      ]}>
      <View style={styles.body}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.orb}>
          <PoppinsOrb size={150} dailyFill={fill} monthGlow={fill} accent={accentTheme.primary} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(420)} style={styles.copy}>
          <Text style={[styles.kicker, { color: accentTheme.primary }]}>Poppins</Text>
          <Text style={[styles.title, { color: c.text }]}>Talk to your house</Text>
          <Text style={[styles.text, { color: c.textMuted }]}>
            Say it once — chores assigned, groceries added, the week planned. Poppins comes with
            your subscription: {TOKENS_PER_MONTH} actions every month, refilled automatically.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(420)} style={styles.actions}>
          <OrbitButton
            onPress={() =>
              router.push({ pathname: '/premium', params: { source: 'poppins' } } as never)
            }>
            Subscribe
          </OrbitButton>
          <Text style={[styles.fine, { color: c.textSubtle }]}>
            Your free trial covers chores, XP and rewards.
          </Text>
          {access.view.trialLabel ? (
            <View style={[styles.chip, { backgroundColor: `${accentTheme.primary}18` }]}>
              <Text style={[styles.chipText, { color: accentTheme.primary }]}>
                Trial · {access.view.trialLabel}
              </Text>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  kicker: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  body: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: space.xl,
    maxWidth: 460,
    paddingHorizontal: space.xl,
    width: '100%',
  },
  orb: { marginBottom: 4 },
  copy: { alignItems: 'center', gap: 10 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  text: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
  actions: { alignItems: 'center', alignSelf: 'stretch', gap: 12 },
  fine: { fontSize: 13, textAlign: 'center' },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontSize: 12.5, fontWeight: '700' },
});

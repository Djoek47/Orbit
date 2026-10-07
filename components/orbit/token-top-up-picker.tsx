/**
 * Token top-up pack picker — same Premium paywall language:
 * light display headline, Bricolage via AppText, Orbit surfaces, one job.
 * Coach-navigate purchase; never HOLD-commit IAP.
 * Disables packs StoreKit does not list for this binary.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { IAP_CONSUMABLES, type IapTokenPackKey } from '@/constants/billing';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  isTokenPackAvailable,
  probeAvailableTokenPacks,
} from '@/lib/billing/iap';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

const PACKS: IapTokenPackKey[] = ['tokensSmall', 'tokensMedium', 'tokensLarge'];

export type TokenTopUpPickerProps = {
  busy?: boolean;
  onSelect: (pack: IapTokenPackKey) => void;
  onDismiss?: () => void;
};

export function TokenTopUpPicker({ busy = false, onSelect, onDismiss }: TokenTopUpPickerProps) {
  const { accentTheme, orbitPalette } = useOrbit();
  const { c } = useOrbitColors();
  const [availablePacks, setAvailablePacks] = useState<IapTokenPackKey[] | null>(null);
  const [probeDone, setProbeDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const listed = await probeAvailableTokenPacks();
      if (cancelled) return;
      setAvailablePacks(listed);
      setProbeDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(420)} style={styles.mark}>
        <ChoremaxxLogo size="md" variant="icon" />
      </Animated.View>

      <View style={styles.hero}>
        <Animated.View entering={FadeInUp.delay(40).duration(480)}>
          <Text style={[styles.headline, { color: c.text }]}>Buy more actions</Text>
          <Text style={[styles.support, { color: c.textMuted }]}>
            Top-ups never expire. Used after this month’s allowance.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(120).duration(480)} style={styles.list}>
          {PACKS.map((key, index) => {
            const pack = IAP_CONSUMABLES[key];
            const lead = index === 1;
            const forSale = isTokenPackAvailable(key, availablePacks);
            const unavailable = probeDone && !forSale;
            return (
              <Pressable
                key={key}
                disabled={busy || unavailable}
                onPress={() => onSelect(key)}
                style={[
                  styles.row,
                  {
                    backgroundColor: lead && !unavailable
                      ? orbitPalette.cardStrong
                      : orbitPalette.cardMuted,
                    borderColor:
                      lead && !unavailable ? `${accentTheme.primary}44` : 'transparent',
                    opacity: busy || unavailable ? 0.45 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy || unavailable }}
                accessibilityLabel={
                  unavailable
                    ? `${pack.label} not for sale on this build yet`
                    : `${pack.tokens} actions for $${pack.priceUsd}`
                }>
                <View style={styles.rowText}>
                  <Text style={[styles.packLabel, { color: c.text }]}>{pack.label}</Text>
                  {unavailable ? (
                    <Text style={[styles.packHint, { color: c.textMuted }]}>
                      Not on this build
                    </Text>
                  ) : lead ? (
                    <Text style={[styles.packHint, { color: accentTheme.primary }]}>
                      Most chosen
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.price, { color: unavailable ? c.textMuted : c.text }]}>
                  {unavailable ? '—' : `$${pack.priceUsd}`}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.delay(200).duration(420)} style={styles.footer}>
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={10} disabled={busy}>
            <Text style={[styles.dismiss, { color: c.textMuted }]}>Not now</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mark: {
    alignItems: 'center',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: space.xxl,
    paddingBottom: space.xl,
  },
  headline: {
    fontSize: 40,
    fontWeight: '300',
    letterSpacing: -1.1,
    lineHeight: 46,
    textAlign: 'center',
  },
  support: {
    ...typography.body,
    lineHeight: 24,
    marginTop: space.sm + 2,
    textAlign: 'center',
    paddingHorizontal: space.sm,
  },
  list: {
    gap: space.sm,
  },
  row: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  rowText: {
    gap: space.xxs,
  },
  packLabel: {
    ...typography.headline,
  },
  packHint: {
    ...typography.footnote,
    fontWeight: '600',
  },
  price: {
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: -0.4,
  },
  footer: {
    gap: space.sm,
    paddingBottom: space.sm,
  },
  dismiss: {
    ...typography.subheadline,
    fontWeight: '500',
    textAlign: 'center',
  },
});

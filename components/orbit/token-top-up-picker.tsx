/**
 * Token top-up pack picker — same Premium paywall language:
 * light display headline, Bricolage via AppText, Orbit surfaces, one job.
 * Coach-navigate purchase; never HOLD-commit IAP.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { IAP_CONSUMABLES, type IapTokenPackKey } from '@/constants/billing';
import { radius, space, typography } from '@/constants/orbit-theme';
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
            return (
              <Pressable
                key={key}
                disabled={busy}
                onPress={() => onSelect(key)}
                style={[
                  styles.row,
                  {
                    backgroundColor: lead ? orbitPalette.cardStrong : orbitPalette.cardMuted,
                    borderColor: lead ? `${accentTheme.primary}44` : 'transparent',
                    opacity: busy ? 0.55 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${pack.tokens} actions for $${pack.priceUsd}`}>
                <View style={styles.rowText}>
                  <Text style={[styles.packLabel, { color: c.text }]}>{pack.label}</Text>
                  {lead ? (
                    <Text style={[styles.packHint, { color: accentTheme.primary }]}>
                      Most chosen
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.price, { color: c.text }]}>${pack.priceUsd}</Text>
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

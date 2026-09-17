/**
 * Token top-up pack picker — Orbit tokens, one job, no nested cards.
 * Coach-navigate purchase; never HOLD-commit IAP.
 * Visual language matches PremiumPaywall (calm hero + flat selectable rows).
 */
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { IAP_CONSUMABLES, type IapTokenPackKey } from '@/constants/billing';
import { motionDuration } from '@/constants/motion-tokens';
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
    <Animated.View entering={FadeInUp.duration(motionDuration.smooth + 60)} style={styles.root}>
      <Text style={[styles.headline, { color: c.text }]}>Buy more actions</Text>
      <Text style={[styles.support, { color: c.textMuted }]}>
        Top-ups never expire. Used after this month’s allowance.
      </Text>

      <View style={styles.list}>
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
                  borderColor: lead ? `${accentTheme.primary}55` : c.border,
                  opacity: busy ? 0.55 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${pack.tokens} actions for $${pack.priceUsd}`}>
              <View style={styles.rowText}>
                <Text style={[styles.packLabel, { color: c.text }]}>{pack.label}</Text>
                {lead ? (
                  <Text style={[styles.packHint, { color: accentTheme.primary }]}>Most chosen</Text>
                ) : null}
              </View>
              <Text style={[styles.price, { color: c.text }]}>${pack.priceUsd}</Text>
            </Pressable>
          );
        })}
      </View>

      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={10} disabled={busy}>
          <Text style={[styles.dismiss, { color: c.textMuted }]}>Not now</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: space.md,
    paddingTop: space.sm,
  },
  headline: {
    ...typography.title1,
    fontWeight: '300',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  support: {
    ...typography.body,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: space.sm,
  },
  list: {
    gap: space.sm,
    marginTop: space.xs,
  },
  row: {
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: 16,
  },
  rowText: {
    gap: 2,
  },
  packLabel: {
    ...typography.headline,
  },
  packHint: {
    ...typography.footnote,
    fontWeight: '600',
  },
  price: {
    ...typography.headline,
    letterSpacing: -0.2,
  },
  dismiss: {
    ...typography.subheadline,
    fontWeight: '500',
    marginTop: space.xs,
    textAlign: 'center',
  },
});

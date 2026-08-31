import * as Linking from 'expo-linking';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import {
  CHOREMAXX_LEGAL,
  CHOREMAXX_TAGLINE,
} from '@/constants/choremaxx-brand';
import { resolveAppVersionLabel } from '@/lib/app-version';
import { orbitColors } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text } from '@/components/orbit/app-text';

type BrandLegalFooterProps = {
  /** Show full lockup above the legal lines. */
  showLogo?: boolean;
  compact?: boolean;
  style?: ViewStyle;
};

/** Shared Choremaxx brand + © / privacy / terms strip for Settings and auth. */
export function BrandLegalFooter({
  showLogo = true,
  compact = false,
  style,
}: BrandLegalFooterProps) {
  const { c } = useOrbitColors();

  const open = (url: string) => {
    void Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View style={[styles.root, compact && styles.compact, style]}>
      {showLogo ? <ChoremaxxLogo size={compact ? 'sm' : 'md'} /> : null}
      {!compact ? (
        <Text style={[styles.meta, { color: c.textMuted }]}>
          Version {resolveAppVersionLabel()} · {CHOREMAXX_TAGLINE}
        </Text>
      ) : null}
      <Text style={[styles.copyright, { color: c.textSubtle }]}>{CHOREMAXX_LEGAL.copyright}</Text>
      <View style={styles.links}>
        <Pressable onPress={() => open(CHOREMAXX_LEGAL.privacyUrl)} hitSlop={8}>
          <Text style={styles.link}>Privacy</Text>
        </Pressable>
        <Text style={[styles.dot, { color: c.textFaint }]}>·</Text>
        <Pressable onPress={() => open(CHOREMAXX_LEGAL.termsUrl)} hitSlop={8}>
          <Text style={styles.link}>Terms</Text>
        </Pressable>
        <Text style={[styles.dot, { color: c.textFaint }]}>·</Text>
        <Pressable onPress={() => open(`mailto:${CHOREMAXX_LEGAL.supportEmail}`)} hitSlop={8}>
          <Text style={styles.link}>Support</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    gap: 6,
    paddingTop: 4,
  },
  copyright: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  dot: {
    fontSize: 12,
  },
  link: {
    color: orbitColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  links: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  root: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
});

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { orbitColors, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

type EmptyStateTone = 'allClear' | 'noneYet' | 'noResults';

type EmptyStateProps = {
  tone?: EmptyStateTone;
  icon?: keyof typeof MaterialIcons.glyphMap;
  title: string;
  caption?: string;
};

const TONE_ICON: Record<EmptyStateTone, keyof typeof MaterialIcons.glyphMap> = {
  allClear: 'check-circle-outline',
  noneYet: 'inbox',
  noResults: 'search-off',
};

/**
 * Calm "nothing here" moment — a design feature per
 * docs/design-system/01-product-philosophy.md, not a placeholder.
 */
export function EmptyState({ tone = 'noneYet', icon, title, caption }: EmptyStateProps) {
  const orbit = useOrbitOptional();
  const { c } = useOrbitColors();
  const accent = orbit?.accentTheme.primary ?? orbitColors.primary;
  const resolvedIcon = icon ?? TONE_ICON[tone];

  return (
    <View style={styles.root} accessibilityRole="text" accessibilityLabel={caption ? `${title}. ${caption}` : title}>
      <View style={[styles.iconWrap, { backgroundColor: `${accent}1A` }]}>
        <MaterialIcons name={resolvedIcon} size={28} color={accent} />
      </View>
      <Text style={[typography.headline, styles.title, { color: c.text }]}>{title}</Text>
      {caption ? (
        <Text style={[typography.subheadline, styles.caption, { color: c.textMuted }]}>{caption}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.xl,
    paddingVertical: space.section,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 56,
    justifyContent: 'center',
    marginBottom: space.xs,
    width: 56,
  },
  title: { textAlign: 'center' },
  caption: { textAlign: 'center' },
});

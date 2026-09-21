import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { radius, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  chapterName: string;
  title: string;
  body: string;
  stepLabel: string;
  isAction: boolean;
  isLast: boolean;
  cardRef?: React.RefObject<View | null>;
  onNext: () => void;
  onSkipChapter: () => void;
  onSkipStep: () => void;
  onClose: () => void;
};

export function TourCard({
  chapterName,
  title,
  body,
  stepLabel,
  isAction,
  isLast,
  cardRef,
  onNext,
  onSkipChapter,
  onSkipStep,
  onClose,
}: Props) {
  const { c } = useOrbitColors();

  return (
    <View ref={cardRef} collapsable={false} style={styles.wrap} accessibilityViewIsModal={!isAction}>
      <GlassCard style={styles.card}>
        <View style={styles.topRow}>
          <Text style={[typography.caption1, styles.eyebrow, { color: c.textSubtle }]}>
            {chapterName}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close tour"
            style={styles.closeHit}>
            <Text style={[typography.headline, { color: c.textMuted }]}>×</Text>
          </Pressable>
        </View>
        <Text style={[typography.title3, { color: c.text }]}>{title}</Text>
        <Text style={[typography.body, { color: c.textMuted }]}>{body}</Text>
        <Text style={[typography.caption1, { color: c.textSubtle }]}>{stepLabel}</Text>
        <View style={styles.actions}>
          {isAction ? (
            <>
              <Text style={[typography.subheadline, { color: c.text, fontWeight: '600' }]}>
                Your turn
              </Text>
              <Pressable onPress={onSkipStep} hitSlop={8} accessibilityRole="button">
                <Text style={[typography.footnote, { color: c.primary }]}>Skip this step</Text>
              </Pressable>
            </>
          ) : (
            <OrbitButton onPress={onNext}>{isLast ? 'Done' : 'Next'}</OrbitButton>
          )}
          <Pressable onPress={onSkipChapter} hitSlop={8} accessibilityRole="button" style={styles.skip}>
            <Text style={[typography.footnote, { color: c.textSubtle }]}>Skip</Text>
          </Pressable>
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: 340,
    width: '100%',
  },
  card: {
    gap: space.sm,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyebrow: {
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  closeHit: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    minWidth: 44,
  },
  actions: {
    alignItems: 'stretch',
    gap: space.sm,
    marginTop: space.xs,
  },
  skip: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
});

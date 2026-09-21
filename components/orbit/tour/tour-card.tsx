import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  chapterName: string;
  title: string;
  body: string;
  stepLabel: string;
  stepIndex: number;
  stepsInChapter: number;
  isAction: boolean;
  isLast: boolean;
  primaryLabel?: string;
  cardRef?: React.RefObject<View | null>;
  onNext: () => void;
  onSkipChapter: () => void;
  onSkipStep: () => void;
  onLayoutHeight?: (height: number) => void;
  maxHeight?: number;
};

export function TourCard({
  chapterName,
  title,
  body,
  stepLabel,
  stepIndex,
  stepsInChapter,
  isAction,
  isLast,
  primaryLabel,
  cardRef,
  onNext,
  onSkipChapter,
  onSkipStep,
  onLayoutHeight,
  maxHeight,
}: Props) {
  const { c } = useOrbitColors();

  const onLayout = (e: LayoutChangeEvent) => {
    onLayoutHeight?.(e.nativeEvent.layout.height);
  };

  const dots = Array.from({ length: Math.max(1, stepsInChapter) }, (_, i) => i);

  return (
    <View
      ref={cardRef}
      collapsable={false}
      style={[styles.wrap, maxHeight ? { maxHeight } : null]}
      accessibilityViewIsModal={!isAction}
      onLayout={onLayout}>
      <GlassCard style={styles.card}>
        <Text style={[typography.footnote, styles.eyebrow, { color: c.textSubtle }]}>
          {chapterName}
          {stepLabel ? ` · ${stepLabel}` : ''}
        </Text>
        <Text style={[typography.title3, { color: c.text }]}>{title}</Text>
        <ScrollView
          style={maxHeight ? styles.bodyScroll : undefined}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled">
          <Text style={[typography.body, { color: c.textMuted }]}>{body}</Text>
        </ScrollView>
        <View style={styles.footer}>
          <View style={styles.dots} accessibilityLabel={stepLabel}>
            {dots.map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === stepIndex ? c.primary : c.textSubtle,
                    opacity: i === stepIndex ? 1 : 0.35,
                  },
                ]}
              />
            ))}
          </View>
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
              <>
                <Pressable
                  onPress={onSkipChapter}
                  hitSlop={8}
                  accessibilityRole="button"
                  style={styles.skip}>
                  <Text style={[typography.footnote, { color: c.textSubtle }]}>Skip</Text>
                </Pressable>
                <OrbitButton onPress={onNext}>
                  {primaryLabel ?? (isLast ? 'Done' : 'Next')}
                </OrbitButton>
              </>
            )}
          </View>
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
  bodyScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  card: {
    gap: space.sm,
    padding: 20,
  },
  eyebrow: {
    letterSpacing: 0.3,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
    justifyContent: 'space-between',
    marginTop: space.xs,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  skip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});

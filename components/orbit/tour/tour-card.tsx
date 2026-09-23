import { BlurView } from 'expo-blur';
import { Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { androidBlurMethod, material, resolveBlurTint } from '@/constants/material-tokens';
import { radius, space, typography } from '@/constants/orbit-theme';
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

/**
 * Tour coach card — frosted glass so copy stays readable over Home.
 * Overlay chrome (not content rows), so BlurView is intentional here.
 */
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
  const { c, isDark } = useOrbitColors();

  const onLayout = (e: LayoutChangeEvent) => {
    onLayoutHeight?.(e.nativeEvent.layout.height);
  };

  const dots = Array.from({ length: Math.max(1, stepsInChapter) }, (_, i) => i);
  const frostFill = isDark ? 'rgba(10,16,28,0.88)' : 'rgba(255,255,255,0.92)';
  const frostBorder = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,28,42,0.12)';

  return (
    <View
      ref={cardRef}
      collapsable={false}
      pointerEvents="auto"
      style={[styles.wrap, maxHeight ? { maxHeight, overflow: 'hidden' } : null]}
      accessibilityViewIsModal={!isAction}
      onLayout={onLayout}>
      <View
        style={[
          styles.frostShell,
          maxHeight ? styles.cardFit : null,
          { borderColor: frostBorder },
        ]}>
        <View style={styles.frostBg} pointerEvents="none">
          <BlurView
            intensity={
              Platform.OS === 'ios'
                ? Math.max(material.liquidGlass.intensity, 64)
                : material.liquidGlass.androidIntensity
            }
            tint={resolveBlurTint(isDark)}
            experimentalBlurMethod={androidBlurMethod}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: frostFill }]} />
        </View>
        <View style={[styles.card, maxHeight ? styles.cardFit : null]}>
          <Text style={[typography.footnote, styles.eyebrow, { color: c.textMuted }]}>
            {chapterName}
            {stepLabel ? ` · ${stepLabel}` : ''}
          </Text>
          <Text style={[typography.title3, { color: c.text }]}>{title}</Text>
          <ScrollView
            style={maxHeight ? styles.bodyScroll : undefined}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled">
            <Text style={[typography.body, { color: c.textSoft }]}>{body}</Text>
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
                    <Text style={[typography.footnote, { color: c.textMuted }]}>Skip</Text>
                  </Pressable>
                  <OrbitButton onPress={onNext}>
                    {primaryLabel ?? (isLast ? 'Done' : 'Next')}
                  </OrbitButton>
                </>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: 340,
    width: '100%',
  },
  frostShell: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  frostBg: {
    ...StyleSheet.absoluteFillObject,
  },
  bodyScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  card: {
    gap: space.sm,
    padding: 20,
  },
  /** Shrink with wrap maxHeight so the body ScrollView yields to the footer. */
  cardFit: {
    flexShrink: 1,
    minHeight: 0,
  },
  eyebrow: {
    letterSpacing: 0.3,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
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

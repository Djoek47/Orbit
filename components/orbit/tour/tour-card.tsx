import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { androidBlurMethod, material, resolveBlurTint } from '@/constants/material-tokens';
import { orbitColors, radius, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';

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
  /** WO12 §D3 coach walkthrough. */
  adHoc?: boolean;
  canDoItForYou?: boolean;
  onDoItForMe?: () => void;
  cardRef?: React.RefObject<View | null>;
  onNext: () => void;
  onBack?: () => void;
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
  adHoc,
  canDoItForYou,
  onDoItForMe,
  cardRef,
  onNext,
  onBack,
  onSkipChapter: _onSkipChapter,
  onSkipStep,
  onLayoutHeight,
  maxHeight,
}: Props) {
  const { c, isDark } = useOrbitColors();
  const orbit = useOrbitOptional();
  const accent = orbit?.accentTheme.primary ?? c.primary;
  const accentEnd = orbit?.accentTheme.secondary ?? accent;

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
                      backgroundColor: i === stepIndex ? accent : c.textSubtle,
                      opacity: i === stepIndex ? 1 : 0.35,
                      width: i === stepIndex ? 16 : 6,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.actions}>
              {onBack ? (
                <Pressable
                  onPress={onBack}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Previous step"
                  style={styles.textBtn}>
                  <Text style={[typography.footnote, { color: c.textMuted, fontWeight: '600' }]}>
                    Back
                  </Text>
                </Pressable>
              ) : (
                <View />
              )}
              <View style={styles.actionRight}>
                {adHoc ? (
                  <>
                    {canDoItForYou && onDoItForMe ? (
                      <Pressable
                        onPress={onDoItForMe}
                        accessibilityRole="button"
                        accessibilityLabel="Do it for me"
                        style={({ pressed }) => [pressed && { opacity: 0.88 }]}>
                        <LinearGradient
                          colors={[accent, accentEnd]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.next}>
                          <Text style={[typography.footnote, styles.nextLabel]} numberOfLines={1}>
                            Do it for me
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={onNext}
                      accessibilityRole="button"
                      accessibilityLabel={primaryLabel ?? (isLast ? 'Done' : 'Next')}
                      style={styles.textBtn}>
                      <Text style={[typography.footnote, { color: c.textMuted, fontWeight: '600' }]}>
                        {primaryLabel ?? (isLast ? 'Done' : 'Next')}
                      </Text>
                    </Pressable>
                  </>
                ) : isAction ? (
                  <Pressable
                    onPress={onSkipStep}
                    hitSlop={8}
                    accessibilityRole="button"
                    style={styles.textBtn}>
                    <Text style={[typography.footnote, { color: accent, fontWeight: '600' }]}>
                      Skip this step
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    <Pressable
                      onPress={onSkipStep}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Skip this step"
                      style={styles.textBtn}>
                      <Text style={[typography.footnote, { color: c.textMuted, fontWeight: '600' }]}>
                        Skip
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={onNext}
                      accessibilityRole="button"
                      accessibilityLabel={primaryLabel ?? (isLast ? 'Done' : 'Next')}
                      style={({ pressed }) => [pressed && { opacity: 0.88 }]}>
                      <LinearGradient
                        colors={[accent, accentEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.next}>
                        <Text style={[typography.footnote, styles.nextLabel]} numberOfLines={1}>
                          {primaryLabel ?? (isLast ? 'Done' : 'Next')}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </>
                )}
              </View>
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
    ...StyleSheet.absoluteFill,
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
    flexShrink: 0,
    gap: 12,
    marginTop: space.xs,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  dot: {
    borderRadius: 3,
    height: 6,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  actionRight: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 4,
    justifyContent: 'flex-end',
  },
  textBtn: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  next: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 18,
  },
  nextLabel: {
    color: orbitColors.ink,
    fontWeight: '700',
  },
});

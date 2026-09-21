/**
 * Tour overlay — always on top (FullWindowOverlay / Modal), safe placement,
 * Exit pill + watchdog. Work Order 9.3 §3.1–3.4, §3.7.
 */
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';

import { TourCard } from '@/components/orbit/tour/tour-card';
import { AppText as Text } from '@/components/orbit/app-text';
import { isTourCardOnScreen, placeTourCard } from '@/lib/tour/tour-layout';
import type { TourRect } from '@/lib/tour/tour-types';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { radius, typography } from '@/constants/orbit-theme';

const PAD = 8;
const WATCHDOG_MS = 1500;

type Props = {
  target: TourRect | null;
  chapterName: string;
  title: string;
  body: string;
  stepLabel: string;
  stepIndex: number;
  stepsInChapter: number;
  isAction: boolean;
  isLast: boolean;
  centered?: boolean;
  primaryLabel?: string;
  cardRef?: React.RefObject<View | null>;
  onNext: () => void;
  onSkipChapter: () => void;
  onSkipStep: () => void;
  onClose: () => void;
  /** Watchdog: card never laid out on-screen. */
  onWatchdogSkip: () => void;
  /** Card measured inside the safe area — reset watchdog streak. */
  onCardReady?: () => void;
};

function TourOverlayBody({
  target,
  chapterName,
  title,
  body,
  stepLabel,
  stepIndex,
  stepsInChapter,
  isAction,
  isLast,
  centered,
  primaryLabel,
  cardRef,
  onNext,
  onSkipChapter,
  onSkipStep,
  onClose,
  onWatchdogSkip,
  onCardReady,
}: Props) {
  const { c, isDark } = useOrbitColors();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  const [cardVisible, setCardVisible] = useState(false);
  const watchdogFired = useRef(false);
  const stepKey = `${chapterName}:${title}:${stepIndex}`;

  const dimOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardSlide = useSharedValue(8);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  // Reset measure + watchdog on each step
  useEffect(() => {
    setCardHeight(0);
    setCardVisible(false);
    watchdogFired.current = false;
    cardOpacity.value = 0;
    cardSlide.value = 8;
    const fade = reduceMotion ? 0 : 180;
    dimOpacity.value = withTiming(1, { duration: fade, easing: Easing.out(Easing.cubic) });
  }, [stepKey, reduceMotion, dimOpacity, cardOpacity, cardSlide]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (watchdogFired.current) return;
      if (!cardVisible) {
        watchdogFired.current = true;
        onWatchdogSkip();
      }
    }, WATCHDOG_MS);
    return () => clearTimeout(id);
  }, [stepKey, cardVisible, onWatchdogSkip]);

  const placement = placeTourCard({
    target: centered ? null : target,
    cardHeight,
    screen: { w: screenW, h: screenH },
    insets: { top: insets.top, bottom: insets.bottom },
    forceCenter: Boolean(centered) || !target,
  });

  useEffect(() => {
    if (cardHeight <= 0) return;
    const top = placement.top;
    const onScreen = isTourCardOnScreen({
      placement: placement.placement,
      top,
      cardHeight,
      screen: { h: screenH },
      insets: { top: insets.top, bottom: insets.bottom },
    });
    if (!onScreen) return;
    setCardVisible(true);
    onCardReady?.();
    const dur = reduceMotion ? 0 : 200;
    cardOpacity.value = withTiming(1, { duration: dur });
    cardSlide.value = withTiming(0, { duration: dur, easing: Easing.out(Easing.cubic) });
  }, [
    cardHeight,
    placement.top,
    insets.top,
    insets.bottom,
    screenH,
    reduceMotion,
    cardOpacity,
    cardSlide,
  ]);

  const dim = isDark ? 0.65 : 0.55;
  const cutout = target && !centered && !placement.ringOnly
    ? {
        left: Math.max(0, target.x - PAD),
        top: Math.max(0, target.y - PAD),
        width: target.width + PAD * 2,
        height: target.height + PAD * 2,
      }
    : null;

  const dimStyle = useAnimatedStyle(() => ({
    opacity: dimOpacity.value * dim,
  }));

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      {
        translateY:
          placement.placement === 'above'
            ? -cardSlide.value
            : placement.placement === 'below'
              ? cardSlide.value
              : 0,
      },
    ],
  }));

  const blockTouches = cardVisible && !isAction;
  const accentRing = c.primary;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dim + cutout as four rectangles (no SVG mask — reliable on iOS 27 / Reanimated 4). */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={isAction ? 'box-none' : blockTouches ? 'auto' : 'none'}>
        {cutout ? (
          <>
            <Animated.View
              pointerEvents={blockTouches ? 'auto' : 'none'}
              style={[
                styles.dimRect,
                dimStyle,
                { left: 0, right: 0, top: 0, height: cutout.top, backgroundColor: '#000' },
              ]}
            />
            <Animated.View
              pointerEvents={blockTouches ? 'auto' : 'none'}
              style={[
                styles.dimRect,
                dimStyle,
                {
                  left: 0,
                  right: 0,
                  top: cutout.top + cutout.height,
                  bottom: 0,
                  backgroundColor: '#000',
                },
              ]}
            />
            <Animated.View
              pointerEvents={blockTouches ? 'auto' : 'none'}
              style={[
                styles.dimRect,
                dimStyle,
                {
                  left: 0,
                  width: cutout.left,
                  top: cutout.top,
                  height: cutout.height,
                  backgroundColor: '#000',
                },
              ]}
            />
            <Animated.View
              pointerEvents={blockTouches ? 'auto' : 'none'}
              style={[
                styles.dimRect,
                dimStyle,
                {
                  left: cutout.left + cutout.width,
                  right: 0,
                  top: cutout.top,
                  height: cutout.height,
                  backgroundColor: '#000',
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  left: cutout.left,
                  top: cutout.top,
                  width: cutout.width,
                  height: cutout.height,
                  borderColor: `${accentRing}99`,
                },
              ]}
            />
          </>
        ) : (
          <Animated.View
            pointerEvents={blockTouches ? 'auto' : 'none'}
            style={[StyleSheet.absoluteFill, dimStyle, { backgroundColor: '#000' }]}
          />
        )}

        {isAction && cutout ? (
          <>
            <View
              pointerEvents="auto"
              style={{ position: 'absolute', left: 0, right: 0, top: 0, height: cutout.top }}
            />
            <View
              pointerEvents="auto"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: cutout.top + cutout.height,
                bottom: 0,
              }}
            />
            <View
              pointerEvents="auto"
              style={{
                position: 'absolute',
                left: 0,
                width: cutout.left,
                top: cutout.top,
                height: cutout.height,
              }}
            />
            <View
              pointerEvents="auto"
              style={{
                position: 'absolute',
                left: cutout.left + cutout.width,
                right: 0,
                top: cutout.top,
                height: cutout.height,
              }}
            />
          </>
        ) : null}
      </View>

      {/* Always-visible Exit — independent of the card */}
      <Pressable
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Exit tour"
        style={[
          styles.exitPill,
          {
            top: insets.top + 8,
            backgroundColor: isDark ? 'rgba(15,25,40,0.92)' : 'rgba(255,255,255,0.94)',
            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
          },
        ]}>
        <Text style={[typography.footnote, { color: c.text, fontWeight: '600' }]}>Exit tour</Text>
      </Pressable>

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.cardSlot,
          cardAnimStyle,
          {
            top: placement.top,
            paddingHorizontal: 16,
            opacity: cardHeight > 0 ? undefined : 0,
          },
        ]}>
        {placement.placement === 'below' ? (
          <View
            style={[
              styles.nub,
              styles.nubUp,
              { borderBottomColor: isDark ? 'rgba(30,40,55,0.95)' : 'rgba(255,255,255,0.92)' },
            ]}
          />
        ) : null}
        <TourCard
          chapterName={chapterName}
          title={title}
          body={body}
          stepLabel={stepLabel}
          stepIndex={stepIndex}
          stepsInChapter={stepsInChapter}
          isAction={isAction}
          isLast={isLast}
          primaryLabel={primaryLabel}
          cardRef={cardRef}
          onNext={onNext}
          onSkipChapter={onSkipChapter}
          onSkipStep={onSkipStep}
          onLayoutHeight={(h) => {
            if (h > 0 && Math.abs(h - cardHeight) > 1) setCardHeight(h);
          }}
          maxHeight={Math.max(120, screenH - insets.top - insets.bottom - 16)}
        />
        {placement.placement === 'above' ? (
          <View
            style={[
              styles.nub,
              styles.nubDown,
              { borderTopColor: isDark ? 'rgba(30,40,55,0.95)' : 'rgba(255,255,255,0.92)' },
            ]}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

export function TourOverlay(props: Props) {
  if (Platform.OS === 'ios') {
    return (
      <FullWindowOverlay>
        <TourOverlayBody {...props} />
      </FullWindowOverlay>
    );
  }

  // Action steps must not sit in a Modal — Android Modals eat cutout taps.
  if (props.isAction) {
    return <TourOverlayBody {...props} />;
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={props.onClose}>
      <TourOverlayBody {...props} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  dimRect: {
    position: 'absolute',
  },
  ring: {
    borderRadius: 16,
    borderWidth: 2,
    position: 'absolute',
  },
  exitPill: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: 'absolute',
    right: 16,
    zIndex: 20,
  },
  cardSlot: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 10,
  },
  nub: {
    alignSelf: 'center',
    borderLeftColor: 'transparent',
    borderLeftWidth: 10,
    borderRightColor: 'transparent',
    borderRightWidth: 10,
    height: 0,
    marginBottom: -1,
    width: 0,
  },
  nubUp: {
    borderBottomWidth: 10,
    borderTopWidth: 0,
  },
  nubDown: {
    borderBottomWidth: 0,
    borderTopWidth: 10,
    marginBottom: 0,
    marginTop: -1,
  },
});

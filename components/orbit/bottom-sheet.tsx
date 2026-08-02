import { useEffect, useRef } from 'react';
import { Dimensions, PanResponder, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { androidBlurMethod, material, resolveBlurTint } from '@/constants/material-tokens';
import { motion } from '@/constants/motion-tokens';
import { radius, space } from '@/constants/orbit-theme';
import { useOrbitOptional } from '@/store/orbit-store';

type BottomSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  /** Fraction of screen height, e.g. 0.35 for "compact", 0.55 for "standard". */
  heightRatio?: number;
  children: React.ReactNode;
  style?: ViewStyle;
};

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD_RATIO = 0.4;

/**
 * Partial-height, drag-dismissible sheet for quick single-decision moments —
 * see docs/design-system/03-motion-interaction.md §9 and
 * docs/design-system/05-component-library.md "Bottom Sheet".
 *
 * Distinct from Expo Router's full-screen `presentation: 'modal'` stack
 * screens (used for create/edit flows) — this is for confirmations only.
 */
export function BottomSheet({ visible, onDismiss, heightRatio = 0.45, children, style }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const orbit = useOrbitOptional();
  const isDark = orbit?.orbitPalette.isDark ?? true;
  const sheetHeight = SCREEN_HEIGHT * heightRatio;

  const translateY = useSharedValue(sheetHeight);
  const backdropOpacity = useSharedValue(0);
  const dragOffset = useRef(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, motion.smooth);
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(sheetHeight, motion.smooth);
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, sheetHeight, translateY, backdropOpacity]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 6,
      onPanResponderMove: (_evt, gesture) => {
        const next = Math.max(0, gesture.dy);
        dragOffset.current = next;
        translateY.value = next;
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy > sheetHeight * DISMISS_THRESHOLD_RATIO || gesture.vy > 1.2) {
          onDismiss();
        } else {
          translateY.value = withSpring(0, motion.snappy);
        }
        dragOffset.current = 0;
      },
    })
  ).current;

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Dismiss" />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { height: sheetHeight + insets.bottom, paddingBottom: insets.bottom },
          sheetStyle,
          style,
        ]}
        {...panResponder.panHandlers}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <BlurView
            intensity={Platform.OS === 'ios' ? material.ultraThin.intensity : material.ultraThin.androidIntensity}
            tint={resolveBlurTint(isDark)}
            experimentalBlurMethod={androidBlurMethod}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={styles.handle} />
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: radius.cardLarge,
    borderTopRightRadius: radius.cardLarge,
    borderCurve: 'continuous',
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderRadius: 2,
    height: 4,
    marginTop: space.xs,
    width: 36,
  },
  content: {
    flex: 1,
    padding: space.lg,
  },
});

import { useEffect, useRef } from 'react';
import {
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';

import { useContentWidth } from '@/components/orbit/layout/app-column';
import { LinearGradient } from 'expo-linear-gradient';
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
import { useKeyboardState } from '@/lib/ui/use-keyboard-visible';
import { useOrbitOptional } from '@/store/orbit-store';

type BottomSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  /** Fraction of screen height, e.g. 0.35 for "compact", 0.55 for "standard". */
  heightRatio?: number;
  children: React.ReactNode;
  style?: ViewStyle;
  /** Theme / character accent wash on glass (hex). */
  accentColor?: string;
  /**
   * When true, sheet content scrolls so CTAs stay reachable on Ask-for-photo /
   * proof reply forms while the sheet rides above the keyboard.
   */
  scrollable?: boolean;
  /** Kept for call-site compatibility; keyboard lift replaces KAV offset. */
  keyboardOffset?: number;
};

/** Air kept above a sheet that has been lifted over the keyboard. */
const KEYBOARD_TOP_GAP = 12;
const DISMISS_THRESHOLD_RATIO = 0.4;

/**
 * Partial-height, drag-dismissible sheet — glass chrome, flat content.
 * Backdrop is real blur + dim so tab-bar glass does not stack.
 * With the keyboard up the sheet rides on top of it and is capped to the room above.
 */
export function BottomSheet({
  visible,
  onDismiss,
  heightRatio = 0.45,
  children,
  style,
  accentColor,
  scrollable = false,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const orbit = useOrbitOptional();
  const isDark = orbit?.orbitPalette.isDark ?? true;
  const accent = accentColor ?? orbit?.accentTheme.primary ?? '#38BDF8';
  const keyboard = useKeyboardState();
  // Read live, not once at module load: an iPad rotates, a Split View resizes, a Duo unfolds,
  // and a height captured at launch would size the sheet for a window that no longer exists.
  const { height: windowHeight } = useWindowDimensions();
  // A Modal renders outside the app's column, so it has to put itself back in it — otherwise
  // on an iPad every sheet is a full-width slab across the glass.
  const column = useContentWidth();
  const sideInset = Math.max(0, (column.windowWidth - column.width) / 2);
  const sheetHeight = windowHeight * heightRatio;
  // With the keyboard up the sheet rides on top of it (its bottom edge is the keyboard's top)
  // and never grows taller than the room above it, so nothing is hidden or scrolled past.
  const lifted = keyboard.visible ? keyboard.height : 0;
  const restingHeight = sheetHeight + insets.bottom;
  const liftedHeight = Math.min(
    restingHeight,
    windowHeight - lifted - insets.top - KEYBOARD_TOP_GAP
  );
  const activeHeight = lifted > 0 ? liftedHeight : restingHeight;

  const translateY = useSharedValue(sheetHeight);
  const backdropOpacity = useSharedValue(0);
  const dragOffset = useRef(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, motion.smooth);
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(activeHeight, motion.smooth);
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, activeHeight, translateY, backdropOpacity]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
      onPanResponderMove: (_evt, gesture) => {
        const next = Math.max(0, gesture.dy);
        dragOffset.current = next;
        translateY.value = next;
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy > activeHeight * DISMISS_THRESHOLD_RATIO || gesture.vy > 1.2) {
          Keyboard.dismiss();
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => {
        Keyboard.dismiss();
        onDismiss();
      }}
      statusBarTranslucent>
      <View style={styles.modalRoot} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <BlurView
            intensity={
              Platform.OS === 'ios'
                ? material.liquidGlass.intensity
                : material.liquidGlass.androidIntensity
            }
            tint={resolveBlurTint(isDark)}
            experimentalBlurMethod={androidBlurMethod}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(7,13,28,0.55)' : 'rgba(15,28,42,0.28)' },
            ]}
          />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              Keyboard.dismiss();
              onDismiss();
            }}
            accessibilityLabel="Dismiss"
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            sideInset > 0 ? { left: sideInset, right: sideInset, width: column.width } : null,
            lifted > 0
              ? { bottom: lifted, height: liftedHeight, paddingBottom: 0 }
              : { height: restingHeight, paddingBottom: insets.bottom },
            sheetStyle,
            style,
          ]}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <BlurView
              intensity={Platform.OS === 'ios' ? 72 : 90}
              tint={resolveBlurTint(isDark)}
              experimentalBlurMethod={androidBlurMethod}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={[
                `${accent}${isDark ? '66' : '55'}`,
                `${accent}00`,
                isDark ? 'rgba(7,13,28,0.55)' : 'rgba(255,255,255,0.35)',
              ]}
              locations={[0, 0.45, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View {...panResponder.panHandlers} style={styles.handleHit}>
            <View style={styles.handle} />
          </View>
          {scrollable ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              // Sheet already rides above the keyboard — iOS must not also inset/scroll the content.
              automaticallyAdjustKeyboardInsets={false}
              contentInsetAdjustmentBehavior="never"
              showsVerticalScrollIndicator={false}
              bounces={!keyboard.visible}>
              {children}
            </ScrollView>
          ) : (
            <View style={styles.content}>{children}</View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
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
    width: '100%',
  },
  handleHit: {
    alignItems: 'center',
    paddingBottom: space.xs,
    paddingTop: space.xs,
    zIndex: 2,
  },
  handle: {
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderRadius: 2,
    height: 4,
    width: 36,
  },
  scroll: {
    flex: 1,
    zIndex: 2,
  },
  scrollContent: {
    flexGrow: 1,
    gap: space.md,
    paddingBottom: space.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  content: {
    flex: 1,
    padding: space.lg,
    zIndex: 2,
  },
});

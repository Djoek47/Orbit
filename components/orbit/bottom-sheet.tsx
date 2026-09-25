import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
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
   * When true, sheet content scrolls and lifts above the keyboard
   * so CTAs stay reachable on Ask-for-photo / proof reply forms.
   */
  scrollable?: boolean;
  /** Extra keyboard offset for nested chrome. */
  keyboardOffset?: number;
};

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD_RATIO = 0.4;

/**
 * Partial-height, drag-dismissible sheet — glass chrome, flat content.
 * Backdrop is real blur + dim so tab-bar glass does not stack.
 * Pass scrollable for forms that must stay reachable above the keyboard.
 */
export function BottomSheet({
  visible,
  onDismiss,
  heightRatio = 0.45,
  children,
  style,
  accentColor,
  scrollable = false,
  keyboardOffset = 0,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const orbit = useOrbitOptional();
  const isDark = orbit?.orbitPalette.isDark ?? true;
  const accent = accentColor ?? orbit?.accentTheme.primary ?? '#38BDF8';
  const baseHeight = SCREEN_HEIGHT * heightRatio;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const translateY = useSharedValue(baseHeight);
  const backdropOpacity = useSharedValue(0);
  const dragOffset = useRef(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  // Grow toward the top when the keyboard is open so content + CTAs remain visible.
  const sheetHeight = Math.min(
    SCREEN_HEIGHT - insets.top - 12,
    Math.max(baseHeight, keyboardHeight > 0 ? SCREEN_HEIGHT * 0.92 : baseHeight)
  );

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
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
      onPanResponderMove: (_evt, gesture) => {
        const next = Math.max(0, gesture.dy);
        dragOffset.current = next;
        translateY.value = next;
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy > sheetHeight * DISMISS_THRESHOLD_RATIO || gesture.vy > 1.2) {
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

  if (!visible) return null;

  const bottomPad = Math.max(insets.bottom, 12) + (Platform.OS === 'android' ? keyboardHeight : 0);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? material.liquidGlass.intensity : material.liquidGlass.androidIntensity}
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
        style={styles.kav}
        pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              paddingBottom: bottomPad,
              marginBottom: Platform.OS === 'ios' ? 0 : undefined,
            },
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
              showsVerticalScrollIndicator={false}
              bounces>
              {children}
            </ScrollView>
          ) : (
            <View style={styles.content}>{children}</View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  kav: {
    bottom: 0,
    justifyContent: 'flex-end',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sheet: {
    borderTopLeftRadius: radius.cardLarge,
    borderTopRightRadius: radius.cardLarge,
    borderCurve: 'continuous',
    overflow: 'hidden',
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

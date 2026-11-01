import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/orbit/avatar';
import { BrandOpening } from '@/components/orbit/brand-opening';
import { getAccentTheme } from '@/constants/accent-themes';
import { space } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

type SidekickUnlockSplashProps = {
  member: HouseholdMember;
  onComplete: () => void;
};

/**
 * Personal Sidekick lock screen — admin-quality brand opening, then dissolve into the app.
 * Replaces the shared-iPad "Who's using this iPad?" picker on single-profile Sidekick devices.
 */
export function SidekickUnlockSplash({ member, onComplete }: SidekickUnlockSplashProps) {
  const insets = useSafeAreaInsets();
  const { c } = useOrbitColors();
  const theme = getAccentTheme(member.accentThemeId);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const brandOpacity = useSharedValue(1);
  const brandScale = useSharedValue(1);
  const avatarOpacity = useSharedValue(0);
  const avatarY = useSharedValue(16);
  const screenOpacity = useSharedValue(1);
  const completedRef = useRef(false);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCompleteRef.current();
  };

  useEffect(() => {
    const avatarTimer = setTimeout(() => {
      avatarOpacity.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) });
      avatarY.value = withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) });
    }, 1200);

    const dissolveBrandTimer = setTimeout(() => {
      brandOpacity.value = withTiming(0, { duration: 420, easing: Easing.inOut(Easing.cubic) });
      brandScale.value = withTiming(0.94, { duration: 420, easing: Easing.inOut(Easing.cubic) });
    }, 2000);

    const exitTimer = setTimeout(() => {
      screenOpacity.value = withTiming(
        0,
        { duration: 520, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(finish)();
        }
      );
    }, 2480);

    return () => {
      clearTimeout(avatarTimer);
      clearTimeout(dissolveBrandTimer);
      clearTimeout(exitTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ scale: brandScale.value }],
  }));

  const avatarStyle = useAnimatedStyle(() => ({
    opacity: avatarOpacity.value,
    transform: [{ translateY: avatarY.value }],
  }));

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const photo = isAvatarImageUri(member.avatar);
  const firstName = member.name.trim().split(/\s+/)[0] || member.name;

  return (
    <Animated.View
      style={[
        styles.root,
        screenStyle,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          backgroundColor: c.background,
        },
      ]}>
      <LinearGradient
        colors={[`${theme.primary}30`, 'transparent', `${theme.secondary}12`]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.center}>
        <Animated.View style={[styles.brandWrap, brandStyle]}>
          <BrandOpening tagline={`Welcome back, ${firstName}.`} />
        </Animated.View>

        <Animated.View style={[styles.avatarBlock, avatarStyle]}>
          <LinearGradient
            colors={[theme.primary, theme.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}>
            <View style={[styles.avatarInner, { backgroundColor: c.backgroundSoft }]}>
              <Avatar
                name={member.name}
                emoji={memberDisplayEmoji(member)}
                imageUri={photo ? member.avatar : undefined}
                size="xl"
              />
            </View>
          </LinearGradient>
          <Text style={[styles.opening, { color: c.textMuted }]}>Opening your space…</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  brandWrap: {
    alignItems: 'center',
    width: '100%',
  },
  avatarBlock: {
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
    position: 'absolute',
  },
  avatarRing: {
    alignItems: 'center',
    borderRadius: 52,
    height: 104,
    justifyContent: 'center',
    padding: 3,
    width: 104,
  },
  avatarInner: {
    alignItems: 'center',
    borderRadius: 49,
    height: 98,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 98,
  },
  opening: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { radius, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { Reward } from '@/types/orbit';

const HOLD_MS = 900;

type RewardVaultCardProps = {
  reward: Reward;
  accent: string;
  canRedeem: boolean;
  canAfford: boolean;
  busy?: boolean;
  isAdmin?: boolean;
  /** Admin preview label when redeem is not for self. */
  statusLabel?: string;
  onClaim: () => void | Promise<void>;
  onArchive?: () => void;
};

/**
 * Make-style 2-column reward box — whole-card hold-to-redeem with glass fill.
 * v2 §6: no emoji, no XP cost — frequency grants only.
 */
export function RewardVaultCard({
  reward,
  accent,
  canRedeem,
  canAfford,
  busy,
  isAdmin,
  statusLabel,
  onClaim,
  onArchive,
}: RewardVaultCardProps) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const color = reward.color ?? accent;
  const mode = reward.approvalRequired ? 'request' : 'instant';
  const [holding, setHolding] = useState(false);
  const firedRef = useRef(false);
  const holdingRef = useRef(false);
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);
  const shimmer = useSharedValue(0);

  const interactive = canRedeem && canAfford && !busy;
  const frequencyLabel = reward.frequency
    ? reward.frequency.charAt(0).toUpperCase() + reward.frequency.slice(1)
    : null;
  const hint =
    !canRedeem
      ? statusLabel ?? (isAdmin ? 'Active' : 'Locked')
      : holding
        ? 'Hold…'
        : mode === 'request'
          ? 'Hold to request'
          : 'Hold to redeem';

  const resetVisual = () => {
    cancelAnimation(progress);
    progress.value = 0;
    scale.value = withSpring(1, { damping: 16, stiffness: 220 });
    setHolding(false);
    holdingRef.current = false;
    firedRef.current = false;
  };

  const clearHold = () => {
    if (firedRef.current) return;
    holdingRef.current = false;
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
    scale.value = withSpring(1, { damping: 16, stiffness: 220 });
    setHolding(false);
  };

  const fire = () => {
    if (firedRef.current || !interactive) return;
    if (!holdingRef.current) return;
    firedRef.current = true;
    progress.value = 1;
    shimmer.value = withSequence(
      withTiming(1, { duration: 220 }),
      withTiming(0, { duration: 420 })
    );
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void Promise.resolve(onClaim()).finally(() => {
      resetVisual();
    });
  };

  const startHold = () => {
    if (!interactive) return;
    firedRef.current = false;
    holdingRef.current = true;
    setHolding(true);
    progress.value = 0;
    scale.value = withSpring(0.97, { damping: 18, stiffness: 280 });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    progress.value = withTiming(
      1,
      { duration: HOLD_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(fire)();
      }
    );
  };

  useEffect(() => () => resetVisual(), []);

  const fillStyle = useAnimatedStyle(() => ({
    height: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
    opacity: interpolate(progress.value, [0, 0.15, 1], [0, 0.35, 0.55]),
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value * 0.45,
  }));

  return (
    <Animated.View style={[{ flex: 1, minWidth: '46%' }, cardStyle]}>
      <Pressable
        disabled={!interactive}
        onPressIn={startHold}
        onPressOut={clearHold}
        accessibilityRole="button"
        accessibilityLabel={`${reward.title}. ${hint}`}
        accessibilityHint={
          interactive ? 'Hold until the card fills to redeem' : undefined
        }
        style={[
          styles.card,
          {
            backgroundColor: `${color}14`,
            borderColor: holding ? `${color}66` : `${color}30`,
          },
        ]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fill,
            { backgroundColor: color },
            fillStyle,
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shimmer,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.55)',
            },
            shimmerStyle,
          ]}
        />

        <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
          <MaterialIcons name="card-giftcard" size={22} color={color} />
        </View>
        <Text style={[typography.headline, styles.title, { color: c.text }]} numberOfLines={2}>
          {reward.title}
        </Text>
        <Text style={[typography.caption1, { color: c.textSubtle, marginTop: 2 }]}>
          {reward.subtitle?.trim() || reward.category?.trim() || 'Reward'}
          {reward.quantity ? ` · ${reward.quantity}` : ''}
        </Text>

        <View style={styles.footer}>
          <Text style={[styles.freq, { color }]}>{frequencyLabel ?? 'Anytime'}</Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: interactive ? `${color}22` : glass(0.06),
                borderColor: interactive ? `${color}44` : glassBorder(0.1),
              },
            ]}>
            {busy ? (
              <ActivityIndicator size="small" color={color} />
            ) : (
              <Text
                style={[
                  styles.statusText,
                  { color: interactive || canRedeem ? color : c.textSubtle },
                ]}
                numberOfLines={1}>
                {hint}
              </Text>
            )}
          </View>
        </View>

        {reward.assignedMemberName ? (
          <Text style={[typography.caption2, { color: c.textMuted, marginTop: 6 }]} numberOfLines={1}>
            For {reward.assignedMemberName}
          </Text>
        ) : null}

        {isAdmin && onArchive ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onArchive();
            }}
            hitSlop={8}
            style={styles.archive}>
            <Text style={[typography.caption2, { color: c.textSubtle }]}>Archive</Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    padding: 14,
    minHeight: 168,
  },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: 8, fontWeight: '700' },
  footer: {
    marginTop: 'auto',
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  freq: { fontSize: 13, fontWeight: '700' },
  statusPill: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '58%',
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  archive: { marginTop: 8, alignSelf: 'flex-start' },
});

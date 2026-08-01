import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { motion } from '@/constants/motion-tokens';
import { radius, space } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export type NovaCardKind = 'morningBrief' | 'eveningWrap' | 'recommendation' | 'alert';

export type NovaCardAction = {
  label: string;
  onPress: () => void;
};

type NovaCardProps = {
  kind?: NovaCardKind;
  message: string;
  actions?: NovaCardAction[];
};

const KIND_ICON: Record<NovaCardKind, keyof typeof MaterialIcons.glyphMap> = {
  morningBrief: 'wb-sunny',
  eveningWrap: 'nights-stay',
  recommendation: 'auto-awesome',
  alert: 'priority-high',
};

/**
 * Calm Apple-Intelligence-style summary card with one-tap actions — replaces
 * chat-bubble UI as Nova's primary surface.
 */
export function NovaCard({ kind = 'recommendation', message, actions = [] }: NovaCardProps) {
  const { c, type, glass, glassBorder } = useOrbitColors();
  const accent = c.novaCyan;
  const enter = useAnimatedStyle(() => ({
    opacity: withSpring(1, motion.settle),
    transform: [{ translateY: withSpring(0, motion.settle) }],
  }));

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: glass(0.06),
          borderColor: glassBorder(0.12),
        },
        enter,
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>
        <MaterialIcons name={KIND_ICON[kind]} size={20} color={accent} />
      </View>
      <Text style={[type.body, styles.message, { color: c.textSoft }]}>{message}</Text>
      {actions.length > 0 ? (
        <View style={styles.actionRow}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              style={[styles.actionChip, { borderColor: `${accent}55` }]}>
              <Text style={[type.footnote, { color: accent, fontWeight: '700' }]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.cardLarge,
    borderCurve: 'continuous',
    borderWidth: 1,
    gap: space.sm,
    padding: space.xl,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  message: {
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  actionChip: {
    borderRadius: radius.control,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
  },
});

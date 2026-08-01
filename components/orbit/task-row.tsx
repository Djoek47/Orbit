import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Avatar } from '@/components/orbit/avatar';
import { motion } from '@/constants/motion-tokens';
import { orbitColors, radius, space, typography } from '@/constants/orbit-theme';
import { useOrbitOptional } from '@/store/orbit-store';

type TaskRowVariant = 'compact' | 'full';

type TaskRowProps = {
  title: string;
  assigneeName?: string;
  roomEmoji?: string;
  dueLabel?: string;
  xp?: number;
  completed: boolean;
  variant?: TaskRowVariant;
  onToggleComplete: () => void;
  onPress: () => void;
};

/**
 * Reminders-style flat task row — see
 * docs/design-system/05-component-library.md "Task Row" and
 * docs/design-system/11-reverse-engineering-apple-apps.md (Reminders).
 */
export function TaskRow({
  title,
  assigneeName,
  roomEmoji,
  dueLabel,
  xp,
  completed,
  variant = 'full',
  onToggleComplete,
  onPress,
}: TaskRowProps) {
  const orbit = useOrbitOptional();
  const ink = orbit?.orbitPalette.ink ?? orbitColors.ink;
  const checkScale = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(completed ? 1 : 0.001, motion.snappy) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${title}${assigneeName ? `, ${assigneeName}` : ''}${completed ? ', completed' : ''}`}>
      <Pressable
        onPress={onToggleComplete}
        hitSlop={10}
        style={[styles.checkbox, completed && { borderColor: orbitColors.success }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
        accessibilityLabel="Mark complete">
        <Animated.View style={[styles.checkFill, checkScale]}>
          <MaterialIcons name="check" size={14} color={ink} />
        </Animated.View>
      </Pressable>

      <View style={styles.copy}>
        <Text
          style={[typography.body, completed && styles.completedText]}
          numberOfLines={1}>
          {title}
        </Text>
        {variant === 'full' ? (
          <View style={styles.metaRow}>
            {roomEmoji ? <Text style={styles.metaEmoji}>{roomEmoji}</Text> : null}
            {dueLabel ? <Text style={typography.subheadline}>{dueLabel}</Text> : null}
          </View>
        ) : null}
      </View>

      {assigneeName ? <Avatar name={assigneeName} size="xs" /> : null}
      {typeof xp === 'number' && xp > 0 ? (
        <Text style={[typography.caption1, styles.xp]}>+{xp}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
    minHeight: 56,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: radius.full,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkFill: {
    alignItems: 'center',
    backgroundColor: orbitColors.success,
    borderRadius: radius.full,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.xs,
  },
  metaEmoji: {
    fontSize: 13,
  },
  completedText: {
    color: orbitColors.textMuted,
    textDecorationLine: 'line-through',
  },
  xp: {
    color: orbitColors.success,
    fontWeight: '700',
  },
});

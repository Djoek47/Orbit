import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Avatar } from '@/components/orbit/avatar';
import { motion } from '@/constants/motion-tokens';
import { radius, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

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
  const { c, isDark, glassBorder } = useOrbitColors();
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
        style={[
          styles.checkbox,
          {
            borderColor: completed ? c.success : glassBorder(isDark ? 0.24 : 0.18),
          },
        ]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
        accessibilityLabel="Mark complete">
        <Animated.View style={[styles.checkFill, { backgroundColor: c.success }, checkScale]}>
          <MaterialIcons name="check" size={14} color={c.ink} />
        </Animated.View>
      </Pressable>

      <View style={styles.copy}>
        <Text
          style={[
            typography.body,
            { color: completed ? c.textMuted : c.text },
            completed && styles.completedText,
          ]}
          numberOfLines={1}>
          {title}
        </Text>
        {variant === 'full' ? (
          <View style={styles.metaRow}>
            {roomEmoji ? <Text style={styles.metaEmoji}>{roomEmoji}</Text> : null}
            {dueLabel ? (
              <Text style={[typography.subheadline, { color: c.textMuted }]}>{dueLabel}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {assigneeName ? <Avatar name={assigneeName} size="xs" /> : null}
      {typeof xp === 'number' && xp > 0 ? (
        <Text style={[typography.caption1, styles.xp, { color: c.success }]}>+{xp}</Text>
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
    borderRadius: radius.full,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkFill: {
    alignItems: 'center',
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
    textDecorationLine: 'line-through',
  },
  xp: {
    fontWeight: '700',
  },
});

/**
 * WO12 settle — turn ledger with Undo N things (WO11 §2.5).
 * Mount animation allowed here: settle is after WebRTC uplink is quiet.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { IuiRow } from '@/components/orbit/poppins-stage/iui-row';
import { STAGE, stageMuted } from '@/constants/iui-stage';
import { motion, motionDuration } from '@/constants/motion-tokens';
import { space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type LedgerRow = {
  id: string;
  label: string;
};

type Props = {
  kind?: 'added' | 'done' | 'assigned';
  title?: string;
  undoable?: boolean;
  undoLabel?: string;
  ledger?: LedgerRow[];
  onUndo?: () => void;
  onUndoOne?: (id: string) => void;
};

const LABEL: Record<NonNullable<Props['kind']>, string> = {
  added: 'All set',
  done: 'All set',
  assigned: 'All set',
};

export function IuiResultMark({
  kind = 'added',
  title,
  undoable,
  undoLabel,
  ledger,
  onUndo,
  onUndoOne,
}: Props) {
  const { c, isDark } = useOrbitColors();
  const muted = stageMuted(isDark);
  const scale = useSharedValue(0.82);
  const markGreen = STAGE.semantic.success;

  useEffect(() => {
    scale.value = withSpring(1, motion.settle);
  }, [scale]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(motionDuration.smooth)} style={styles.wrap}>
      <Animated.View
        style={[
          styles.badge,
          {
            backgroundColor: `${markGreen}24`,
            borderColor: `${markGreen}47`,
          },
          badgeStyle,
        ]}>
        <MaterialIcons name="check" size={46} color={markGreen} />
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(80).duration(motionDuration.smooth + 60)}>
        <Text style={[styles.label, { color: markGreen }]}>{LABEL[kind]}</Text>
        {title ? (
          <Text style={[styles.title, { color: c.text }]} numberOfLines={3}>
            {title}
          </Text>
        ) : null}
      </Animated.View>

      {ledger && ledger.length > 0 ? (
        <View
          style={[
            styles.ledger,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.92)',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,28,42,0.10)',
            },
          ]}>
          {ledger.map((row) => (
            <IuiRow
              key={row.id}
              title={row.label}
              status="done"
              allowDrop={Boolean(onUndoOne)}
              dropLabel={`Undo ${row.label}`}
              onDrop={onUndoOne ? () => onUndoOne(row.id) : undefined}
            />
          ))}
        </View>
      ) : null}

      {undoable && onUndo ? (
        <Pressable
          onPress={onUndo}
          accessibilityRole="button"
          accessibilityLabel={undoLabel ?? 'Undo'}
          style={[styles.undoPill, { borderColor: `${markGreen}55` }]}>
          <Text style={[styles.undoText, { color: markGreen }]}>
            {undoLabel ?? 'Undo'}
          </Text>
        </Pressable>
      ) : null}

      {undoable ? (
        <Text style={[styles.hint, { color: muted }]}>Five seconds, then the stage clears.</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: space.sm + 2,
    paddingVertical: space.sm,
    width: '100%',
  },
  badge: {
    alignItems: 'center',
    borderRadius: 54,
    height: 108,
    width: 108,
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: {
    ...typography.title2,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  title: {
    ...typography.subheadline,
    fontSize: 15,
    lineHeight: 21,
    marginTop: space.xxs,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  ledger: {
    width: '100%',
    maxWidth: 360,
    borderRadius: STAGE.radius.card,
    borderWidth: 1,
    padding: 6,
    gap: 3,
    marginTop: 8,
  },
  undoPill: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: STAGE.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  undoText: { fontSize: 15, fontWeight: '700' },
  hint: {
    ...typography.caption1,
    marginTop: space.xs,
    textAlign: 'center',
  },
});

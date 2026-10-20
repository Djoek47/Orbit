/**
 * WO12 settle — turn ledger with Undo N things (Settle.html).
 * WO13 — the Poppins orb above the stage is the tick; no separate success circle.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { STAGE, stageFaint, stageMuted, stageSuccessText } from '@/constants/iui-stage';
import { motionDuration } from '@/constants/motion-tokens';
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
  undoUntil?: number | null;
  ledger?: LedgerRow[];
  onUndo?: () => void;
  onUndoOne?: (id: string) => void;
  /** WO12 §F4 — talking part offline; never a failure sentence on success. */
  modelOffline?: boolean;
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
  undoUntil,
  ledger,
  onUndo,
  onUndoOne,
  modelOffline,
}: Props) {
  const { c, isDark } = useOrbitColors();
  const muted = stageMuted(isDark);
  const faint = stageFaint(isDark);
  const markGreen = STAGE.semantic.success;
  const markText = stageSuccessText(isDark);
  const [ringProgress, setRingProgress] = useState(1);

  useEffect(() => {
    if (!undoable || !undoUntil) {
      setRingProgress(1);
      return;
    }
    const total = Math.max(1, undoUntil - Date.now());
    const tick = () => {
      const left = Math.max(0, undoUntil - Date.now());
      setRingProgress(left / total);
    };
    tick();
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, [undoable, undoUntil]);

  return (
    <Animated.View entering={FadeIn.duration(motionDuration.smooth)} style={styles.wrap}>
      <Animated.View entering={FadeInUp.delay(40).duration(motionDuration.smooth + 60)}>
        <Text style={[styles.label, { color: markText }]}>{LABEL[kind]}</Text>
        {title ? (
          <Text
            style={[styles.title, { color: isDark ? STAGE.ink.softDark : c.text }]}
            numberOfLines={3}>
            {title}
          </Text>
        ) : null}
        {modelOffline ? (
          <Text style={[styles.offline, { color: muted }]}>
            The talking part is offline — everything you asked for still happened.
          </Text>
        ) : null}
      </Animated.View>

      {ledger && ledger.length > 0 ? (
        <View
          style={[
            styles.ledger,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.92)',
              borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,28,42,0.10)',
            },
          ]}>
          {ledger.map((row) => (
            <View key={row.id} style={styles.ledgerRow}>
              <View style={[styles.ledgerDot, { backgroundColor: `${markGreen}29` }]}>
                <Text style={{ color: markGreen, fontSize: 11, fontWeight: '700' }}>✓</Text>
              </View>
              <Text
                style={[styles.ledgerLabel, { color: isDark ? STAGE.ink.softDark : c.text }]}
                numberOfLines={1}>
                {row.label}
              </Text>
              {onUndoOne ? (
                <Pressable
                  onPress={() => onUndoOne(row.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Undo ${row.label}`}
                  hitSlop={8}
                  style={styles.ledgerUndo}>
                  <Text style={[styles.ledgerUndoLabel, { color: muted }]}>Undo</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {undoable && onUndo ? (
        <Pressable
          onPress={onUndo}
          accessibilityRole="button"
          accessibilityLabel={undoLabel ?? 'Undo'}
          style={[
            styles.undoPill,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,28,42,0.05)',
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,28,42,0.10)',
            },
          ]}>
          <Text style={[styles.undoText, { color: c.text }]}>{undoLabel ?? 'Undo'}</Text>
          <View
            style={[
              styles.ring,
              {
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,28,42,0.14)',
                borderTopColor: ringProgress > 0.5 ? markGreen : 'transparent',
                borderRightColor: ringProgress > 0.25 ? markGreen : 'transparent',
                borderBottomColor: ringProgress > 0 ? markGreen : 'transparent',
                borderLeftColor: ringProgress > 0.75 ? markGreen : 'transparent',
                opacity: Math.max(0.35, ringProgress),
              },
            ]}
          />
        </Pressable>
      ) : null}

      {undoable ? (
        <Text style={[styles.hint, { color: faint }]}>
          Five seconds, then the stage clears and Poppins goes quiet.
        </Text>
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
    maxWidth: 280,
  },
  offline: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  ledger: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    borderWidth: 1,
    padding: 6,
    gap: 2,
    marginTop: 8,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    minHeight: 44,
  },
  ledgerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerLabel: { flex: 1, fontSize: 14 },
  ledgerUndo: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  ledgerUndoLabel: { fontSize: 12, fontWeight: '500' },
  undoPill: {
    marginTop: 8,
    minHeight: 46,
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 11,
    borderRadius: STAGE.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  undoText: { fontSize: 14, fontWeight: '600' },
  ring: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  hint: {
    ...typography.caption1,
    marginTop: space.xs,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 17,
  },
});

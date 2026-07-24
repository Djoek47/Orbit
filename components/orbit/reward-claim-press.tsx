import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { orbitColors, orbitRadius } from '@/constants/orbit-theme';

const HOLD_MS = 820;
const TICK_MS = 32;

type RewardClaimPressProps = {
  accent?: string;
  mode?: 'instant' | 'request';
  disabled?: boolean;
  busy?: boolean;
  onClaim: () => void | Promise<void>;
};

/**
 * Compact hold-to-claim control for the Rewards vault.
 * Instant = spend XP now · request = queue parent approval.
 */
export function RewardClaimPress({
  accent = orbitColors.accent,
  mode = 'instant',
  disabled,
  busy,
  onClaim,
}: RewardClaimPressProps) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const firedRef = useRef(false);
  const startedAt = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const label = mode === 'instant' ? 'Hold' : 'Request';

  const clearHold = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (doneRef.current) clearTimeout(doneRef.current);
    tickRef.current = null;
    doneRef.current = null;
    setHolding(false);
    setProgress(0);
    firedRef.current = false;
  };

  const fire = () => {
    if (firedRef.current || disabled || busy) return;
    firedRef.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void Promise.resolve(onClaim()).finally(() => {
      clearHold();
    });
  };

  const startHold = () => {
    if (disabled || busy) return;
    firedRef.current = false;
    startedAt.current = Date.now();
    setHolding(true);
    setProgress(0);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    tickRef.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - startedAt.current) / HOLD_MS);
      setProgress(p);
    }, TICK_MS);

    doneRef.current = setTimeout(fire, HOLD_MS);
  };

  useEffect(() => () => clearHold(), []);

  return (
    <Pressable
      disabled={disabled || busy}
      onPressIn={startHold}
      onPressOut={clearHold}
      style={({ pressed }) => [
        styles.control,
        {
          borderColor: `${accent}${disabled ? '33' : '66'}`,
          backgroundColor: `${accent}${disabled ? '12' : '22'}`,
        },
        pressed && !disabled && !busy && styles.pressed,
        (disabled || busy) && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={mode === 'instant' ? 'Hold to claim reward' : 'Hold to request reward'}
      accessibilityState={{ disabled: Boolean(disabled || busy) }}>
      {busy ? (
        <ActivityIndicator size="small" color={accent} />
      ) : (
        <>
          <Text style={[styles.label, { color: disabled ? orbitColors.textSubtle : accent }]}>
            {holding ? '…' : label}
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.round(progress * 100)}%`,
                  backgroundColor: accent,
                },
              ]}
            />
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    alignItems: 'center',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 64,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  disabled: {
    opacity: 0.55,
  },
  fill: {
    borderRadius: 2,
    height: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
  track: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    height: 3,
    overflow: 'hidden',
    width: '100%',
  },
});

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useHouseholdRefresh } from '@/lib/refresh/use-household-refresh';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

type RefreshIconButtonProps = {
  /** Accent color for the icon; defaults to theme accent. */
  color?: string;
  size?: number;
};

/** Tap-to-refresh household data with haptic feedback. */
export function RefreshIconButton({ color, size = 22 }: RefreshIconButtonProps) {
  const { accentTheme } = useOrbit();
  const { c } = useOrbitColors();
  const { refreshing, onRefresh } = useHouseholdRefresh();
  const tint = color ?? accentTheme.primary;

  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void onRefresh();
  }, [onRefresh]);

  return (
    <Pressable
      accessibilityLabel="Refresh"
      accessibilityRole="button"
      disabled={refreshing}
      hitSlop={10}
      onPress={handlePress}
      style={styles.button}>
      {refreshing ? (
        <ActivityIndicator color={tint} size="small" />
      ) : (
        <MaterialIcons name="sync" size={size} color={refreshing ? c.textMuted : tint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 36,
  },
});

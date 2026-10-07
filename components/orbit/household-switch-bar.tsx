import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { isHouseholdSwitchDisabled } from '@/lib/feature-flags';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HouseholdSwitchSheet } from '@/components/orbit/household-switch-sheet';
import { AppText as Text } from '@/components/orbit/app-text';
import { radius, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

/** Subtle bottom hint — only when the user belongs to 2+ households. */
export function HouseholdSwitchBar() {
  const insets = useSafeAreaInsets();
  const { household, householdMemberships, accentTheme } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const [open, setOpen] = useState(false);

  if (isHouseholdSwitchDisabled() || householdMemberships.length < 2) return null;

  const otherCount = householdMemberships.length - 1;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Switch household. Currently ${household.householdName}.`}
        onPress={() => setOpen(true)}
        style={[
          styles.bar,
          {
            bottom: insets.bottom + 74,
            backgroundColor: glass(0.72),
            borderColor: glassBorder(0.14),
          },
        ]}>
        <View style={[styles.dot, { backgroundColor: accentTheme.primary }]} />
        <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
          {household.householdName}
        </Text>
        <Text style={[styles.hint, { color: c.textMuted }]}>
          · {otherCount} other {otherCount === 1 ? 'household' : 'households'}
        </Text>
        <MaterialIcons name="unfold-more" size={16} color={c.textSubtle} />
      </Pressable>
      <HouseholdSwitchSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    alignSelf: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    left: space.lg,
    maxWidth: '88%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    position: 'absolute',
    right: space.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  dot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  name: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
  },
});

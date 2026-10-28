import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { GlassCard } from '@/components/orbit/glass-card';
import { typography } from '@/constants/orbit-theme';
import type { ActivityNames, ActivityTone } from '@/lib/activity/activity-timeline';
import { isAdminRole } from '@/lib/household/admins';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export type MaterialIconName = keyof typeof MaterialIcons.glyphMap;

/** Owner + admin (co-parent) only — mirrors `public.is_household_admin`. */
export function useIsHouseholdAdmin(): boolean {
  const { currentMember } = useOrbit();
  return Boolean(currentMember && isAdminRole(currentMember.role));
}

/** Resolve member ids / auth user ids to household names. */
export function useActivityNames(): ActivityNames {
  const { household } = useOrbit();
  return useMemo(() => {
    const members = household.members;
    return {
      memberName: (memberId) => members.find((member) => member.id === memberId)?.name ?? null,
      userName: (userId) => members.find((member) => member.userId === userId)?.name ?? null,
    };
  }, [household.members]);
}

export function useToneColor(): (tone: ActivityTone) => string {
  const { accentTheme } = useOrbit();
  const { c } = useOrbitColors();
  return (tone) => {
    switch (tone) {
      case 'success':
        return c.success;
      case 'warning':
        return c.warning;
      case 'danger':
        return c.danger;
      case 'info':
        return accentTheme.primary;
      default:
        return c.textMuted;
    }
  };
}

export function BackRow() {
  const { accentTheme } = useOrbit();
  return (
    <View style={styles.topRow}>
      <Pressable
        onPress={() => router.back()}
        style={styles.backBtn}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back">
        <MaterialIcons name="chevron-left" size={22} color={accentTheme.primary} />
        <Text style={[styles.backLabel, { color: accentTheme.primary }]}>Back</Text>
      </Pressable>
    </View>
  );
}

export function AdminOnlyNotice() {
  const { c } = useOrbitColors();
  return (
    <GlassCard>
      <Text style={[typography.headline, { color: c.text }]}>Admins only</Text>
      <Text style={[typography.footnote, { color: c.textMuted }]}>
        The activity log is visible to household admins.
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  topRow: { marginBottom: 4 },
  backBtn: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 2 },
  backLabel: { fontSize: 15, fontWeight: '600' },
});

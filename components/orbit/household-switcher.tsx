import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { ACCENT_THEMES } from '@/constants/accent-themes';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  canManageHouseholdDeletion,
  formatHouseholdDeletionDate,
  householdDeletionDaysRemaining,
  isHouseholdDeletionPending,
} from '@/lib/household/household-deletion';
import { isNamedHousehold } from '@/lib/household/household-recovery';
import { formatHouseholdRole } from '@/lib/permissions';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

type Props = {
  onSwitched?: () => void;
};

export function HouseholdSwitcher({ onSwitched }: Props) {
  const { household, householdMemberships, switchHousehold, isGuestInActiveHousehold } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();

  if (householdMemberships.length < 2) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: glass(), borderColor: glassBorder() }]}>
      <Text style={[typography.caption1, { color: c.textMuted, marginBottom: space.sm }]}>
        {isGuestInActiveHousehold ? 'Visiting another household' : 'Your households'}
      </Text>
      {householdMemberships.map((entry) => {
        const active = entry.householdId === household.id;
        const theme = ACCENT_THEMES.find((item) => item.id === entry.accentThemeId);
        const pendingDeletion = Boolean(entry.deletionScheduledFor);
        const canRecover =
          pendingDeletion &&
          canManageHouseholdDeletion(entry.role) &&
          isNamedHousehold(entry.householdName);
        return (
          <Pressable
            key={entry.householdId}
            disabled={active && !canRecover}
            onPress={() => {
              if (canRecover) {
                router.push(
                  `/household-recovery?householdId=${encodeURIComponent(entry.householdId)}` as never
                );
                return;
              }
              void switchHousehold(entry.householdId).then(() => onSwitched?.());
            }}
            style={[
              styles.row,
              {
                borderColor: active ? theme?.primary ?? c.accent : glassBorder(),
                backgroundColor: active ? `${theme?.primary ?? c.accent}14` : 'transparent',
              },
            ]}>
            <View style={[styles.dot, { backgroundColor: theme?.primary ?? c.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.subheadline, { color: c.text, fontWeight: '700' }]}>
                {entry.householdName}
              </Text>
              <Text style={[typography.caption2, { color: c.textMuted }]}>
                {entry.role === 'guest' ? 'Guest access' : formatHouseholdRole(entry.role)}
              </Text>
              {pendingDeletion && entry.deletionScheduledFor ? (
                <Text style={[typography.caption2, { color: '#FBBF24', marginTop: 2 }]}>
                  {canRecover ? 'Tap to recover · ' : ''}
                  Deleting in {householdDeletionDaysRemaining(entry.deletionScheduledFor)} days
                </Text>
              ) : null}
            </View>
            {active ? (
              <Text style={[typography.caption2, { color: theme?.primary ?? c.accent }]}>Active</Text>
            ) : null}
          </Pressable>
        );
      })}
      {isHouseholdDeletionPending(household) && household.deletionScheduledFor ? (
        <Text style={[typography.caption2, { color: c.textSubtle, textAlign: 'center' }]}>
          This household is scheduled for deletion on{' '}
          {formatHouseholdDeletionDate(household.deletionScheduledFor)}.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.card,
    borderWidth: 1,
    gap: space.sm,
    padding: space.md,
  },
  row: {
    alignItems: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  dot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
});

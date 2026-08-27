import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { ACCENT_THEMES } from '@/constants/accent-themes';
import { radius, space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export function HouseholdSwitcher() {
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
        return (
          <Pressable
            key={entry.householdId}
            disabled={active}
            onPress={() => void switchHousehold(entry.householdId)}
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
                {entry.role === 'guest' ? 'Guest access' : entry.role}
              </Text>
            </View>
            {active ? (
              <Text style={[typography.caption2, { color: theme?.primary ?? c.accent }]}>Active</Text>
            ) : null}
          </Pressable>
        );
      })}
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

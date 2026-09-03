import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  planAddHref,
  planAddOptionsForActor,
  type PlanAddOption,
} from '@/lib/calendar/sidekick-plan-add';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

function PlanAddRow({
  option,
  accent,
  onPress,
}: {
  option: PlanAddOption;
  accent: string;
  onPress: () => void;
}) {
  const { c, isDark, glassBorder } = useOrbitColors();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={option.title}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: glassFill(isDark),
          borderColor: glassBorder(0.08),
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: `${accent}14`, borderColor: `${accent}28` }]}>
        <MaterialIcons name={option.icon} size={20} color={accent} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: c.text }]}>{option.title}</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]} numberOfLines={2}>
          {option.subtitle}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
    </Pressable>
  );
}

/** Plan tab add menu — homework is instant; events respect Sidekick approval settings. */
export function PlanAddSheet({ visible, onDismiss }: Props) {
  const { accentTheme, currentMember, household, permissions } = useOrbit();
  const { c } = useOrbitColors();
  const caps = resolveMemberCapabilities(household);
  const isAdmin = permissions.canManageHousehold;
  const isSidekick = isSidekickRole(currentMember?.role);
  const options = planAddOptionsForActor({ isAdmin, isSidekick, caps });

  const handleSelect = (option: PlanAddOption) => {
    onDismiss();
    router.push(planAddHref(option) as never);
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} heightRatio={0.52} accentColor={accentTheme.primary}>
      <View style={styles.sheet}>
        <Text style={[typography.title2, styles.heading, { color: c.text }]}>Add to Plan</Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          {isSidekick && !caps.allowCalendarCreate
            ? 'Homework goes on your calendar right away.'
            : 'Homework is instant. School and activities may need a parent to approve.'}
        </Text>
        <View style={styles.list}>
          {options.map((option) => (
            <PlanAddRow
              key={option.id + option.route}
              option={option}
              accent={accentTheme.primary}
              onPress={() => handleSelect(option)}
            />
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: space.sm,
    paddingBottom: space.lg,
  },
  heading: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  lead: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: space.xs,
  },
  list: {
    gap: space.sm,
  },
  row: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  iconWrap: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
});

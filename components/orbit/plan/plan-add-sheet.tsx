import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      heightRatio={Math.min(0.7, 0.34 + options.length * 0.09)}
      accentColor={accentTheme.primary}>
      <View style={styles.sheet}>
        <View style={styles.headRow}>
          <Text style={[typography.title2, styles.heading, { color: c.text }]}>Add to Plan</Text>
          <Pressable
            onPress={onDismiss}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.close}>
            <MaterialIcons name="close" size={20} color={c.textMuted} />
          </Pressable>
        </View>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          {isSidekick && !caps.allowCalendarCreate
            ? 'Homework goes on your calendar right away.'
            : 'Homework is instant. School and activities may need a parent to approve.'}
        </Text>
        {/* The list scrolls — a household with every option on ran off the bottom. */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator
          bounces={false}>
          {options.map((option) => (
            <PlanAddRow
              key={option.id + option.route}
              option={option}
              accent={accentTheme.primary}
              onPress={() => handleSelect(option)}
            />
          ))}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    gap: space.sm,
    paddingBottom: space.xs,
  },
  headRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  close: { padding: 4 },
  scroll: { flex: 1 },
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
    paddingBottom: space.md,
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

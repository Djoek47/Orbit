import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { StreakDots } from '@/components/orbit/house-rules/visuals/streak-dots';
import { VOCAB } from '@/constants/vocabulary';
import { radius, space, typography } from '@/constants/orbit-theme';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { resolveHouseRulesPalette } from '@/lib/rules/house-rules-palette';
import { houseRulesHouseholdView } from '@/lib/rules/household-view';
import { formatHouseRulesTime, interpolateHouseRulesCopy, resolvedDailyDeadline } from '@/lib/rules/interpolate';
import { visibleRules } from '@/lib/rules/visible-rules';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember, HouseholdSnapshot } from '@/types/orbit';

type Props = {
  household: HouseholdSnapshot;
  currentMember?: HouseholdMember | null;
  accentColor: string;
  onPress: () => void;
};

/** Sidekick Home teaser — deadline, streak, and a peek at the rules manual. */
export function HomeHouseRulesCard({ household, currentMember, accentColor, onPress }: Props) {
  const { c, glassBorder } = useOrbitColors();
  const doc = getHouseRulesDoc();
  const view = houseRulesHouseholdView(household);
  const palette = resolveHouseRulesPalette('sidekick');
  const groups = visibleRules(doc, view);
  const deadlineHm = resolvedDailyDeadline(doc.constants, view);
  const deadlineLabel = formatHouseRulesTime(deadlineHm, view.use24h);
  const streak = currentMember?.streak ?? 0;
  const teaserRule =
    groups.find((g) => g.chapter.key === 'deadlines')?.rules[0] ??
    groups[0]?.rules[0] ??
    null;
  const teaser =
    teaserRule != null
      ? interpolateHouseRulesCopy(teaserRule.sidekick.headline, doc.constants, view)
      : 'Everything you need to know, in pictures.';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${VOCAB.houseRules}. ${teaser}`}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
      <LinearGradient
        colors={[`${accentColor}28`, `${accentColor}08`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { borderColor: `${accentColor}44` }]}>
        <View style={styles.topRow}>
          <View style={[styles.iconBadge, { backgroundColor: `${accentColor}33` }]}>
            <MaterialIcons name="menu-book" size={20} color={accentColor} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.headline, { color: c.text }]}>{VOCAB.houseRules}</Text>
            <Text style={[typography.caption1, { color: c.textMuted, marginTop: 2 }]} numberOfLines={2}>
              {teaser}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={c.textSubtle} />
        </View>

        <View style={[styles.statsRow, { borderTopColor: glassBorder(0.12) }]}>
          <View style={styles.stat}>
            <MaterialIcons name="schedule" size={16} color={accentColor} />
            <Text style={[styles.statLabel, { color: c.textMuted }]}>Finish by</Text>
            <Text style={[styles.statValue, { color: c.text }]}>{deadlineLabel}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: glassBorder(0.14) }]} />
          <View style={styles.stat}>
            <MaterialIcons name="local-fire-department" size={16} color="#FB923C" />
            <Text style={[styles.statLabel, { color: c.textMuted }]}>Streak</Text>
            <Text style={[styles.statValue, { color: c.text }]}>
              {streak} day{streak === 1 ? '' : 's'}
            </Text>
          </View>
        </View>

        <View style={styles.visualRow}>
          <StreakDots constants={doc.constants} palette={palette} voice="sidekick" />
          <Text style={[typography.caption2, { color: c.textSubtle, flex: 1 }]}>
            Tap to open the full guide
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.cardLarge,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  gradient: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.md,
    padding: space.md,
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: space.sm,
  },
  iconBadge: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  statsRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.md,
    paddingTop: space.sm,
  },
  stat: {
    alignItems: 'flex-start',
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  divider: {
    alignSelf: 'stretch',
    width: StyleSheet.hairlineWidth,
  },
  visualRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
});

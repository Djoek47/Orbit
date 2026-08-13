import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { RuleCopy } from '@/components/orbit/house-rules/rule-copy';
import { RuleVisual } from '@/components/orbit/house-rules/visuals';
import type { HouseRulesPalette, HouseRulesVoice } from '@/lib/rules/house-rules-palette';
import { interpolateHouseRulesCopy } from '@/lib/rules/interpolate';
import type { RuleConstants } from '@/lib/rules/types';
import type { VisibleChapter } from '@/lib/rules/visible-rules';

type Props = {
  groups: VisibleChapter[];
  voice: HouseRulesVoice;
  palette: HouseRulesPalette;
  constants: RuleConstants;
  canEdit: boolean;
  onEdit?: (settingKey?: string) => void;
  activeRewardModel?: string;
};

/**
 * Direction 02 — At a glance.
 * Numbers → pictures. Prose-only rules → quiet outlined cards.
 */
export function AtAGlanceView({
  groups,
  voice,
  palette,
  constants,
  canEdit,
  onEdit,
  activeRewardModel,
}: Props) {
  return (
    <View style={styles.stack}>
      <View style={styles.pageTitle}>
        <Text style={[voice === 'kid' ? styles.kidH3 : styles.h3, { color: palette.title }]}>
          {voice === 'kid' ? 'The rules' : 'House Rules'}
        </Text>
        {voice === 'kid' ? (
          <Text style={[styles.kidSub, { color: palette.muted }]}>
            Everything you need, in pictures.
          </Text>
        ) : null}
      </View>

      {groups.map(({ chapter, rules }) => (
        <View key={chapter.key} style={styles.group}>
          {voice === 'adult' ? (
            <Text style={[styles.groupHead, { color: palette.groupHead }]}>{chapter.adultLabel}</Text>
          ) : null}
          {rules.map((rule) => {
            const headline =
              voice === 'kid'
                ? interpolateHouseRulesCopy(rule.kid.headline, constants)
                : interpolateHouseRulesCopy(rule.adult.headline, constants);
            const body =
              voice === 'kid'
                ? interpolateHouseRulesCopy(rule.kid.body, constants)
                : interpolateHouseRulesCopy(rule.adult.clause, constants);
            const quiet = voice === 'adult' && rule.visual === 'none';
            const lab = rule.displayNumber;
            return (
              <View
                key={rule.id}
                style={[
                  voice === 'kid' ? styles.kcard : styles.card,
                  quiet ? styles.quiet : null,
                  {
                    backgroundColor:
                      voice === 'kid' ? palette.card : quiet ? 'transparent' : palette.card,
                    borderColor: quiet ? palette.quietBorder : palette.cardBorder,
                  },
                ]}
                accessible
                accessibilityLabel={`${headline}. ${body}`}>
                {voice === 'adult' ? (
                  <View style={styles.top}>
                    <Text style={[styles.lab, { color: palette.muted }]}>{lab}</Text>
                    {canEdit && rule.editable ? (
                      <Pressable onPress={() => onEdit?.(rule.settingKey)} hitSlop={8}>
                        <Text style={[styles.edit, { color: palette.nav }]}>Edit</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                <Text style={[voice === 'kid' ? styles.kidH4 : styles.h4, { color: palette.ink }]}>
                  {headline}
                </Text>
                <RuleVisual
                  visual={rule.visual}
                  constants={constants}
                  palette={palette}
                  voice={voice}
                  variant={rule.visual === 'lateCreditTable' ? 'table' : undefined}
                  activeRewardModel={activeRewardModel}
                />
                <RuleCopy
                  text={body}
                  constants={constants}
                  voice={voice}
                  color={palette.inkSoft}
                  boldColor={palette.ink}
                  numtagBg={palette.pillBg}
                  numtagColor={palette.pillText}
                  style={voice === 'kid' ? { fontSize: 13.5, lineHeight: 20 } : { fontSize: 13, lineHeight: 19 }}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: 44 },
  pageTitle: { marginBottom: 2 },
  h3: { fontSize: 29, fontWeight: '700', letterSpacing: -0.4 },
  kidH3: { fontSize: 31, fontWeight: '800', letterSpacing: -0.5 },
  kidSub: { fontSize: 13, marginTop: 5 },
  group: { gap: 12 },
  groupHead: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    paddingTop: 12,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: 17,
    paddingHorizontal: 16,
    paddingTop: 15,
  },
  quiet: { borderWidth: 1, paddingVertical: 14 },
  kcard: {
    borderRadius: 20,
    borderWidth: 2,
    paddingBottom: 18,
    paddingHorizontal: 17,
    paddingTop: 16,
  },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  lab: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' },
  edit: { fontSize: 12, fontWeight: '600' },
  h4: { fontSize: 16, fontWeight: '700', marginBottom: 4, marginTop: 7 },
  kidH4: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 6 },
});

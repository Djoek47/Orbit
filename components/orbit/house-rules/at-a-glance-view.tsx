import { Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { AppText as Text } from '@/components/orbit/app-text';
import { RuleCopy } from '@/components/orbit/house-rules/rule-copy';
import { RuleVisual } from '@/components/orbit/house-rules/visuals';
import {
  sidekickRoleColor,
  type HouseRulesPalette,
  type HouseRulesVoice,
} from '@/lib/rules/house-rules-palette';
import { interpolateHouseRulesCopy } from '@/lib/rules/interpolate';
import type { HouseRulesHouseholdView, RuleConstants } from '@/lib/rules/types';
import type { VisibleChapter } from '@/lib/rules/visible-rules';

type Props = {
  groups: VisibleChapter[];
  voice: HouseRulesVoice;
  palette: HouseRulesPalette;
  constants: RuleConstants;
  household: HouseRulesHouseholdView;
  canEdit: boolean;
  onEdit?: (settingKey?: string) => void;
  activeRewardModel?: string;
  switcher?: ReactNode;
};

export function AtAGlanceView({
  groups,
  voice,
  palette,
  constants,
  household,
  canEdit,
  onEdit,
  activeRewardModel,
  switcher,
}: Props) {
  const total = groups.reduce((sum, g) => sum + g.rules.length, 0);

  return (
    <View style={styles.stack}>
      <View style={styles.pageTitle}>
        <Text style={[voice === 'sidekick' ? styles.skH3 : styles.h3, { color: palette.title }]}>
          {voice === 'sidekick' ? 'The rules' : 'House Rules'}
        </Text>
        {voice === 'sidekick' ? (
          <Text style={[styles.skSub, { color: palette.muted }]}>
            Everything you need to know, in pictures.
          </Text>
        ) : (
          <Text style={[styles.adminSub, { color: palette.muted }]}>
            {groups.length} chapters · {total} rules
          </Text>
        )}
      </View>
      {switcher}

      {groups.map(({ chapter, rules }) => {
        const headColor =
          voice === 'sidekick' ? sidekickRoleColor(chapter.sidekickColor) : palette.groupHead;
        const headLabel = voice === 'sidekick' ? chapter.sidekickLabel : chapter.adminLabel;
        return (
          <View key={chapter.key} style={styles.group}>
            <Text style={[styles.groupHead, { color: headColor }]}>
              {headLabel}
              {voice === 'admin' ? (
                <Text style={[styles.groupCount, { color: '#6F819C' }]}>{` · ${rules.length}`}</Text>
              ) : null}
            </Text>
            {rules.map((rule) => {
              const headline =
                voice === 'sidekick'
                  ? interpolateHouseRulesCopy(rule.sidekick.headline, constants, household)
                  : interpolateHouseRulesCopy(rule.admin.headline, constants, household);
              const body =
                voice === 'sidekick'
                  ? interpolateHouseRulesCopy(rule.sidekick.body, constants, household)
                  : interpolateHouseRulesCopy(rule.admin.clause, constants, household);
              const quiet = voice === 'admin' && rule.visual === 'none';
              return (
                <View
                  key={rule.id}
                  style={[
                    voice === 'sidekick' ? styles.kcard : styles.card,
                    quiet ? styles.quiet : null,
                    {
                      backgroundColor:
                        voice === 'sidekick' ? palette.card : quiet ? 'transparent' : palette.card,
                      borderColor: quiet ? palette.quietBorder : palette.cardBorder,
                    },
                  ]}
                  accessible
                  accessibilityLabel={`${headline}. ${body}`}>
                  {voice === 'admin' && canEdit && rule.editable ? (
                    <View style={styles.top}>
                      <View />
                      <Pressable onPress={() => onEdit?.(rule.settingKey)} hitSlop={8}>
                        <Text style={[styles.edit, { color: palette.nav }]}>Edit</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <Text style={[voice === 'sidekick' ? styles.skH4 : styles.h4, { color: palette.ink }]}>
                    {headline}
                  </Text>
                  <RuleVisual
                    visual={rule.visual}
                    constants={constants}
                    palette={palette}
                    voice={voice}
                    activeRewardModel={activeRewardModel}
                    dailyDeadline={household.dailyDeadline ?? undefined}
                    use24h={household.use24h}
                  />
                  <RuleCopy text={body} voice={voice} color={palette.inkSoft} />
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: 44 },
  pageTitle: { marginBottom: 2, paddingTop: 8 },
  h3: { fontSize: 29, fontWeight: '700', letterSpacing: -0.4 },
  skH3: { fontSize: 31, fontWeight: '800', letterSpacing: -0.5 },
  skSub: { fontSize: 13, marginTop: 6 },
  adminSub: { fontSize: 12.5, marginTop: 6 },
  group: { gap: 12 },
  groupHead: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingTop: 16,
    textTransform: 'uppercase',
  },
  groupCount: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2, textTransform: 'none' },
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
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end' },
  edit: { fontSize: 12, fontWeight: '600' },
  h4: { fontSize: 16, fontWeight: '700', marginBottom: 5 },
  skH4: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 6 },
});

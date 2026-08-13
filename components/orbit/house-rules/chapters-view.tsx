import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { RuleCopy } from '@/components/orbit/house-rules/rule-copy';
import { LateCreditTable } from '@/components/orbit/house-rules/visuals/late-credit-table';
import {
  chapterAccentColor,
  HR,
  type HouseRulesPalette,
  type HouseRulesVoice,
} from '@/lib/rules/house-rules-palette';
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
};

/** Direction 01 — Chapters. Admin: espresso spine cards. Sidekick: paper + color tabs. */
export function ChaptersView({
  groups,
  voice,
  palette,
  constants,
  canEdit,
  onEdit,
}: Props) {
  if (voice === 'kid') {
    return (
      <View style={styles.stack}>
        <View style={styles.pageTitle}>
          <Text style={[styles.kidH3, { color: palette.title }]}>How it works</Text>
          <Text style={[styles.kidSub, { color: palette.muted }]}>
            Everything, in order. Nothing hidden.
          </Text>
        </View>
        {groups.map(({ chapter, rules }) => {
          const tab = chapterAccentColor(undefined, chapter.accent, chapter.kidColor, 'kid');
          return (
            <View key={chapter.key} style={styles.kidCard}>
              <View style={[styles.kidTab, { backgroundColor: tab }]}>
                <Text style={styles.kidTabLabel}>{chapter.kidLabel}</Text>
              </View>
              {rules.map((rule, index) => {
                const headline = interpolateHouseRulesCopy(rule.kid.headline, constants);
                const body = interpolateHouseRulesCopy(rule.kid.body, constants);
                return (
                  <View key={rule.id}>
                    {index > 0 ? <View style={styles.kidDivider} /> : null}
                    <View
                      style={styles.kidRule}
                      accessible
                      accessibilityLabel={`${headline}. ${body}`}>
                      <Text style={[styles.kidHeadline, { color: palette.ink }]}>{headline}</Text>
                      <RuleCopy
                        text={body}
                        constants={constants}
                        voice="kid"
                        color={palette.inkSoft}
                        boldColor={palette.ink}
                        numtagBg={palette.pillBg}
                        numtagColor={palette.pillText}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.pageTitle}>
        <Text style={[styles.adultH3, { color: palette.title }]}>House Rules</Text>
        <Text style={[styles.adultSub, { color: palette.muted }]}>
          {groups.length} chapters · {groups.reduce((n, g) => n + g.rules.length, 0)} rules
        </Text>
      </View>
      {groups.map(({ chapter, rules }) => {
        const spine = chapterAccentColor(undefined, chapter.accent, chapter.kidColor, 'adult');
        return (
          <View
            key={chapter.key}
            style={[styles.chapter, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
            <View style={[styles.spine, { backgroundColor: palette.spineBg }]}>
              <Text style={[styles.spineLabel, { color: spine }]}>{chapter.adultLabel}</Text>
            </View>
            <View style={styles.inner}>
              <Text style={[styles.count, { color: palette.foot }]}>
                Chapter {chapter.order} · {rules.length} {rules.length === 1 ? 'rule' : 'rules'}
              </Text>
              {rules.map((rule, index) => {
                const headline = interpolateHouseRulesCopy(rule.adult.headline, constants);
                const clause = interpolateHouseRulesCopy(rule.adult.clause, constants);
                const last = index === rules.length - 1;
                return (
                  <View
                    key={rule.id}
                    style={[
                      styles.clause,
                      { borderBottomColor: '#3A2D22', borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
                    ]}
                    accessible
                    accessibilityLabel={`${headline}. ${clause}`}>
                    <Text style={[styles.clauseN, { color: HR.ember }]}>{rule.displayNumber}</Text>
                    <View style={styles.clauseBody}>
                      <View style={styles.clauseTop}>
                        {canEdit && rule.editable ? (
                          <Pressable onPress={() => onEdit?.(rule.settingKey)} hitSlop={8}>
                            <Text style={[styles.edit, { color: palette.nav }]}>Edit</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <RuleCopy
                        text={clause}
                        constants={constants}
                        voice="adult"
                        color={palette.clause}
                        boldColor="#fff"
                        numtagBg={palette.pillBg}
                        numtagColor={palette.pillText}
                      />
                      {rule.visual === 'lateCreditTable' ? (
                        <LateCreditTable
                          constants={constants}
                          palette={palette}
                          voice="adult"
                          variant="pills"
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14, paddingBottom: 44 },
  pageTitle: { marginBottom: 4 },
  adultH3: { fontSize: 30, fontWeight: '700', letterSpacing: -0.4 },
  adultSub: { fontSize: 12.5, marginTop: 5 },
  kidH3: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  kidSub: { fontSize: 13, fontWeight: '500', marginTop: 5 },
  chapter: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  spine: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
  },
  spineLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.4,
    textAlign: 'center',
    textTransform: 'uppercase',
    transform: [{ rotate: '-90deg' }],
    width: 140,
  },
  inner: { flex: 1, minWidth: 0, paddingBottom: 18, paddingHorizontal: 16, paddingTop: 16 },
  count: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  clause: {
    flexDirection: 'row',
    gap: 11,
    paddingVertical: 11,
  },
  clauseN: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    minWidth: 26,
    paddingTop: 3,
  },
  clauseBody: { flex: 1, minWidth: 0 },
  clauseTop: { alignItems: 'flex-end' },
  edit: { fontSize: 12, fontWeight: '600' },
  kidCard: {
    backgroundColor: HR.kidCard,
    borderRadius: 20,
    overflow: 'hidden',
    paddingBottom: 14,
    shadowColor: HR.kidInk,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 2,
  },
  kidTab: { paddingHorizontal: 18, paddingVertical: 11 },
  kidTabLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  kidDivider: {
    backgroundColor: '#F0E7DA',
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 18,
    marginTop: 13,
  },
  kidRule: { paddingHorizontal: 18, paddingTop: 13 },
  kidHeadline: {
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
});

import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { RuleVisual } from '@/components/orbit/house-rules/visuals';
import { space, typography } from '@/constants/orbit-theme';
import {
  chapterAccentColor,
  HR,
  type HouseRulesPalette,
  type HouseRulesVoice,
} from '@/lib/rules/house-rules-palette';
import type { RuleConstants } from '@/lib/rules/types';
import { substituteTokens, type VisibleChapter } from '@/lib/rules/visible-rules';

type Props = {
  groups: VisibleChapter[];
  voice: HouseRulesVoice;
  palette: HouseRulesPalette;
  constants: RuleConstants;
  tokens: Record<string, string>;
  canEdit: boolean;
  onEdit?: (settingKey?: string) => void;
};

/** Direction 01 — Chapters. Adult: espresso spine cards. Kid: paper + color tabs. */
export function ChaptersView({
  groups,
  voice,
  palette,
  constants,
  tokens,
  canEdit,
  onEdit,
}: Props) {
  if (voice === 'kid') {
    return (
      <View style={styles.stack}>
        <View style={styles.pageTitle}>
          <Text style={[styles.kidH3, { color: palette.title }]}>How it works</Text>
          <Text style={[typography.footnote, { color: palette.muted, marginTop: 5 }]}>
            Everything, in order. Nothing hidden.
          </Text>
        </View>
        {groups.map(({ chapter, rules }) => {
          const tab = chapterAccentColor(undefined, chapter.accent, chapter.kidColor, 'kid');
          return (
            <View key={chapter.key} style={[styles.kidCard, { shadowColor: HR.kidInk }]}>
              <View style={[styles.kidTab, { backgroundColor: tab }]}>
                <Text style={styles.kidTabLabel}>{chapter.kidLabel}</Text>
              </View>
              {rules.map((rule, index) => {
                const headline = substituteTokens(rule.kid.headline, tokens);
                const body = substituteTokens(rule.kid.body, tokens);
                return (
                  <View key={rule.id}>
                    {index > 0 ? <View style={styles.kidDivider} /> : null}
                    <View style={styles.kidRule}>
                      <Text style={[styles.kidHeadline, { color: palette.ink }]}>{headline}</Text>
                      <Text style={[styles.kidBody, { color: palette.inkSoft }]}>{body}</Text>
                      <RuleVisual
                        visual={rule.visual}
                        constants={constants}
                        palette={palette}
                        voice="kid"
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
        <Text style={[typography.caption1, { color: palette.muted, marginTop: 5 }]}>
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
                Chapter · {rules.length} {rules.length === 1 ? 'rule' : 'rules'}
              </Text>
              {rules.map((rule) => {
                const clause = substituteTokens(rule.adult.clause, tokens);
                return (
                  <View key={rule.id} style={[styles.clause, { borderBottomColor: '#3A2D22' }]}>
                    <View style={styles.clauseTop}>
                      <Text style={[styles.clauseN, { color: HR.ember }]}>{rule.displayNumber}</Text>
                      {canEdit && rule.editable ? (
                        <Pressable onPress={() => onEdit?.(rule.settingKey)} hitSlop={8}>
                          <Text style={[typography.caption1, { color: palette.nav }]}>Edit</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={[styles.clauseP, { color: palette.clause }]}>{clause}</Text>
                    <RuleVisual
                      visual={rule.visual}
                      constants={constants}
                      palette={palette}
                      voice="adult"
                    />
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
  stack: { gap: 14, paddingBottom: space.xl },
  pageTitle: { marginBottom: 4 },
  adultH3: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  kidH3: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
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
    textTransform: 'uppercase',
    transform: [{ rotate: '-90deg' }],
    width: 120,
    textAlign: 'center',
  },
  inner: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 16,
  },
  count: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  clause: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingVertical: 11,
  },
  clauseTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clauseN: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 26,
  },
  clauseP: {
    fontSize: 14,
    lineHeight: 20,
  },
  kidCard: {
    backgroundColor: HR.kidCard,
    borderRadius: 20,
    overflow: 'hidden',
    paddingBottom: 14,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 2,
  },
  kidTab: {
    alignSelf: 'flex-start',
    borderBottomRightRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
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
  kidRule: {
    paddingHorizontal: 18,
    paddingTop: 13,
  },
  kidHeadline: {
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  kidBody: {
    fontSize: 13.5,
    lineHeight: 20,
  },
});

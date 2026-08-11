import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { RuleVisual } from '@/components/orbit/house-rules/visuals';
import { space, typography } from '@/constants/orbit-theme';
import {
  chapterAccentColor,
  type HouseRulesPalette,
  type HouseRulesVoice,
} from '@/lib/rules/house-rules-palette';
import type { RuleConstants } from '@/lib/rules/types';
import { substituteTokens, type VisibleChapter } from '@/lib/rules/visible-rules';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  groups: VisibleChapter[];
  voice: HouseRulesVoice;
  palette: HouseRulesPalette;
  constants: RuleConstants;
  tokens: Record<string, string>;
  canEdit: boolean;
  onEdit?: (settingKey?: string) => void;
};

export function ChaptersView({
  groups,
  voice,
  palette,
  constants,
  tokens,
  canEdit,
  onEdit,
}: Props) {
  const { c } = useOrbitColors();

  if (voice === 'kid') {
    return (
      <View style={styles.stack}>
        {groups.map(({ chapter, rules }) => {
          const tab = chapterAccentColor(c, chapter.accent, chapter.kidColor, 'kid');
          return (
            <View
              key={chapter.key}
              style={[styles.kidCard, { backgroundColor: palette.surfaceSoft, borderColor: palette.cardBorder }]}>
              <View style={[styles.kidTab, { backgroundColor: tab }]}>
                <Text style={[typography.caption1, { color: '#fff', fontWeight: '800' }]}>
                  {chapter.kidLabel}
                </Text>
              </View>
              {rules.map((rule) => {
                const headline = substituteTokens(rule.kid.headline, tokens);
                const body = substituteTokens(rule.kid.body, tokens);
                return (
                  <View key={rule.id} style={styles.kidRule}>
                    <Text style={[typography.title3, { color: palette.ink }]}>{headline}</Text>
                    <Text style={[typography.body, { color: palette.inkSoft, marginTop: 4 }]}>{body}</Text>
                    <RuleVisual
                      visual={rule.visual}
                      constants={constants}
                      palette={palette}
                      voice="kid"
                    />
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
      {groups.map(({ chapter, rules }) => {
        const spine = chapterAccentColor(c, chapter.accent, chapter.kidColor, 'adult');
        return (
          <View key={chapter.key} style={styles.chapterBlock}>
            <View style={styles.chapterHead}>
              <View style={[styles.spine, { backgroundColor: `${spine}33` }]}>
                <Text style={[styles.spineLabel, { color: spine }]}>{chapter.adultLabel}</Text>
              </View>
              <View style={[styles.spineLine, { backgroundColor: `${spine}44` }]} />
            </View>
            {rules.map((rule) => {
              const clause = substituteTokens(rule.adult.clause, tokens);
              const isLateCredit = rule.id.includes('DEAD') || rule.phase === 'lateCredit';
              return (
                <View
                  key={rule.id}
                  style={[styles.ruleCard, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
                  <View style={styles.ruleTop}>
                    <Text style={[typography.caption2, { color: palette.muted }]}>
                      {rule.displayNumber}
                    </Text>
                    {canEdit && rule.editable ? (
                      <Pressable onPress={() => onEdit?.(rule.settingKey)} hitSlop={8}>
                        <Text style={[typography.caption1, { color: palette.accent }]}>Edit</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={[typography.body, { color: palette.ink }]}>{clause}</Text>
                  {isLateCredit && rule.phase === 'lateCredit' ? (
                    <View style={styles.pillRow}>
                      <View style={[styles.pill, { backgroundColor: `${palette.warn}28` }]}>
                        <Text style={[typography.caption2, { color: palette.warn, fontWeight: '700' }]}>
                          Late Credit
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {rule.phase === 'expired' ? (
                    <View style={styles.pillRow}>
                      <View style={[styles.pill, { backgroundColor: `${palette.danger}28` }]}>
                        <Text style={[typography.caption2, { color: palette.danger, fontWeight: '700' }]}>
                          Expired
                        </Text>
                      </View>
                    </View>
                  ) : null}
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
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md, paddingBottom: space.xl },
  chapterBlock: { gap: space.sm },
  chapterHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  spine: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  spineLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  spineLine: { flex: 1, height: 2, borderRadius: 1 },
  ruleCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: 4,
  },
  ruleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pillRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  kidCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingBottom: space.md,
  },
  kidTab: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomRightRadius: 14,
  },
  kidRule: { paddingHorizontal: space.md, paddingTop: space.md },
});

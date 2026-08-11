import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { RuleVisual } from '@/components/orbit/house-rules/visuals';
import { space, typography } from '@/constants/orbit-theme';
import type { HouseRulesPalette, HouseRulesVoice } from '@/lib/rules/house-rules-palette';
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

/**
 * Direction 02 — At a glance.
 * Numbers → pictures (filled cards). Prose-only rules → quiet outlined cards.
 * Group headers keep long lists navigable.
 */
export function AtAGlanceView({
  groups,
  voice,
  palette,
  constants,
  tokens,
  canEdit,
  onEdit,
}: Props) {
  return (
    <View style={styles.stack}>
      <View style={styles.pageTitle}>
        <Text style={[styles.h3, { color: palette.title }]}>
          {voice === 'kid' ? 'The rules' : 'House Rules'}
        </Text>
        <Text style={[typography.footnote, { color: palette.muted, marginTop: 5 }]}>
          {voice === 'kid'
            ? 'Everything you need, in pictures.'
            : 'How one day runs, from assigned to counted.'}
        </Text>
      </View>

      {groups.map(({ chapter, rules }) => (
        <View key={chapter.key} style={styles.group}>
          <Text style={[styles.groupHead, { color: palette.groupHead }]}>
            {voice === 'kid' ? chapter.kidLabel : chapter.adultLabel}
          </Text>
          {rules.map((rule) => {
            const headline =
              voice === 'kid'
                ? substituteTokens(rule.kid.headline, tokens)
                : substituteTokens(rule.adult.headline, tokens);
            const body =
              voice === 'kid'
                ? substituteTokens(rule.kid.body, tokens)
                : substituteTokens(rule.adult.clause, tokens);
            const quiet = voice === 'adult' && rule.visual === 'none';
            return (
              <View
                key={rule.id}
                style={[
                  styles.card,
                  quiet ? styles.quiet : null,
                  {
                    backgroundColor: quiet ? 'transparent' : palette.card,
                    borderColor: quiet ? palette.quietBorder : palette.cardBorder,
                  },
                ]}>
                <View style={styles.top}>
                  <Text style={[styles.lab, { color: palette.muted }]}>
                    {voice === 'kid' ? chapter.kidLabel.toUpperCase() : rule.displayNumber}
                  </Text>
                  {canEdit && rule.editable && voice === 'adult' ? (
                    <Pressable onPress={() => onEdit?.(rule.settingKey)} hitSlop={8}>
                      <Text style={[typography.caption1, { color: palette.nav }]}>Edit</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={[styles.h4, { color: palette.ink }]}>{headline}</Text>
                <Text style={[styles.body, { color: palette.inkSoft }]}>{body}</Text>
                <RuleVisual
                  visual={rule.visual}
                  constants={constants}
                  palette={palette}
                  voice={voice}
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
  stack: { gap: 12, paddingBottom: space.xl },
  pageTitle: { marginBottom: 2 },
  h3: {
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
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
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 17,
  },
  quiet: {
    borderWidth: 1,
    paddingVertical: 14,
  },
  top: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lab: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  h4: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 7,
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
});

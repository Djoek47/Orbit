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

/** One card per visible rule — Adult navy-mapped / Kid dark-blue surface via palette. */
export function AtAGlanceView({
  groups,
  voice,
  palette,
  constants,
  tokens,
  canEdit,
  onEdit,
}: Props) {
  const rules = groups.flatMap((g) =>
    g.rules.map((rule) => ({ rule, chapter: g.chapter }))
  );

  return (
    <View style={styles.stack}>
      {rules.map(({ rule, chapter }) => {
        const headline =
          voice === 'kid'
            ? substituteTokens(rule.kid.headline, tokens)
            : substituteTokens(rule.adult.headline, tokens);
        const body =
          voice === 'kid'
            ? substituteTokens(rule.kid.body, tokens)
            : substituteTokens(rule.adult.clause, tokens);
        return (
          <View
            key={rule.id}
            style={[
              styles.card,
              {
                backgroundColor: palette.card,
                borderColor: palette.cardBorder,
              },
            ]}>
            <View style={styles.top}>
              <Text style={[typography.caption2, { color: palette.muted }]}>
                {voice === 'kid' ? chapter.kidLabel : `${rule.displayNumber} · ${chapter.adultLabel}`}
              </Text>
              {canEdit && rule.editable && voice === 'adult' ? (
                <Pressable onPress={() => onEdit?.(rule.settingKey)} hitSlop={8}>
                  <Text style={[typography.caption1, { color: palette.accent }]}>Edit</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={[typography.title3, { color: palette.ink, marginTop: 4 }]}>{headline}</Text>
            <Text style={[typography.body, { color: palette.inkSoft, marginTop: 6 }]}>{body}</Text>
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
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md, paddingBottom: space.xl },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

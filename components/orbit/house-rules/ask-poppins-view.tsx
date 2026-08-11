import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { space, typography } from '@/constants/orbit-theme';
import type { HouseRulesPalette, HouseRulesVoice } from '@/lib/rules/house-rules-palette';
import { searchHouseRules } from '@/lib/rules/search';
import { substituteTokens, type VisibleChapter } from '@/lib/rules/visible-rules';

type Props = {
  groups: VisibleChapter[];
  voice: HouseRulesVoice;
  palette: HouseRulesPalette;
  tokens: Record<string, string>;
};

const SUGGESTIONS = ['late', 'streak', 'crown', 'xp', 'homework'];

export function AskPoppinsView({ groups, voice, palette, tokens }: Props) {
  const [query, setQuery] = useState('');
  const hits = useMemo(
    () => searchHouseRules(groups, query, voice),
    [groups, query, voice]
  );

  // Adult: grouped Q&A for all visible when empty; filtered when typing
  const adultRows = useMemo(() => {
    if (voice !== 'adult') return [];
    if (query.trim()) return hits;
    return groups.flatMap((g) =>
      g.rules.map((rule) => ({ ...rule, chapterLabel: g.chapter.adultLabel }))
    );
  }, [groups, hits, query, voice]);

  if (voice === 'kid') {
    return (
      <View style={styles.stack}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ask Poppins…"
          placeholderTextColor={palette.muted}
          style={[
            styles.input,
            {
              backgroundColor: palette.surfaceSoft,
              borderColor: palette.cardBorder,
              color: palette.ink,
            },
          ]}
        />
        <View style={styles.chips}>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setQuery(s)}
              style={[styles.chip, { backgroundColor: palette.chipBg }]}>
              <Text style={[typography.caption1, { color: palette.accent, fontWeight: '600' }]}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.chat}>
          {(query.trim() ? hits : groups.flatMap((g) => g.rules).slice(0, 6)).map((rule) => {
            const ask = substituteTokens(rule.kid.question, tokens);
            const ans = substituteTokens(rule.kid.body, tokens);
            return (
              <View key={rule.id} style={styles.pair}>
                <View style={[styles.ask, { backgroundColor: palette.askBubble }]}>
                  <Text style={[typography.footnote, { color: '#fff', fontWeight: '600' }]}>{ask}</Text>
                </View>
                <View style={[styles.ans, { backgroundColor: palette.ansBubble, borderColor: palette.cardBorder }]}>
                  <Text style={[typography.caption2, { color: palette.accent, fontWeight: '800', marginBottom: 4 }]}>
                    POPPINS
                  </Text>
                  <Text style={[typography.body, { color: palette.ink }]}>{ans}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search house rules…"
        placeholderTextColor={palette.muted}
        style={[
          styles.input,
          {
            backgroundColor: palette.surfaceSoft,
            borderColor: palette.cardBorder,
            color: palette.ink,
          },
        ]}
      />
      {adultRows.map((rule) => {
        const q = substituteTokens(rule.adult.question, tokens);
        const a = substituteTokens(rule.adult.clause, tokens);
        return (
          <View
            key={rule.id}
            style={[styles.qa, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
            <Text style={[typography.caption2, { color: palette.muted }]}>
              {rule.chapterLabel ?? rule.displayNumber}
            </Text>
            <Text style={[typography.subheadline, { color: palette.accent, marginTop: 4, fontWeight: '700' }]}>
              {q}
            </Text>
            <Text style={[typography.body, { color: palette.ink, marginTop: 6 }]}>{a}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md, paddingBottom: space.xl },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  chat: { gap: space.md },
  pair: { gap: 8 },
  ask: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    borderRadius: 18,
    borderBottomRightRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ans: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  qa: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
  },
});

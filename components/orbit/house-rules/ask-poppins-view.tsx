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

const KID_CHIPS = [
  "What's a bundle bonus?",
  "What's a trophy?",
  'Who assigns my jobs?',
  'Can rules change?',
];

/** Direction 04 — Ask Poppins. Adult: searchable Q&A. Kid: chat cards. */
export function AskPoppinsView({ groups, voice, palette, tokens }: Props) {
  const [query, setQuery] = useState('');
  const hits = useMemo(
    () => searchHouseRules(groups, query, voice),
    [groups, query, voice]
  );

  if (voice === 'kid') {
    const rows = query.trim()
      ? hits
      : groups.flatMap((g) => g.rules).slice(0, 10);
    return (
      <View style={styles.stack}>
        <View style={styles.pageTitle}>
          <Text style={[styles.kidH3, { color: palette.title }]}>Ask Poppins</Text>
          <Text style={[typography.footnote, { color: palette.muted, marginTop: 5 }]}>
            Tap a question. Or just ask your own.
          </Text>
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ask your own…"
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
          {KID_CHIPS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setQuery(s)}
              style={[styles.chip, { borderColor: palette.accent, backgroundColor: palette.chipBg }]}>
              <Text style={[typography.caption1, { color: palette.accent, fontWeight: '600' }]}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.chat}>
          {rows.map((rule) => {
            const ask = substituteTokens(rule.kid.question, tokens);
            const ans = substituteTokens(rule.kid.body, tokens);
            return (
              <View key={rule.id} style={styles.pair}>
                <View style={[styles.ask, { backgroundColor: palette.askBubble }]}>
                  <Text style={[typography.footnote, { color: '#fff', fontWeight: '600' }]}>{ask}</Text>
                </View>
                <View
                  style={[
                    styles.ans,
                    { backgroundColor: palette.ansBubble, borderColor: palette.cardBorder },
                  ]}>
                  <Text
                    style={[
                      typography.caption2,
                      { color: palette.accent, fontWeight: '800', marginBottom: 4, letterSpacing: 1 },
                    ]}>
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
      <View style={styles.pageTitle}>
        <Text style={[styles.adultH3, { color: palette.title }]}>House Rules</Text>
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search the rules"
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
      {groups.map(({ chapter, rules }) => {
        const chapterHits = query.trim()
          ? rules.filter((r) => hits.some((h) => h.id === r.id))
          : rules;
        if (!chapterHits.length) return null;
        return (
          <View key={chapter.key} style={styles.group}>
            <Text style={[styles.groupLab, { color: palette.groupHead }]}>{chapter.adultLabel}</Text>
            {chapterHits.map((rule) => {
              const q = substituteTokens(rule.adult.question, tokens);
              const a = substituteTokens(rule.adult.clause, tokens);
              return (
                <View key={rule.id} style={[styles.qa, { borderBottomColor: palette.quietBorder }]}>
                  <Text style={[styles.q, { color: palette.ink }]}>{q}</Text>
                  <Text style={[styles.a, { color: palette.inkSoft }]}>{a}</Text>
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
  pageTitle: { marginBottom: 2 },
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
  input: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chat: { gap: space.md },
  pair: { gap: 8 },
  ask: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5,
    borderRadius: 18,
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ans: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 5,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '90%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  group: { gap: 0 },
  groupLab: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 6,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  qa: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  q: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  a: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
});

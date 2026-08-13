import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { RuleCopy } from '@/components/orbit/house-rules/rule-copy';
import type { HouseRulesPalette, HouseRulesVoice } from '@/lib/rules/house-rules-palette';
import { interpolateHouseRulesCopy } from '@/lib/rules/interpolate';
import { searchHouseRules } from '@/lib/rules/search';
import type { RuleConstants } from '@/lib/rules/types';
import type { VisibleChapter } from '@/lib/rules/visible-rules';

type Props = {
  groups: VisibleChapter[];
  voice: HouseRulesVoice;
  palette: HouseRulesPalette;
  constants: RuleConstants;
};

const EMPTY_SEARCH = 'No rule matches that. Try "late", "streak" or "allowance".';

/** Direction 04 — Ask Poppins. Admin: searchable Q&A. Sidekick: chat bubbles. */
export function AskPoppinsView({ groups, voice, palette, constants }: Props) {
  const [query, setQuery] = useState('');
  const hits = useMemo(() => searchHouseRules(groups, query, voice), [groups, query, voice]);
  const searching = query.trim().length > 0;
  const chips = useMemo(
    () => groups.flatMap((g) => g.rules).map((rule) => rule.kid.question).slice(0, 4),
    [groups]
  );

  if (voice === 'kid') {
    const rows = searching ? hits : groups.flatMap((g) => g.rules);
    return (
      <View style={styles.stack}>
        <View style={styles.pageTitle}>
          <Text style={[styles.kidH3, { color: palette.title }]}>Ask Poppins</Text>
          <Text style={[styles.kidSub, { color: palette.muted }]}>
            Tap a question. Or just ask your own.
          </Text>
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search the rules"
          placeholderTextColor={palette.muted}
          style={[
            styles.input,
            { backgroundColor: '#fff', borderColor: palette.cardBorder, color: palette.ink },
          ]}
        />
        {searching ? (
          <Text style={[styles.count, { color: palette.muted }]}>{hits.length}</Text>
        ) : null}
        {searching && !rows.length ? (
          <Text style={[styles.empty, { color: palette.muted }]}>{EMPTY_SEARCH}</Text>
        ) : (
          <View style={styles.chat}>
            {rows.map((rule) => {
              const ask = interpolateHouseRulesCopy(rule.kid.question, constants);
              const ans = interpolateHouseRulesCopy(rule.kid.body, constants);
              return (
                <View key={rule.id} style={styles.pair}>
                  <View style={[styles.ask, { backgroundColor: palette.askBubble }]}>
                    <Text style={styles.askText}>{ask}</Text>
                  </View>
                  <View style={[styles.ans, { backgroundColor: palette.ansBubble }]}>
                    <Text style={[styles.who, { color: palette.accent }]}>Poppins</Text>
                    <RuleCopy
                      text={ans}
                      constants={constants}
                      voice="kid"
                      color="#3C3352"
                      boldColor={palette.ink}
                      numtagBg={palette.pillBg}
                      numtagColor={palette.pillText}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
        {!searching ? (
          <View style={styles.chips}>
            {chips.map((label) => (
              <Pressable
                key={label}
                onPress={() => setQuery(label)}
                style={[styles.chip, { borderColor: '#D9CFF5', backgroundColor: '#fff' }]}>
                <Text style={[styles.chipText, { color: '#5A4E85' }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
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
            color: palette.inkSoft,
          },
        ]}
      />
      {searching ? (
        <Text style={[styles.count, { color: palette.muted }]}>{hits.length}</Text>
      ) : null}
      {searching && !hits.length ? (
        <Text style={[styles.empty, { color: palette.muted }]}>{EMPTY_SEARCH}</Text>
      ) : (
        groups.map(({ chapter, rules }) => {
          const chapterHits = searching ? rules.filter((r) => hits.some((h) => h.id === r.id)) : rules;
          if (!chapterHits.length) return null;
          return (
            <View key={chapter.key}>
              <Text style={[styles.groupLab, { color: palette.groupHead }]}>{chapter.adultLabel}</Text>
              {chapterHits.map((rule) => {
                const q = interpolateHouseRulesCopy(rule.adult.question, constants);
                const a = interpolateHouseRulesCopy(rule.adult.clause, constants);
                return (
                  <View
                    key={rule.id}
                    style={[styles.qa, { borderTopColor: palette.quietBorder }]}
                    accessible
                    accessibilityLabel={`${q}. ${a}`}>
                    <Text style={[styles.q, { color: palette.ink }]}>{q}</Text>
                    <RuleCopy
                      text={a}
                      constants={constants}
                      voice="adult"
                      color={palette.inkSoft}
                      boldColor={palette.ink}
                      numtagBg={palette.pillBg}
                      numtagColor={palette.pillText}
                      style={{ fontSize: 13.5, lineHeight: 21 }}
                    />
                  </View>
                );
              })}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 0, paddingBottom: 44 },
  pageTitle: { marginBottom: 2 },
  adultH3: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  kidH3: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  kidSub: { fontSize: 13, marginTop: 5 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 13.5,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  count: { fontSize: 11, fontWeight: '700', marginTop: 8 },
  empty: { fontSize: 13.5, lineHeight: 20, marginTop: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 99,
    borderWidth: 1.5,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12.5, fontWeight: '700' },
  chat: { gap: 12, marginTop: 16 },
  pair: { gap: 8 },
  ask: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5,
    borderRadius: 18,
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  askText: { color: '#fff', fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  ans: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 5,
    borderRadius: 18,
    maxWidth: '88%',
    paddingBottom: 13,
    paddingHorizontal: 15,
    paddingTop: 12,
  },
  who: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  groupLab: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    paddingBottom: 6,
    paddingTop: 22,
    textTransform: 'uppercase',
  },
  qa: { borderTopWidth: 1, paddingVertical: 14 },
  q: { fontSize: 15, fontWeight: '700', lineHeight: 20, marginBottom: 6 },
});

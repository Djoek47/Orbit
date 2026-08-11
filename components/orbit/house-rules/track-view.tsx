import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { LateCreditTable } from '@/components/orbit/house-rules/visuals/late-credit-table';
import { space, typography } from '@/constants/orbit-theme';
import { HR, type HouseRulesPalette, type HouseRulesVoice } from '@/lib/rules/house-rules-palette';
import type { RuleConstants } from '@/lib/rules/types';
import { substituteTokens, type PhaseStop } from '@/lib/rules/visible-rules';

type Props = {
  stops: PhaseStop[];
  voice: HouseRulesVoice;
  palette: HouseRulesPalette;
  tokens: Record<string, string>;
  constants: RuleConstants;
};

const DAY_PHASES = new Set(['assigned', 'nudge', 'deadline', 'lateCredit', 'expired', 'counted']);

function nodeTone(
  phase: string,
  voice: HouseRulesVoice,
  palette: HouseRulesPalette
): string {
  if (voice === 'kid') {
    if (phase === 'lateCredit') return palette.warn;
    if (phase === 'expired') return palette.danger;
    if (phase === 'crownWeek' || phase === 'crownMonth') return HR.trackKidGold;
    return palette.accent;
  }
  if (phase === 'deadline' || phase === 'lateCredit') return palette.warn;
  if (phase === 'expired') return palette.danger;
  if (phase === 'crownWeek' || phase === 'crownMonth') return HR.amber;
  return palette.accent;
}

/** Direction 03 — The Track. Day runs top→bottom; then beyond-the-clock rules. */
export function TrackView({ stops, voice, palette, tokens, constants }: Props) {
  const day = stops.filter((s) => DAY_PHASES.has(s.phase));
  const beyond = stops.filter((s) => !DAY_PHASES.has(s.phase));

  return (
    <View style={styles.stack}>
      <View style={styles.pageTitle}>
        <Text style={[styles.h3, { color: palette.title }]}>
          {voice === 'kid' ? 'Your day' : 'House Rules'}
        </Text>
        <Text style={[typography.footnote, { color: palette.muted, marginTop: 5 }]}>
          {voice === 'kid'
            ? 'Follow the path from top to bottom.'
            : 'How one day runs, from assigned to counted.'}
        </Text>
      </View>

      {day.map((stop, index) => (
        <PhaseNode
          key={stop.phase}
          stop={stop}
          index={index}
          voice={voice}
          palette={palette}
          tokens={tokens}
          constants={constants}
          showConnector={index < day.length - 1}
        />
      ))}

      {beyond.length ? (
        <>
          <Text style={[styles.sectionHead, { color: palette.groupHead }]}>
            {voice === 'kid' ? 'The bigger stuff' : 'Beyond the day'}
          </Text>
          {beyond.map((stop, index) => (
            <PhaseNode
              key={stop.phase}
              stop={stop}
              index={day.length + index}
              voice={voice}
              palette={palette}
              tokens={tokens}
              constants={constants}
              showConnector={index < beyond.length - 1}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

function PhaseNode({
  stop,
  index,
  voice,
  palette,
  tokens,
  constants,
  showConnector,
}: {
  stop: PhaseStop;
  index: number;
  voice: HouseRulesVoice;
  palette: HouseRulesPalette;
  tokens: Record<string, string>;
  constants: RuleConstants;
  showConnector: boolean;
}) {
  const color = nodeTone(stop.phase, voice, palette);
  const primary = stop.rules[0];
  const headline = primary
    ? voice === 'kid'
      ? substituteTokens(primary.kid.headline, tokens)
      : substituteTokens(primary.adult.headline, tokens)
    : stop.label;
  const body = primary
    ? voice === 'kid'
      ? substituteTokens(primary.kid.body, tokens)
      : substituteTokens(primary.adult.clause, tokens)
    : '';

  return (
    <View style={styles.nodeWrap}>
      <View style={styles.rail}>
        {voice === 'kid' ? (
          <View style={[styles.numNode, { backgroundColor: color }]}>
            <Text style={styles.numText}>{index + 1}</Text>
          </View>
        ) : (
          <View style={[styles.dot, { backgroundColor: color, borderColor: palette.surface }]} />
        )}
        {showConnector ? (
          <View style={[styles.connector, { backgroundColor: palette.trackConnector }]} />
        ) : null}
      </View>
      <View style={[styles.box, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
        <Text style={[styles.when, { color }]}>{stop.label}</Text>
        <Text style={[styles.h4, { color: palette.ink }]}>{headline}</Text>
        {body ? <Text style={[styles.body, { color: palette.inkSoft }]}>{body}</Text> : null}
        {stop.rules.slice(1).map((rule) => {
          const line =
            voice === 'kid'
              ? substituteTokens(rule.kid.headline, tokens)
              : substituteTokens(rule.adult.headline, tokens);
          return (
            <Text key={rule.id} style={[styles.extra, { color: palette.inkSoft }]}>
              {line}
            </Text>
          );
        })}
        {stop.phase === 'lateCredit' ? (
          <LateCreditTable constants={constants} palette={palette} voice={voice} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { paddingBottom: space.xl },
  pageTitle: { marginBottom: 14 },
  h3: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sectionHead: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 10,
    marginTop: 18,
    textTransform: 'uppercase',
  },
  nodeWrap: { flexDirection: 'row', gap: 12, minHeight: 72 },
  rail: { alignItems: 'center', width: 28 },
  dot: {
    borderRadius: 8,
    borderWidth: 3,
    height: 14,
    marginTop: 8,
    width: 14,
  },
  numNode: {
    alignItems: 'center',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  numText: {
    color: '#0A1A14',
    fontSize: 12,
    fontWeight: '800',
  },
  connector: { flex: 1, marginVertical: 4, minHeight: 28, width: 2 },
  box: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    marginBottom: 10,
    padding: space.md,
  },
  when: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  h4: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 6,
  },
  extra: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
});

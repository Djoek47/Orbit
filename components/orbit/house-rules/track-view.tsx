import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { space, typography } from '@/constants/orbit-theme';
import type { HouseRulesPalette, HouseRulesVoice } from '@/lib/rules/house-rules-palette';
import { substituteTokens, type PhaseStop } from '@/lib/rules/visible-rules';

type Props = {
  stops: PhaseStop[];
  voice: HouseRulesVoice;
  palette: HouseRulesPalette;
  tokens: Record<string, string>;
  dayPhases?: PhaseStop[];
  beyondPhases?: PhaseStop[];
};

const DAY_PHASES = new Set(['assigned', 'nudge', 'deadline', 'lateCredit', 'expired', 'counted']);

export function TrackView({ stops, voice, palette, tokens }: Props) {
  const day = stops.filter((s) => DAY_PHASES.has(s.phase));
  const beyond = stops.filter((s) => !DAY_PHASES.has(s.phase));

  return (
    <View style={styles.stack}>
      <Text style={[typography.caption1, { color: palette.muted, marginBottom: 4 }]}>
        {voice === 'kid' ? 'Your day' : 'Day track'}
      </Text>
      {day.map((stop, index) => (
        <PhaseNode
          key={stop.phase}
          stop={stop}
          index={index}
          voice={voice}
          palette={palette}
          tokens={tokens}
          showConnector={index < day.length - 1}
        />
      ))}

      {beyond.length ? (
        <>
          <Text style={[typography.caption1, { color: palette.muted, marginTop: space.lg, marginBottom: 4 }]}>
            {voice === 'kid' ? 'Beyond today' : 'Beyond the day'}
          </Text>
          {beyond.map((stop, index) => (
            <PhaseNode
              key={stop.phase}
              stop={stop}
              index={day.length + index}
              voice={voice}
              palette={palette}
              tokens={tokens}
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
  showConnector,
}: {
  stop: PhaseStop;
  index: number;
  voice: HouseRulesVoice;
  palette: HouseRulesPalette;
  tokens: Record<string, string>;
  showConnector: boolean;
}) {
  const warn = stop.phase === 'lateCredit' || stop.phase === 'nudge';
  const danger = stop.phase === 'expired';
  const nodeColor = danger ? palette.danger : warn ? palette.warn : palette.accent;

  return (
    <View style={styles.nodeWrap}>
      <View style={styles.rail}>
        {voice === 'kid' ? (
          <View style={[styles.numNode, { backgroundColor: nodeColor }]}>
            <Text style={[typography.caption1, { color: '#fff', fontWeight: '800' }]}>{index + 1}</Text>
          </View>
        ) : (
          <View style={[styles.dot, { backgroundColor: nodeColor, borderColor: palette.cardBorder }]} />
        )}
        {showConnector ? (
          <View style={[styles.connector, { backgroundColor: palette.trackConnector }]} />
        ) : null}
      </View>
      <View style={[styles.body, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
        <Text style={[typography.caption1, { color: nodeColor, fontWeight: '700' }]}>{stop.label}</Text>
        {stop.rules.map((rule) => {
          const line =
            voice === 'kid'
              ? substituteTokens(rule.kid.headline, tokens)
              : substituteTokens(rule.adult.headline, tokens);
          return (
            <Text key={rule.id} style={[typography.body, { color: palette.ink, marginTop: 6 }]}>
              {line}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { paddingBottom: space.xl },
  nodeWrap: { flexDirection: 'row', gap: 12, minHeight: 64 },
  rail: { width: 28, alignItems: 'center' },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    marginTop: 6,
  },
  numNode: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: { flex: 1, width: 2, marginVertical: 4, minHeight: 24 },
  body: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    marginBottom: space.sm,
  },
});

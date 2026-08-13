import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { RuleCopy } from '@/components/orbit/house-rules/rule-copy';
import { LateCreditTable } from '@/components/orbit/house-rules/visuals/late-credit-table';
import { HR, type HouseRulesPalette, type HouseRulesVoice } from '@/lib/rules/house-rules-palette';
import { interpolateHouseRulesCopy } from '@/lib/rules/interpolate';
import type { PhaseTone, RuleConstants } from '@/lib/rules/types';
import type { PhaseStop } from '@/lib/rules/visible-rules';

type Props = {
  stops: PhaseStop[];
  voice: HouseRulesVoice;
  palette: HouseRulesPalette;
  constants: RuleConstants;
};

function toneColor(tone: PhaseTone, voice: HouseRulesVoice, palette: HouseRulesPalette): string {
  if (voice === 'kid') {
    if (tone === 'hot') return palette.warn;
    if (tone === 'dead') return palette.danger;
    if (tone === 'gold') return HR.trackKidGold;
    return palette.accent;
  }
  if (tone === 'hot') return palette.warn;
  if (tone === 'dead') return palette.danger;
  if (tone === 'gold') return HR.amber;
  return palette.accent;
}

/** Direction 03 — The Track. Day, then beyond. Empty phases omitted; connector joins survivors. */
export function TrackView({ stops, voice, palette, constants }: Props) {
  const day = stops.filter((s) => s.block === 'day');
  const beyond = stops.filter((s) => s.block === 'beyond');

  return (
    <View style={styles.stack}>
      <View style={styles.pageTitle}>
        <Text style={[voice === 'kid' ? styles.kidH3 : styles.h3, { color: palette.title }]}>
          {voice === 'kid' ? 'Your day' : 'House Rules'}
        </Text>
        <Text style={[styles.sub, { color: palette.muted }]}>
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
  constants,
  showConnector,
}: {
  stop: PhaseStop;
  index: number;
  voice: HouseRulesVoice;
  palette: HouseRulesPalette;
  constants: RuleConstants;
  showConnector: boolean;
}) {
  const color = toneColor(stop.tone, voice, palette);

  if (voice === 'kid') {
    return (
      <View style={styles.kstop}>
        <View style={styles.krail}>
          <View style={[styles.knode, { backgroundColor: color }]}>
            <Text style={[styles.knum, { color: stop.tone === 'dead' ? '#fff' : '#123A2E' }]}>
              {index + 1}
            </Text>
          </View>
          {showConnector ? <View style={[styles.kline, { backgroundColor: '#1B5044' }]} /> : null}
        </View>
        <View style={[styles.kbox, { backgroundColor: palette.card }]}>
          <Text style={[styles.when, { color }]}>{stop.gutter}</Text>
          {stop.rules.map((rule) => {
            const headline = interpolateHouseRulesCopy(rule.kid.headline, constants);
            const body = interpolateHouseRulesCopy(rule.kid.body, constants);
            return (
              <View key={rule.id} accessible accessibilityLabel={`${headline}. ${body}`}>
                <Text style={[styles.kh4, { color: palette.ink }]}>{headline}</Text>
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
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stop}>
      <View style={styles.timeCol}>
        <Text style={[styles.time, { color: '#C9B58F' }]}>{stop.gutter}</Text>
        {stop.kicker ? <Text style={styles.kicker}>{stop.kicker}</Text> : null}
      </View>
      <View style={styles.col}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        {showConnector ? (
          <View style={[styles.line, { backgroundColor: palette.trackConnector }]} />
        ) : null}
        {stop.rules.map((rule) => {
          const headline = interpolateHouseRulesCopy(rule.adult.headline, constants);
          const clause = interpolateHouseRulesCopy(rule.adult.clause, constants);
          return (
            <View
              key={rule.id}
              style={styles.adultBody}
              accessible
              accessibilityLabel={`${headline}. ${clause}`}>
              <Text style={[styles.h4, { color: palette.ink }]}>{headline}</Text>
              <RuleCopy
                text={clause}
                constants={constants}
                voice="adult"
                color={palette.inkSoft}
                boldColor={palette.ink}
                numtagBg={palette.pillBg}
                numtagColor={palette.pillText}
                style={{ fontSize: 13, lineHeight: 20 }}
              />
            </View>
          );
        })}
        {stop.phase === 'lateCredit' ? (
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
}

const styles = StyleSheet.create({
  stack: { paddingBottom: 44 },
  pageTitle: { marginBottom: 8, paddingHorizontal: 2 },
  h3: { fontSize: 29, fontWeight: '700', letterSpacing: -0.4 },
  kidH3: { fontSize: 31, fontWeight: '800', letterSpacing: -0.5 },
  sub: { fontSize: 12.5, lineHeight: 19, marginTop: 6 },
  sectionHead: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  stop: {
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 24,
  },
  timeCol: { paddingTop: 1, width: 62 },
  time: {
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'right',
  },
  kicker: {
    color: '#7E7057',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 3,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  col: { flex: 1, minWidth: 0, paddingLeft: 22, position: 'relative' },
  dot: {
    borderRadius: 99,
    height: 11,
    left: 0,
    position: 'absolute',
    top: 5,
    width: 11,
    shadowColor: '#2A2318',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  line: { bottom: -24, left: 5, position: 'absolute', top: 16, width: 1 },
  adultBody: { marginBottom: 7 },
  h4: { fontSize: 15.5, fontWeight: '700', marginBottom: 4 },
  kstop: { flexDirection: 'row', gap: 14, paddingBottom: 20 },
  krail: { alignItems: 'center', width: 46 },
  knode: {
    alignItems: 'center',
    borderRadius: 16,
    height: 46,
    justifyContent: 'center',
    width: 46,
    zIndex: 2,
  },
  knum: { fontSize: 17, fontWeight: '800' },
  kline: { borderRadius: 99, flex: 1, marginTop: 0, minHeight: 12, width: 4 },
  kbox: { borderRadius: 16, flex: 1, minWidth: 0, paddingBottom: 13, paddingHorizontal: 14, paddingTop: 12 },
  when: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  kh4: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, marginBottom: 3 },
});

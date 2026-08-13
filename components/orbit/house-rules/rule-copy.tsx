import { Text as RNText } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { VOCAB } from '@/constants/vocabulary';
import type { HouseRulesVoice } from '@/lib/rules/house-rules-palette';
import type { RuleConstants } from '@/lib/rules/types';

function figuresFromConstants(constants: RuleConstants): string[] {
  const items = new Set<string>();
  for (const n of constants.xpValues) {
    items.add(`+${n}`);
    items.add(String(n));
  }
  for (const [full, late] of Object.entries(constants.lateCredit)) {
    items.add(full);
    items.add(String(late));
  }
  items.add(`+${constants.bundleBonusOnTime}`);
  items.add(`+${constants.bundleBonusLate}`);
  items.add(`${Math.round(constants.streakRescue.afterOneMiss * 100)}%`);
  items.add(`${Math.round(constants.streakRescue.afterTwoConsecutive * 100)}%`);
  items.add(String(constants.streak.consecutiveMissesToEnd));
  items.add(String(constants.streak.rollingWindowDays));
  items.add(String(constants.streak.missesInWindowToEnd));
  items.add(String(constants.nudgeMinutesBefore));
  items.add(String(constants.library.streakOnlyTasks));
  items.add(String(constants.library.totalTasks));
  items.add(String(constants.topTrophy.xp));
  items.add(constants.topTrophy.xp.toLocaleString());
  return [...items].sort((a, b) => b.length - a.length);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function boldTerms(constants: RuleConstants): string[] {
  return [
    VOCAB.lateCredit,
    VOCAB.expired,
    VOCAB.streakRescue,
    VOCAB.recess,
    VOCAB.weeksCrown,
    VOCAB.monthlySovereign,
    VOCAB.championsRecord,
    VOCAB.mintAReward,
    VOCAB.approveNow,
    constants.topTrophy.name,
    'Complete',
    'Admin',
    'Helper',
  ].sort((a, b) => b.length - a.length);
}

type Props = {
  text: string;
  constants: RuleConstants;
  voice: HouseRulesVoice;
  color: string;
  boldColor: string;
  numtagBg: string;
  numtagColor: string;
  style?: object;
};

/** Renders JSON copy. Kid mode chips constant figures; Admin bolds locked names. */
export function RuleCopy({
  text,
  constants,
  voice,
  color,
  boldColor,
  numtagBg,
  numtagColor,
  style,
}: Props) {
  if (voice === 'kid') {
    const figures = figuresFromConstants(constants);
    const pattern = new RegExp(`(${figures.map(escapeRegExp).join('|')})`);
    const parts = text.split(pattern);
    return (
      <Text style={[{ color, fontSize: 13.5, lineHeight: 20 }, style]}>
        {parts.map((part, i) =>
          figures.includes(part) ? (
            <RNText
              key={`${part}-${i}`}
              style={{
                backgroundColor: numtagBg,
                color: numtagColor,
                fontWeight: '800',
                fontSize: 12.5,
                fontVariant: ['tabular-nums'],
              }}>
              {` ${part} `}
            </RNText>
          ) : (
            part
          )
        )}
      </Text>
    );
  }

  const terms = boldTerms(constants);
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`);
  const parts = text.split(pattern);
  return (
    <Text style={[{ color, fontSize: 14, lineHeight: 20 }, style]}>
      {parts.map((part, i) =>
        terms.includes(part) ? (
          <RNText key={`${part}-${i}`} style={{ color: boldColor, fontWeight: '700' }}>
            {part}
          </RNText>
        ) : (
          part
        )
      )}
    </Text>
  );
}

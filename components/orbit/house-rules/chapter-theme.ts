/**
 * House Rules look: one colour and one Moji per chapter, one Moji per rule, and the single
 * number each chapter is "about" (Deadlines → 7:00 PM). The screens lead with these and keep
 * the full sentences one tap away.
 */
import type { MojiName } from '@/components/orbit/moji/art';
import type { HouseRulesPalette, HouseRulesVoice } from '@/lib/rules/house-rules-palette';
import { resolveHouseRulesPalette } from '@/lib/rules/house-rules-palette';
import { formatHouseRulesTime } from '@/lib/rules/interpolate';
import type { RuleConstants } from '@/lib/rules/types';

export const CHAPTER_LOOK: Record<string, { color: string; moji: MojiName }> = {
  earning: { color: '#FF9F1C', moji: 'star' },
  deadlines: { color: '#17B9A0', moji: 'timer' },
  streaks: { color: '#FF6A3D', moji: 'fire' },
  crowns: { color: '#E9B44C', moji: 'crown' },
  rewards: { color: '#8E7CFF', moji: 'gift' },
  proof: { color: '#4FA3FF', moji: 'clipboard' },
  household: { color: '#7FC24A', moji: 'home' },
};

export function chapterLook(key: string) {
  return CHAPTER_LOOK[key] ?? { color: '#8E7CFF', moji: 'star' as MojiName };
}

const RULE_MOJI: Record<string, MojiName> = {
  'EARN-01': 'star',
  'EARN-02': 'box',
  'EARN-03': 'bolt',
  'EARN-04': 'person',
  'EARN-05': 'toothbrush',
  'EARN-06': 'shield',
  'DEAD-01': 'bell',
  'DEAD-02': 'poppins',
  'DEAD-03': 'timer',
  'DEAD-04': 'moon',
  'DEAD-05': 'box',
  'DEAD-06': 'calendar',
  'DEAD-07': 'calendar',
  'DEAD-08': 'broom',
  'STRK-01': 'check',
  'STRK-02': 'fire',
  'STRK-03': 'shield',
  'STRK-04': 'sunrise',
  'CROWN-01': 'crown',
  'CROWN-02': 'target',
  'CROWN-03': 'medal',
  'CROWN-04': 'scales',
  'CROWN-05': 'clipboard',
  'CROWN-06': 'trophy',
  'CROWN-07': 'gem',
  'RWRD-01': 'gift',
  'RWRD-02': 'sunrise',
  'RWRD-03': 'tag',
  'RWRD-04': 'check',
  'RWRD-05': 'moneyBag',
  'RWRD-06': 'sparkles',
  'RWRD-07': 'receipt',
  'PROOF-01': 'phone',
  'PROOF-02': 'books',
  'HOUS-01': 'person',
  'HOUS-02': 'door',
  'HOUS-03': 'heartHome',
};

export function ruleMoji(id: string, chapterKey: string): MojiName {
  return RULE_MOJI[id] ?? chapterLook(chapterKey).moji;
}

export type ChapterStat = { value: string; caption: string };

/** The one figure a chapter leads with. Every number comes from constants or the household. */
export function chapterStat(
  key: string,
  ctx: {
    constants: RuleConstants;
    voice: HouseRulesVoice;
    deadline: string;
    use24h?: boolean;
    modelLabel: string;
    proofCount: number;
    memberCount: number;
  }
): ChapterStat {
  const { constants, voice } = ctx;
  const kid = voice === 'sidekick';
  switch (key) {
    case 'earning': {
      const xp = constants.xpValues;
      return { value: `${xp[0]}–${xp[xp.length - 1]}`, caption: kid ? 'points a job' : 'XP per task' };
    }
    case 'deadlines':
      return {
        value: formatHouseRulesTime(ctx.deadline, ctx.use24h),
        caption: `${kid ? 'the bell' : 'due'} · day closes ${formatHouseRulesTime(constants.expiryTime, ctx.use24h)}`,
      };
    case 'streaks':
      return {
        value: String(constants.streak.consecutiveMissesToEnd),
        caption: kid ? 'misses in a row end it' : 'misses in a row end a streak',
      };
    case 'crowns':
      return { value: 'Weekly', caption: kid ? 'most points wins the crown' : 'crown for the week’s top XP' };
    case 'rewards':
      return { value: ctx.modelLabel, caption: kid ? 'how prizes work here' : 'reward model' };
    case 'proof':
      return { value: String(ctx.proofCount), caption: ctx.proofCount === 1 ? 'task needs a photo' : 'tasks need a photo' };
    case 'household':
      return { value: String(ctx.memberCount), caption: ctx.memberCount === 1 ? 'person' : 'people' };
    default:
      return { value: '', caption: '' };
  }
}

/** The rule visuals, recoloured to sit on the app's own cards in light and dark. */
export function visualPalette(
  voice: HouseRulesVoice,
  color: string,
  theme: { text: string; muted: string; card: string; border: string; deep: string }
): HouseRulesPalette {
  return {
    ...resolveHouseRulesPalette(voice),
    accent: color,
    warn: color,
    spine: color,
    groupHead: color,
    nav: color,
    pillBg: `${color}22`,
    pillText: color,
    ink: theme.text,
    title: theme.text,
    inkSoft: theme.muted,
    muted: theme.muted,
    clause: theme.muted,
    card: theme.card,
    deep: theme.deep,
    cardBorder: theme.border,
    quietBorder: theme.border,
  };
}

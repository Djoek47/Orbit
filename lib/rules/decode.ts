import {
  CHAPTER_KEYS,
  CONDITION_KEYS,
  PHASE_KEYS,
  VISUAL_KEYS,
  type Chapter,
  type ChapterKey,
  type ConditionKey,
  type HouseRule,
  type HouseRulesDoc,
  type PhaseKey,
  type RuleConstants,
  type VisualKey,
} from '@/lib/rules/types';

function assertEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new Error(`house-rules decode: unknown ${field} "${String(value)}"`);
  }
  return value as T;
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`house-rules decode: ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`house-rules decode: ${label} must be a string`);
  }
  return value;
}

function asNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`house-rules decode: ${label} must be a number`);
  }
  return value;
}

function asBool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`house-rules decode: ${label} must be a boolean`);
  }
  return value;
}

function decodeConstants(raw: unknown): RuleConstants {
  const c = asObject(raw, 'constants');
  const lateRaw = asObject(c.lateCredit, 'constants.lateCredit');
  const lateCredit: Record<string, number> = {};
  for (const [k, v] of Object.entries(lateRaw)) {
    if (k.startsWith('_')) continue;
    lateCredit[k] = asNumber(v, `lateCredit.${k}`);
  }
  const streak = asObject(c.streak, 'constants.streak');
  const streakRescue = asObject(c.streakRescue, 'constants.streakRescue');
  const deadlines = asObject(c.deadlines, 'constants.deadlines');
  const topTrophy = asObject(c.topTrophy, 'constants.topTrophy');
  const library = asObject(c.library, 'constants.library');
  const rewardModelsRaw = c.rewardModels;
  if (!Array.isArray(rewardModelsRaw)) {
    throw new Error('house-rules decode: constants.rewardModels must be an array');
  }

  return {
    xpValues: (c.xpValues as number[]).map((n, i) => asNumber(n, `xpValues[${i}]`)),
    lateCredit,
    bundleBonusOnTime: asNumber(c.bundleBonusOnTime, 'bundleBonusOnTime'),
    bundleBonusLate: asNumber(c.bundleBonusLate, 'bundleBonusLate'),
    deadlines: {
      daily: asString(deadlines.daily, 'deadlines.daily'),
      weekly: asString(deadlines.weekly, 'deadlines.weekly'),
      monthly: asString(deadlines.monthly, 'deadlines.monthly'),
      timezone: asString(deadlines.timezone, 'deadlines.timezone'),
    },
    expiryTime: asString(c.expiryTime, 'expiryTime'),
    nudgeMinutesBefore: asNumber(c.nudgeMinutesBefore, 'nudgeMinutesBefore'),
    streak: {
      consecutiveMissesToEnd: asNumber(streak.consecutiveMissesToEnd, 'streak.consecutive'),
      rollingWindowDays: asNumber(streak.rollingWindowDays, 'streak.window'),
      missesInWindowToEnd: asNumber(streak.missesInWindowToEnd, 'streak.misses'),
      qualifyingCadences: Array.isArray(streak.qualifyingCadences)
        ? (streak.qualifyingCadences as string[])
        : [],
    },
    streakRescue: {
      afterOneMiss: asNumber(streakRescue.afterOneMiss, 'streakRescue.afterOneMiss'),
      afterTwoConsecutive: asNumber(
        streakRescue.afterTwoConsecutive,
        'streakRescue.afterTwoConsecutive'
      ),
      thirdConsecutive: asString(streakRescue.thirdConsecutive, 'streakRescue.third'),
      chargedAgainst: asString(streakRescue.chargedAgainst, 'streakRescue.chargedAgainst'),
      monthlyToken:
        typeof streakRescue.monthlyToken === 'number' ? streakRescue.monthlyToken : undefined,
    },
    topTrophy: {
      name: asString(topTrophy.name, 'topTrophy.name'),
      xp: asNumber(topTrophy.xp, 'topTrophy.xp'),
    },
    library: {
      totalTasks: asNumber(library.totalTasks, 'library.totalTasks'),
      domains: asNumber(library.domains, 'library.domains'),
      groups: asNumber(library.groups, 'library.groups'),
      scoringTasks: asNumber(library.scoringTasks, 'library.scoringTasks'),
      streakOnlyTasks: asNumber(library.streakOnlyTasks, 'library.streakOnlyTasks'),
    },
    rewardModels: rewardModelsRaw.map((row, i) => {
      const r = asObject(row, `rewardModels[${i}]`);
      return { key: asString(r.key, 'key'), label: asString(r.label, 'label') };
    }),
  };
}

function decodeChapter(raw: unknown, index: number): Chapter {
  const row = asObject(raw, `chapters[${index}]`);
  return {
    key: assertEnum(row.key, CHAPTER_KEYS, 'chapter.key'),
    order: asNumber(row.order, 'chapter.order'),
    adultLabel: asString(row.adultLabel, 'chapter.adultLabel'),
    kidLabel: asString(row.kidLabel, 'chapter.kidLabel'),
    kidColor: typeof row.kidColor === 'string' ? row.kidColor : undefined,
  };
}

function decodeRule(raw: unknown, index: number): HouseRule {
  const row = asObject(raw, `rules[${index}]`);
  const adult = asObject(row.adult, `rules[${index}].adult`);
  const kid = asObject(row.kid, `rules[${index}].kid`);
  const editable = asBool(row.editable, `rules[${index}].editable`);
  const settingKey =
    typeof row.settingKey === 'string' ? row.settingKey : undefined;
  if (editable && !settingKey) {
    throw new Error(`house-rules decode: editable rule ${String(row.id)} missing settingKey`);
  }
  return {
    id: asString(row.id, 'rule.id'),
    chapter: assertEnum(row.chapter, CHAPTER_KEYS, 'rule.chapter'),
    order: asNumber(row.order, 'rule.order'),
    condition: assertEnum(row.condition, CONDITION_KEYS, 'rule.condition'),
    phase: assertEnum(row.phase, PHASE_KEYS, 'rule.phase'),
    visual: assertEnum(row.visual, VISUAL_KEYS, 'rule.visual'),
    editable,
    settingKey,
    adult: {
      headline: asString(adult.headline, 'adult.headline'),
      question: asString(adult.question, 'adult.question'),
      clause: asString(adult.clause, 'adult.clause'),
    },
    kid: {
      headline: asString(kid.headline, 'kid.headline'),
      question: asString(kid.question, 'kid.question'),
      body: asString(kid.body, 'kid.body'),
    },
  };
}

/** Decode house-rules.json. Unknown enums fail loudly. */
export function decodeHouseRules(raw: unknown): HouseRulesDoc {
  const root = asObject(raw, 'root');
  const chaptersRaw = root.chapters;
  const rulesRaw = root.rules;
  if (!Array.isArray(chaptersRaw) || !Array.isArray(rulesRaw)) {
    throw new Error('house-rules decode: chapters and rules must be arrays');
  }

  const chapters = chaptersRaw.map(decodeChapter).sort((a, b) => a.order - b.order);
  const rules = rulesRaw.map(decodeRule);

  for (const rule of rules) {
    if (rule.phase == null) {
      throw new Error(`house-rules decode: rule ${rule.id} has nil phase`);
    }
  }

  return {
    schemaVersion: asString(root.schemaVersion, 'schemaVersion'),
    contentVersion: asString(root.contentVersion, 'contentVersion'),
    constants: decodeConstants(root.constants),
    chapters,
    rules,
    footnotes:
      root.footnotes && typeof root.footnotes === 'object'
        ? (root.footnotes as HouseRulesDoc['footnotes'])
        : undefined,
  };
}

export type { ChapterKey, ConditionKey, PhaseKey, VisualKey };

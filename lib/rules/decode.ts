import {
  CHAPTER_KEYS,
  CONDITION_KEYS,
  VISUAL_KEYS,
  type Chapter,
  type HouseRule,
  type HouseRulesDoc,
  type HouseRulesModes,
  type HouseRulesSettings,
  type RuleConstants,
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
  const invites = asObject(c.invites, 'constants.invites');
  const rewardModelsRaw = c.rewardModels;
  if (!Array.isArray(rewardModelsRaw)) {
    throw new Error('house-rules decode: constants.rewardModels must be an array');
  }
  const freqs = c.primaryFrequencies;
  if (!Array.isArray(freqs)) {
    throw new Error('house-rules decode: constants.primaryFrequencies must be an array');
  }

  return {
    xpValues: (c.xpValues as number[]).map((n, i) => asNumber(n, `xpValues[${i}]`)),
    lateCredit,
    bundleBonusOnTime: asNumber(c.bundleBonusOnTime, 'bundleBonusOnTime'),
    bundleBonusLate: asNumber(c.bundleBonusLate, 'bundleBonusLate'),
    deadlines: {
      default: asString(deadlines.default, 'deadlines.default'),
      weeklyDay: asString(deadlines.weeklyDay, 'deadlines.weeklyDay'),
      monthlyDay: asString(deadlines.monthlyDay, 'deadlines.monthlyDay'),
      timezone: asString(deadlines.timezone, 'deadlines.timezone'),
      configurable: asBool(deadlines.configurable, 'deadlines.configurable'),
    },
    expiryTime: asString(c.expiryTime, 'expiryTime'),
    expiredPurgeDays: asNumber(c.expiredPurgeDays, 'expiredPurgeDays'),
    nudgeMinutesBefore: asNumber(c.nudgeMinutesBefore, 'nudgeMinutesBefore'),
    frequencyCount: asNumber(c.frequencyCount, 'frequencyCount'),
    primaryFrequencies: freqs.map((f, i) => asString(f, `primaryFrequencies[${i}]`)),
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
    },
    topTrophy: {
      name: asString(topTrophy.name, 'topTrophy.name'),
      xp: asNumber(topTrophy.xp, 'topTrophy.xp'),
    },
    invites: {
      expiryDays: asNumber(invites.expiryDays, 'invites.expiryDays'),
      singleUse: asBool(invites.singleUse, 'invites.singleUse'),
      activePerMember: asNumber(invites.activePerMember, 'invites.activePerMember'),
      regenerableByAdmin: asBool(invites.regenerableByAdmin, 'invites.regenerableByAdmin'),
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

function decodeModes(raw: unknown): HouseRulesModes {
  const root = asObject(raw, 'modes');
  const admin = asObject(root.admin, 'modes.admin');
  const sidekick = asObject(root.sidekick, 'modes.sidekick');
  return {
    admin: {
      defaultVersion: asString(admin.defaultVersion, 'modes.admin.defaultVersion') as
        | 'admin'
        | 'sidekick',
      switcherVisible: asBool(admin.switcherVisible, 'modes.admin.switcherVisible'),
      mayViewSidekickVersion: asBool(
        admin.mayViewSidekickVersion,
        'modes.admin.mayViewSidekickVersion'
      ),
    },
    sidekick: {
      defaultVersion: asString(sidekick.defaultVersion, 'modes.sidekick.defaultVersion') as
        | 'admin'
        | 'sidekick',
      switcherVisible: asBool(sidekick.switcherVisible, 'modes.sidekick.switcherVisible'),
      mayViewAdminVersion: asBool(sidekick.mayViewAdminVersion, 'modes.sidekick.mayViewAdminVersion'),
    },
  };
}

function decodeSettings(raw: unknown): HouseRulesSettings {
  const root = asObject(raw, 'settings');
  const daily = asObject(root.dailyDeadline, 'settings.dailyDeadline');
  const req = asObject(root.allowanceRequests, 'settings.allowanceRequests');
  const applies = daily.appliesTo;
  if (!Array.isArray(applies)) {
    throw new Error('house-rules decode: settings.dailyDeadline.appliesTo must be an array');
  }
  return {
    dailyDeadline: {
      label: asString(daily.label, 'dailyDeadline.label'),
      help: asString(daily.help, 'dailyDeadline.help'),
      default: asString(daily.default, 'dailyDeadline.default'),
      min: asString(daily.min, 'dailyDeadline.min'),
      max: asString(daily.max, 'dailyDeadline.max'),
      stepMinutes: asNumber(daily.stepMinutes, 'dailyDeadline.stepMinutes'),
      appliesTo: applies.map((v, i) => asString(v, `appliesTo[${i}]`)),
      takesEffect: asString(daily.takesEffect, 'dailyDeadline.takesEffect'),
      editableBy: asString(daily.editableBy, 'dailyDeadline.editableBy'),
    },
    allowanceRequests: {
      label: asString(req.label, 'allowanceRequests.label'),
      help: asString(req.help, 'allowanceRequests.help'),
      default: asBool(req.default, 'allowanceRequests.default'),
      editableBy: asString(req.editableBy, 'allowanceRequests.editableBy'),
      requires: asString(req.requires, 'allowanceRequests.requires'),
    },
  };
}

function decodeChapter(raw: unknown, index: number): Chapter {
  const row = asObject(raw, `chapters[${index}]`);
  return {
    key: assertEnum(row.key, CHAPTER_KEYS, 'chapter.key'),
    order: asNumber(row.order, 'chapter.order'),
    adminLabel: asString(row.adminLabel, 'chapter.adminLabel'),
    sidekickLabel: asString(row.sidekickLabel, 'chapter.sidekickLabel'),
    accent: typeof row.accent === 'string' ? row.accent : undefined,
    sidekickColor: typeof row.sidekickColor === 'string' ? row.sidekickColor : undefined,
  };
}

function decodeRule(raw: unknown, index: number): HouseRule {
  const row = asObject(raw, `rules[${index}]`);
  const admin = asObject(row.admin, `rules[${index}].admin`);
  const sidekick = asObject(row.sidekick, `rules[${index}].sidekick`);
  const editable = asBool(row.editable, `rules[${index}].editable`);
  const settingKey = typeof row.settingKey === 'string' ? row.settingKey : undefined;
  if (editable && !settingKey) {
    throw new Error(`house-rules decode: editable rule ${String(row.id)} missing settingKey`);
  }
  return {
    id: asString(row.id, 'rule.id'),
    chapter: assertEnum(row.chapter, CHAPTER_KEYS, 'rule.chapter'),
    order: asNumber(row.order, 'rule.order'),
    condition: assertEnum(row.condition, CONDITION_KEYS, 'rule.condition'),
    visual: assertEnum(row.visual, VISUAL_KEYS, 'rule.visual'),
    editable,
    settingKey,
    admin: {
      headline: asString(admin.headline, 'admin.headline'),
      clause: asString(admin.clause, 'admin.clause'),
    },
    sidekick: {
      headline: asString(sidekick.headline, 'sidekick.headline'),
      body: asString(sidekick.body, 'sidekick.body'),
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

  return {
    schemaVersion: asString(root.schemaVersion, 'schemaVersion'),
    contentVersion: asString(root.contentVersion, 'contentVersion'),
    constants: decodeConstants(root.constants),
    chapters,
    rules,
    modes: decodeModes(root.modes),
    settings: decodeSettings(root.settings),
    footnotes:
      root.footnotes && typeof root.footnotes === 'object'
        ? (root.footnotes as HouseRulesDoc['footnotes'])
        : undefined,
  };
}

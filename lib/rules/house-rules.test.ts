/**
 * House Rules v4 — decode, visibility, tokens, constants.
 * Spec: docs/logic/CURSOR-SPEC-house-rules.md
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LATE_CREDIT, RESCUE_COST_PCT_PER_DAY, EXPIRY_HOUR, EXPIRY_MINUTE } from '@/constants/scoring';
import { getHouseRulesDoc, __resetHouseRulesCache } from '@/lib/rules/house-rules-data';
import { decodeHouseRules } from '@/lib/rules/decode';
import {
  deadlinePickerValues,
  effectiveDailyDeadline,
  queueDailyDeadlineChange,
  settleDeadlineState,
} from '@/lib/rules/deadline';
import { interpolateHouseRulesCopy, tok } from '@/lib/rules/interpolate';
import { CONDITION_KEYS, VISUAL_KEYS, type HouseRulesHouseholdView } from '@/lib/rules/types';
import { isVisible } from '@/lib/rules/visibility';
import { visibleRuleCount, visibleRules } from '@/lib/rules/visible-rules';
import { countSidekicks, houseRulesVoiceForRole } from '@/lib/rules/household-view';
import { validateCustomHouseRule } from '@/lib/rules/custom-house-rules';

function pass(id: string, detail: string) {
  console.log(`PASS ${id} — ${detail}`);
}

function hh(partial: Partial<HouseRulesHouseholdView> = {}): HouseRulesHouseholdView {
  return {
    rewardModel: 'full_system',
    sidekickCount: 2,
    homeworkEnabled: true,
    allowanceRequestsEnabled: true,
    ...partial,
  };
}

function idsFor(model: string, extra: Partial<HouseRulesHouseholdView> = {}) {
  return visibleRules(doc, hh({ rewardModel: model, ...extra })).flatMap((g) =>
    g.rules.map((r) => r.id)
  );
}

__resetHouseRulesCache();
const doc = getHouseRulesDoc();

{
  assert.equal(doc.schemaVersion, '4.0.0');
  assert.equal(doc.rules.length, 36, '36 rules');
  assert.equal(doc.chapters.length, 7, '7 chapters');
  const conditions = new Set(doc.rules.map((r) => r.condition));
  for (const key of CONDITION_KEYS) {
    assert.ok(conditions.has(key) || key === 'ALWAYS', `condition ${key} used or ALWAYS`);
  }
  assert.equal(conditions.size, 8, '8 conditions in use');
  const visuals = new Set(doc.rules.map((r) => r.visual));
  assert.equal(VISUAL_KEYS.length, 15, '15 visual keys');
  for (const key of VISUAL_KEYS) {
    assert.ok(visuals.has(key), `visual ${key} used`);
  }
  const byChapter = Object.fromEntries(
    doc.chapters.map((c) => [c.key, doc.rules.filter((r) => r.chapter === c.key).length])
  );
  assert.equal(byChapter.earning, 6);
  assert.equal(byChapter.deadlines, 7);
  assert.equal(byChapter.streaks, 4);
  assert.equal(byChapter.crowns, 7);
  assert.equal(byChapter.rewards, 7);
  assert.equal(byChapter.proof, 2);
  assert.equal(byChapter.household, 3);
  assert.ok(
    doc.rules.filter((r) => r.editable).every((r) => Boolean(r.settingKey)),
    'editable rules have settingKey'
  );
  pass('HR1', 'JSON decodes: 36 rules, 7 chapters, 8 conditions, 15 visuals');
}

{
  assert.throws(() => {
    decodeHouseRules({
      ...doc,
      rules: [{ ...doc.rules[0], condition: 'NOT_A_REAL_CONDITION' }],
    });
  }, /unknown rule\.condition/);
  pass('HR2', 'Unknown enum fails loudly');
}

{
  const household = hh({ rewardModel: 'xp_only', sidekickCount: 2 });
  assert.equal(isVisible('ALWAYS', household), true);
  assert.equal(isVisible('XP_ON', household), true);
  assert.equal(isVisible('ALLOWANCE_ON', household), false);
  assert.equal(isVisible('REWARDS_ON', household), false);
  assert.equal(isVisible('MULTI_SIDEKICK', household), true);
  assert.equal(isVisible('SOLO_SIDEKICK', household), false);
  assert.equal(isVisible('ALLOWANCE_REQUESTS_ON', household), false);
  assert.equal(isVisible('HOMEWORK_ON', household), true);
  assert.throws(() => isVisible('NOPE' as never, household), /Unknown condition/);
  pass('HR5', 'isVisible covers all 8 condition keys');
}

{
  const ids = idsFor('xp_only');
  const allowanceHidden = doc.rules
    .filter((r) => r.condition === 'ALLOWANCE_ON' || r.condition === 'ALLOWANCE_REQUESTS_ON')
    .every((r) => !ids.includes(r.id));
  assert.ok(allowanceHidden, 'allowance rules hidden');
  const groups = visibleRules(doc, hh({ rewardModel: 'xp_only' }));
  assert.ok(groups.some((g) => g.chapter.key === 'rewards'), 'Rewards chapter still renders');
  pass('HR6', 'xp_only hides allowance rules; Rewards chapter remains');
}

{
  const ids = idsFor('allowance');
  for (const rule of doc.rules.filter((r) => r.condition === 'XP_ON')) {
    assert.ok(!ids.includes(rule.id), `${rule.id} should hide`);
  }
  pass('HR7', 'allowance household hides all XP_ON rules');
}

{
  const groups = visibleRules(doc, hh({ sidekickCount: 1 }));
  const ids = groups.flatMap((g) => g.rules.map((r) => r.id));
  const crowns = groups.find((g) => g.chapter.key === 'crowns');
  assert.ok(crowns, 'Crowns still renders for one Sidekick');
  assert.ok(ids.includes('CROWN-02'));
  assert.ok(ids.includes('CROWN-05'));
  assert.ok(ids.includes('CROWN-06'));
  assert.ok(ids.includes('CROWN-07'));
  assert.ok(!ids.includes('CROWN-01'));
  assert.ok(!ids.includes('CROWN-03'));
  assert.ok(!ids.includes('CROWN-04'));
  pass('HR8', 'one Sidekick: Crowns shows CROWN-02/05/06/07');
}

{
  const ids = idsFor('full_system', { sidekickCount: 2 });
  assert.ok(ids.includes('CROWN-01'));
  assert.ok(ids.includes('CROWN-03'));
  assert.ok(ids.includes('CROWN-04'));
  assert.ok(!ids.includes('CROWN-02'));
  pass('HR8b', 'two Sidekicks: CROWN-02 gone, 01/03/04 appear');
}

{
  const ids = idsFor('full_system', { homeworkEnabled: false });
  const groups = visibleRules(doc, hh({ homeworkEnabled: false }));
  assert.ok(!ids.includes('PROOF-02'), 'PROOF-02 hidden');
  assert.ok(groups.some((g) => g.chapter.key === 'proof'), 'Proof chapter still renders');
  pass('HR9', 'homework off hides PROOF-02; Proof remains');
}

{
  const full = visibleRuleCount(visibleRules(doc, hh()));
  const slim = visibleRuleCount(
    visibleRules(doc, hh({ rewardModel: 'allowance', sidekickCount: 1, homeworkEnabled: false, allowanceRequestsEnabled: false }))
  );
  assert.ok(slim < full, `visible ${slim} < ${full}`);
  pass('HR10', 'header count reflects visible set');
}

{
  for (const [full, late] of Object.entries(LATE_CREDIT)) {
    const jsonLate = doc.constants.lateCredit[String(full)];
    assert.equal(jsonLate, late, `lateCredit ${full}`);
  }
  assert.equal(doc.constants.streakRescue.afterOneMiss, RESCUE_COST_PCT_PER_DAY);
  assert.equal(doc.constants.nudgeMinutesBefore, 30);
  const [eh, em] = doc.constants.expiryTime.split(':').map(Number);
  assert.equal(eh, EXPIRY_HOUR);
  assert.equal(em, EXPIRY_MINUTE);
  assert.equal(doc.constants.expiredPurgeDays, 7);
  pass('HR11', 'lateCredit + rescue + expiry constants match scoring engine');
}

{
  const dead01 = doc.rules.find((r) => r.id === 'DEAD-01');
  assert.ok(dead01);
  assert.match(dead01.admin.clause, /\{dailyDeadline\}/);
  const twelve = interpolateHouseRulesCopy(dead01.admin.clause, doc.constants, hh({ use24h: false }));
  assert.match(twelve, /7:00 PM/);
  const twenty = interpolateHouseRulesCopy(dead01.admin.clause, doc.constants, hh({ use24h: true }));
  assert.match(twenty, /19:00/);
  assert.doesNotMatch(dead01.admin.clause, /7:00 PM/);
  assert.throws(() => tok('Hello {nope}', { dailyDeadline: '7:00 PM' }), /Unknown token/);
  const custom = interpolateHouseRulesCopy(dead01.admin.clause, doc.constants, hh({ dailyDeadline: '21:00', use24h: false }));
  assert.match(custom, /9:00 PM/);
  pass('HR-T', 'DEAD-01 tokens: 12h, 24h, unknown raises, household deadline');
}

{
  assert.ok(!idsFor('xp_only').includes('RWRD-03'));
  assert.ok(!idsFor('xp_only').includes('RWRD-07'));
  assert.ok(idsFor('allowance').includes('RWRD-07'));
  assert.ok(!idsFor('allowance').includes('RWRD-03'));
  assert.ok(idsFor('xp_rewards').includes('RWRD-03'));
  assert.ok(!idsFor('xp_rewards').includes('RWRD-07'));
  assert.ok(!idsFor('xp_rewards').includes('RWRD-05'));
  assert.ok(idsFor('xp_allowance').includes('RWRD-07'));
  assert.ok(!idsFor('xp_allowance').includes('RWRD-03'));
  assert.ok(idsFor('full_system').includes('RWRD-03'));
  assert.ok(idsFor('full_system').includes('RWRD-07'));
  assert.ok(!idsFor('full_system', { allowanceRequestsEnabled: false }).includes('RWRD-07'));
  pass('HR-R', 'RWRD-03 / RWRD-07 by model + allowanceRequests off');
}

{
  const illustrated = doc.rules.filter((r) => r.visual !== 'none').length;
  const quiet = doc.rules.filter((r) => r.visual === 'none').length;
  assert.equal(illustrated, 14);
  assert.equal(quiet, 22);
  pass('HR-V', '14 illustrated, 22 quiet');
}

{
  const values = deadlinePickerValues(doc);
  assert.equal(values[0], '15:00');
  assert.equal(values[values.length - 1], '23:59');
  assert.ok(values.includes('19:00'));
  assert.ok(values.includes('23:45'));
  assert.ok(values.length >= 29);
  const unset = effectiveDailyDeadline(doc, {});
  assert.equal(unset, '19:00');
  const queued = queueDailyDeadlineChange('21:00', new Date(2026, 7, 13));
  assert.equal(queued.dailyDeadlinePending, '21:00');
  assert.equal(queued.dailyDeadlineAppliesOn, '2026-08-14');
  const today = settleDeadlineState(
    doc,
    { dailyDeadline: '19:00', ...queued },
    new Date(2026, 7, 13)
  );
  assert.equal(today.dailyDeadline, '19:00');
  const tomorrow = settleDeadlineState(
    doc,
    { dailyDeadline: '19:00', ...queued },
    new Date(2026, 7, 14)
  );
  assert.equal(tomorrow.dailyDeadline, '21:00');
  assert.equal(tomorrow.dailyDeadlinePending, null);
  pass('HR-D', 'deadline picker + next-day apply');
}

{
  const members = [
    { role: 'admin' as const, status: 'active' as const },
    { role: 'child' as const, status: 'active' as const },
    { role: 'child' as const, status: 'active' as const },
    { role: 'guest' as const, status: 'active' as const },
  ];
  assert.equal(countSidekicks(members), 2);
  assert.equal(
    houseRulesVoiceForRole('child', 'admin', doc.modes),
    'sidekick'
  );
  assert.equal(houseRulesVoiceForRole('admin', 'sidekick', doc.modes), 'sidekick');
  assert.equal(doc.modes.sidekick.switcherVisible, false);
  assert.equal(doc.modes.sidekick.mayViewAdminVersion, false);
  pass('HR-M', 'sidekickCount from persisted child token; Sidekick cannot hold Admin');
}

{
  const locked = [
    'Late Credit',
    'Streak Rescue',
    'Recess',
    "The Week's Crown",
    'Monthly Sovereign',
    "Champion's Record",
    'Hold & Request',
    'Approve now',
  ];
  const blob = JSON.stringify(doc);
  for (const term of locked) {
    assert.ok(blob.includes(term), term);
  }
  pass('HR-L', 'locked vocabulary present in JSON');
}

{
  const viewFiles = [
    'app/house-rules.tsx',
    'components/orbit/house-rules/at-a-glance-view.tsx',
    'components/orbit/house-rules/rule-copy.tsx',
    'components/orbit/house-rules/visuals/xp-ramp.tsx',
    'components/orbit/house-rules/visuals/day-timeline.tsx',
    'components/orbit/house-rules/visuals/late-credit-table.tsx',
    'components/orbit/house-rules/visuals/streak-dots.tsx',
    'components/orbit/house-rules/visuals/rescue-tiers.tsx',
    'components/orbit/house-rules/visuals/podium.tsx',
    'components/orbit/house-rules/visuals/model-list.tsx',
    'components/orbit/house-rules/visuals/more-visuals.tsx',
    'components/orbit/house-rules/visuals/index.tsx',
  ];
  const joined = viewFiles.map((f) => readFileSync(join(process.cwd(), f), 'utf8')).join('\n');
  assert(!joined.includes('7:00 PM'), 'no 7:00 PM in views');
  assert(!joined.includes('100,000'), 'no 100,000 in views');
  assert(!joined.includes('Late Credit'), 'no Late Credit literal in views');
  const screen = readFileSync(join(process.cwd(), 'app/house-rules.tsx'), 'utf8');
  assert(!screen.includes('DIRECTIONS'), '4-tab explorer removed');
  assert(screen.includes('Admin'), 'Admin mode label');
  assert(screen.includes('Sidekick'), 'Sidekick mode label');
  assert(!screen.includes("'Kid'") && !screen.includes('"Kid"'), 'no Kid chrome');
  assert(!/\bChild\b/.test(screen), 'no Child chrome');
  assert(!/\bHelper\b/.test(screen), 'no Helper chrome');
  assert(!/\badult\b/.test(screen.replaceAll('householdDueTimeLocal', '')), 'no adult in screen');
  pass('T4.6', 'Zero hardcoded rule prose; At a glance only');
}

{
  const ok = validateCustomHouseRule('Screens off at 8:30', 0);
  assert.ok(ok.ok && ok.body === 'Screens off at 8:30');
  const tooMany = validateCustomHouseRule('x', 10);
  assert.ok(!tooMany.ok);
  pass('T4.7', 'Custom house rules validation (10 × 500)');
}

{
  const settings = readFileSync(join(process.cwd(), 'app/settings.tsx'), 'utf8');
  const home = readFileSync(join(process.cwd(), 'app/(tabs)/index.tsx'), 'utf8');
  assert(settings.includes('/house-rules'), 'T4.8 settings');
  assert(home.includes('/house-rules'), 'T4.8 home');
  pass('T4.8', 'House Rules reachable from Settings and Home');
}

console.log('\nAll house-rules tests passed.');

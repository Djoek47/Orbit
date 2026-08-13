/**
 * House Rules — JSON decode, visibility, Rev D STOP GATE T4.1–T4.8.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LATE_CREDIT, MONTHLY_RESCUE_TOKENS, RESCUE_COST_PCT_PER_DAY } from '@/constants/scoring';
import { getHouseRulesDoc, __resetHouseRulesCache } from '@/lib/rules/house-rules-data';
import { decodeHouseRules } from '@/lib/rules/decode';
import { interpolateHouseRulesCopy } from '@/lib/rules/interpolate';
import { KID_CARD_RULE_IDS } from '@/lib/rules/kid-card';
import { validateCustomHouseRule } from '@/lib/rules/custom-house-rules';
import { isVisible } from '@/lib/rules/visibility';
import { visibleRuleCount, visibleRules } from '@/lib/rules/visible-rules';

function pass(id: string, detail: string) {
  console.log(`PASS ${id} — ${detail}`);
}

__resetHouseRulesCache();
const doc = getHouseRulesDoc();

{
  assert.equal(doc.rules.length, 33, '33 rules');
  assert.equal(doc.chapters.length, 7, '7 chapters');
  pass('HR1', 'JSON decodes; 33 rules, 7 chapters');
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
  const hh = { rewardModel: 'xp_only', helperCount: 2, homeworkEnabled: true };
  assert.equal(isVisible('ALWAYS', hh), true);
  assert.equal(isVisible('XP_ON', hh), true);
  assert.equal(isVisible('ALLOWANCE_ON', hh), false);
  assert.equal(isVisible('REWARDS_ON', hh), false);
  pass('HR5', 'isVisible covers condition keys');
}

{
  const groups = visibleRules(doc, {
    rewardModel: 'xp_only',
    helperCount: 2,
    homeworkEnabled: true,
  });
  const ids = groups.flatMap((g) => g.rules.map((r) => r.id));
  const allowanceHidden = doc.rules
    .filter((r) => r.condition === 'ALLOWANCE_ON')
    .every((r) => !ids.includes(r.id));
  assert.ok(allowanceHidden, 'allowance rules hidden');
  pass('HR6', 'xp_only hides allowance rules');
}

{
  const groups = visibleRules(doc, {
    rewardModel: 'allowance',
    helperCount: 2,
    homeworkEnabled: true,
  });
  const ids = groups.flatMap((g) => g.rules.map((r) => r.id));
  for (const rule of doc.rules.filter((r) => r.condition === 'XP_ON')) {
    assert.ok(!ids.includes(rule.id), `${rule.id} should hide`);
  }
  pass('HR7', 'allowance household hides all XP_ON rules');
}

{
  const groups = visibleRules(doc, {
    rewardModel: 'full',
    helperCount: 1,
    homeworkEnabled: true,
  });
  assert.ok(!groups.some((g) => g.chapter.key === 'crowns'), 'no crowns chapter');
  pass('HR8', 'one-helper household: Crowns chapter absent');
}

{
  const groups = visibleRules(doc, {
    rewardModel: 'full',
    helperCount: 2,
    homeworkEnabled: false,
  });
  const ids = groups.flatMap((g) => g.rules.map((r) => r.id));
  assert.ok(!ids.includes('PROOF-02'), 'PROOF-02 hidden');
  pass('HR9', 'homework off hides PROOF-02');
}

{
  const count = visibleRuleCount(
    visibleRules(doc, { rewardModel: 'allowance', helperCount: 1, homeworkEnabled: false })
  );
  assert.ok(count < 29, `visible ${count} < 29`);
  pass('HR10', 'header count reflects visible set');
}

{
  for (const [full, late] of Object.entries(LATE_CREDIT)) {
    const jsonLate = doc.constants.lateCredit[String(full)];
    assert.equal(jsonLate, late, `lateCredit ${full}`);
  }
  assert.equal(doc.constants.streakRescue.afterOneMiss, RESCUE_COST_PCT_PER_DAY);
  assert.equal(doc.constants.streakRescue.monthlyToken, MONTHLY_RESCUE_TOKENS);
  pass('HR11', 'lateCredit + rescue constants match scoring engine');
}

{
  const rwrd = doc.rules.find((r) => r.id === 'RWRD-04');
  assert.ok(rwrd);
  assert.match(rwrd.adult.clause, /never moves money/);
  assert.match(rwrd.adult.clause, /marks it paid/);
  assert.doesNotMatch(rwrd.adult.clause, /Approve now/);
  assert.match(rwrd.kid.body, /ticks it off/);
  pass('HR-E', 'RWRD-04 matches Rev E §4.2');
}

{
  const dead01 = doc.rules.find((r) => r.id === 'DEAD-01');
  assert.ok(dead01);
  assert.match(dead01.adult.clause, /\{dailyDeadline\}/);
  const rendered = interpolateHouseRulesCopy(dead01.adult.clause, doc.constants);
  assert.match(rendered, /7:00 PM/);
  assert.doesNotMatch(dead01.adult.clause, /7:00 PM/);
  pass('HR-T', 'DEAD-01 deadline is tokenized from constants');
}

{
  for (const id of ['R30', 'R31', 'R32', 'R33']) {
    assert.ok(doc.rules.some((r) => r.id === id), id);
  }
  pass('HR-F', 'R30–R33 present');
}

function adultManual(model: string, homework = true, helpers = 2) {
  const groups = visibleRules(doc, {
    rewardModel: model,
    helperCount: helpers,
    homeworkEnabled: homework,
  });
  return groups
    .flatMap((g) => g.rules.map((r) => interpolateHouseRulesCopy(r.adult.clause, doc.constants)))
    .join(' ')
    .toLowerCase();
}

{
  const t = adultManual('xp_only');
  assert(!t.includes('allowance') && !t.includes('money'), 'T4.1');
  pass('T4.1', 'Household on xp_only → manual mentions NO money or allowance');
}

{
  const t = adultManual('allowance');
  assert(!/\bxp\b/.test(t), 'T4.2 no xp');
  assert(t.includes('allowance'), 'T4.2 has allowance');
  pass('T4.2', 'Household on allowance → manual mentions NO XP');
}

{
  const ids = visibleRules(doc, {
    rewardModel: 'full',
    helperCount: 2,
    homeworkEnabled: true,
  }).flatMap((g) => g.rules.map((r) => r.id));
  for (const need of ['EARN-01', 'DEAD-03', 'DEAD-04', 'STRK-02', 'STRK-03', 'STRK-04', 'CROWN-01', 'RWRD-04', 'PROOF-02', 'R30', 'R31', 'R32', 'R33']) {
    assert.ok(ids.includes(need), `T4.3 missing ${need}`);
  }
  pass('T4.3', 'Household on full → every section present');
}

{
  const ids = visibleRules(doc, {
    rewardModel: 'full',
    helperCount: 2,
    homeworkEnabled: false,
  }).flatMap((g) => g.rules.map((r) => r.id));
  assert.ok(!ids.includes('PROOF-02'), 'T4.4');
  pass('T4.4', 'Child with homework proof OFF → their manual omits the photo rule');
}

{
  const groups = visibleRules(doc, {
    rewardModel: 'full',
    helperCount: 2,
    homeworkEnabled: true,
  });
  const byId = new Map(groups.flatMap((g) => g.rules.map((r) => [r.id, r] as const)));
  const kid = KID_CARD_RULE_IDS.map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => interpolateHouseRulesCopy(r.kid.body, doc.constants));
  const joined = kid.join('\n\n');
  assert(joined.length <= 900, `T4.5 too long: ${joined.length}`);
  assert(!joined.includes('%'), 'T4.5 no percentages');
  pass('T4.5', `Kid HOW IT WORKS card copy budget (${joined.length} chars)`);
}

{
  const screen = readFileSync(join(process.cwd(), 'app/house-rules.tsx'), 'utf8');
  assert(!screen.includes('Late Credit'), 'no Late Credit in view');
  assert(!screen.includes('7:00 PM'), 'no 7:00 PM in view');
  assert(!screen.includes('Approve now'), 'no Approve now in view');
  assert(!screen.includes('DIRECTIONS'), '4-tab explorer retired');
  for (const rule of doc.rules.filter((r) => r.editable && r.settingKey)) {
    assert(screen.includes(rule.settingKey!), `T4.6 missing settingKey ${rule.settingKey}`);
  }
  pass('T4.6', 'Zero hardcoded rule prose in house-rules screen');
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
  assert(home.includes('/house-rules'), 'T4.8 kid home');
  pass('T4.8', 'House Rules reachable from Settings and child Home');
}

console.log('\nAll house-rules tests passed.');

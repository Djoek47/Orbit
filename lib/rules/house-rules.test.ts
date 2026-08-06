/**
 * House Rules Part 2 — decode, visibility, parity tests.
 */
import assert from 'node:assert/strict';

import { LATE_CREDIT, MONTHLY_RESCUE_TOKENS, RESCUE_COST_PCT_PER_DAY } from '@/constants/scoring';
import { getHouseRulesDoc, __resetHouseRulesCache } from '@/lib/rules/house-rules-data';
import { decodeHouseRules } from '@/lib/rules/decode';
import { isVisible } from '@/lib/rules/visibility';
import { visibleRuleCount, visibleRules } from '@/lib/rules/visible-rules';

function pass(id: string, detail: string) {
  console.log(`PASS ${id} — ${detail}`);
}

__resetHouseRulesCache();
const doc = getHouseRulesDoc();

{
  assert.equal(doc.rules.length, 29, '29 rules');
  assert.equal(doc.chapters.length, 7, '7 chapters');
  pass('HR1', 'JSON decodes; 29 rules, 7 chapters');
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
  for (const rule of doc.rules) {
    assert.ok(rule.phase, `phase required on ${rule.id}`);
  }
  pass('HR3', 'No rule has a nil phase');
}

{
  for (const rule of doc.rules) {
    if (rule.editable) {
      assert.ok(rule.settingKey, `${rule.id} needs settingKey`);
    }
  }
  pass('HR4', 'editable rules carry settingKey');
}

{
  const hh = { rewardModel: 'xp_only', helperCount: 2, homeworkEnabled: true };
  assert.equal(isVisible('ALWAYS', hh), true);
  assert.equal(isVisible('XP_ON', hh), true);
  assert.equal(isVisible('ALLOWANCE_ON', hh), false);
  assert.equal(isVisible('REWARDS_ON', hh), false);
  assert.equal(isVisible('MULTI_MEMBER', hh), true);
  assert.equal(isVisible('HOMEWORK_ON', hh), true);
  assert.equal(
    isVisible('MULTI_MEMBER', { ...hh, helperCount: 1 }),
    false
  );
  assert.equal(
    isVisible('HOMEWORK_ON', { ...hh, homeworkEnabled: false }),
    false
  );
  pass('HR5', 'isVisible covers all 6 condition keys');
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
  assert.ok(
    groups.some((g) => g.chapter.key === 'rewards'),
    'Rewards chapter still renders'
  );
  pass('HR6', 'xp_only hides allowance rules; Rewards chapter survives');
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
  assert.ok(groups.some((g) => g.chapter.key === 'proof'), 'Proof chapter remains');
  pass('HR9', 'homework off hides PROOF-02; Proof chapter remains');
}

{
  const groups = visibleRules(doc, {
    rewardModel: 'allowance',
    helperCount: 1,
    homeworkEnabled: false,
  });
  const count = visibleRuleCount(groups);
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
  // Contiguous display numbers after filter
  const groups = visibleRules(doc, {
    rewardModel: 'full',
    helperCount: 2,
    homeworkEnabled: true,
  });
  for (const g of groups) {
    g.rules.forEach((r, i) => {
      assert.equal(r.displayNumber, `${g.chapter.order}.${i + 1}`);
    });
  }
  pass('HR12', 'clause numbers contiguous with no gaps');
}

console.log('\nAll house-rules tests passed.');

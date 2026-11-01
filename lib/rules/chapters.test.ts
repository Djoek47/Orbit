/**
 * WO14 §9 — every rule belongs to exactly one chapter; digest counts match.
 */
import assert from 'node:assert/strict';

import { mockHousehold } from '@/data/mock-household';
import { getHouseRulesDoc, __resetHouseRulesCache } from '@/lib/rules/house-rules-data';
import { houseRulesHouseholdView } from '@/lib/rules/household-view';
import type { HouseRulesHouseholdView } from '@/lib/rules/types';
import { visibleRules } from '@/lib/rules/visible-rules';

function pass(id: string, detail: string) {
  console.log(`PASS ${id} — ${detail}`);
}

__resetHouseRulesCache();
const doc = getHouseRulesDoc();

{
  assert.ok(doc.chapters.length >= 1, 'chapters array is filled');
  for (const chapter of doc.chapters) {
    assert.ok(chapter.id, `chapter ${chapter.key} has id`);
    assert.ok(chapter.title || chapter.adminLabel, `chapter ${chapter.key} has title`);
    assert.ok(chapter.description, `chapter ${chapter.key} has description`);
    assert.ok(chapter.icon, `chapter ${chapter.key} has icon`);
  }
  pass('CH0', `${doc.chapters.length} chapters have id/title/description/icon`);
}

{
  const chapterIds = new Set(doc.chapters.map((c) => c.id ?? c.key));
  const seen = new Map<string, string>();
  for (const rule of doc.rules) {
    assert.ok(rule.chapterId, `rule ${rule.id} has chapterId`);
    assert.equal(rule.chapterId, rule.chapter, `rule ${rule.id} chapterId matches chapter`);
    assert.ok(
      chapterIds.has(rule.chapterId),
      `rule ${rule.id} chapterId ${rule.chapterId} exists in chapters`
    );
    const prev = seen.get(rule.id);
    assert.equal(prev, undefined, `rule ${rule.id} appears once`);
    seen.set(rule.id, rule.chapterId);
  }
  pass('CH1', `all ${doc.rules.length} rules map to exactly one chapter`);
}

{
  for (const chapter of doc.chapters) {
    const id = chapter.id ?? chapter.key;
    const count = doc.rules.filter((r) => (r.chapterId ?? r.chapter) === id).length;
    assert.ok(count > 0, `chapter ${id} has rules in JSON`);
  }
  const total = doc.chapters.reduce(
    (sum, c) =>
      sum + doc.rules.filter((r) => (r.chapterId ?? r.chapter) === (c.id ?? c.key)).length,
    0
  );
  assert.equal(total, doc.rules.length, 'chapter counts sum to total rules');
  pass('CH2', 'chapter rule counts sum to total rules');
}

{
  const view: HouseRulesHouseholdView = houseRulesHouseholdView(mockHousehold);
  const groups = visibleRules(doc, view);
  for (const group of groups) {
    const id = group.chapter.id ?? group.chapter.key;
    const sourceCount = doc.rules.filter((r) => (r.chapterId ?? r.chapter) === id).length;
    assert.ok(group.rules.length <= sourceCount, `digest count for ${id} ≤ source`);
    assert.ok(group.rules.length >= 1, `digest omits empty chapter ${id}`);
    assert.equal(
      group.rules.length,
      group.rules.filter((r) => (r.chapterId ?? r.chapter) === id).length,
      `digest row count for ${id} matches grouped rules`
    );
  }
  const digestIds = groups.map((g) => g.chapter.id ?? g.chapter.key);
  assert.equal(new Set(digestIds).size, digestIds.length, 'digest chapters unique');
  pass('CH3', `digest shows ${groups.length} chapters; counts match grouped rules`);
}

console.log('All chapters tests passed.');

/**
 * Sidekick sync merge tests (no React Native imports).
 * Run: npx tsx lib/household/map-household-settings.test.ts
 */
import assert from 'node:assert/strict';

import {
  mapCustomHouseRulesFromRows,
  mapHouseholdSettingsFromRow,
  mapMemberCapabilitiesFromRow,
} from '@/lib/household/map-household-settings';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import type { HouseholdSnapshot } from '@/types/orbit';

{
  const patch = mapHouseholdSettingsFromRow({
    id: 'hh-1',
    name: 'Rivera',
    reward_mode: 'flat',
    reward_model: 'xp_rewards',
    hygiene_rewarded: true,
    hygiene_xp: 10,
    daily_deadline: '21:00',
    daily_deadline_pending: '22:00',
    daily_deadline_applies_on: '2026-09-02',
    allowance_requests_enabled: false,
    join_approval_required: true,
    sidekick_grocery_add: true,
    member_capabilities: {
      allowRewardRedeem: false,
      allowCalendarCreate: true,
      allowSpecialRewardRequest: true,
    },
  });

  assert.equal(patch.rewardMode, 'flat');
  assert.equal(patch.rewardModel, 'xp_rewards');
  assert.equal(patch.hygieneRewarded, true);
  assert.equal(patch.hygieneXp, 10);
  assert.equal(patch.dailyDeadline, '21:00');
  assert.equal(patch.dailyDeadlinePending, '22:00');
  assert.equal(patch.allowanceRequestsEnabled, false);
  assert.equal(patch.sidekickGroceryAdd, true);
  assert.equal(patch.memberCapabilities?.allowRewardRedeem, false);
  assert.equal(patch.memberCapabilities?.allowCalendarCreate, true);

  const caps = resolveMemberCapabilities({ memberCapabilities: patch.memberCapabilities });
  assert.equal(caps.allowRewardRedeem, false);
  assert.equal(caps.allowCalendarCreate, true);
}

{
  const caps = mapMemberCapabilitiesFromRow(null);
  assert.equal(caps, undefined);
}

{
  const rules = mapCustomHouseRulesFromRows([
    { id: 'r1', body: 'Shoes off at the door.', sort_order: 1 },
  ]);
  assert.equal(rules?.length, 1);
  assert.equal(rules?.[0]?.body, 'Shoes off at the door.');
}

{
  const current = {
    id: 'hh-1',
    householdName: 'Rivera',
    memberCapabilities: {
      allowRewardRedeem: true,
      allowSpecialRewardRequest: false,
      allowAllowance: true,
      allowGroceryAdd: false,
      allowCalendarCreate: false,
      requireSidekickEventApproval: true,
    },
  } satisfies Pick<HouseholdSnapshot, 'id' | 'householdName' | 'memberCapabilities'>;

  const patch = mapHouseholdSettingsFromRow({
    member_capabilities: { allowCalendarCreate: true, allowRewardRedeem: false },
    sidekick_grocery_add: true,
    reward_mode: 'flat',
  });

  const merged = { ...current, ...patch, customHouseRules: mapCustomHouseRulesFromRows([{ id: 'r1', body: 'Be kind.', sort_order: 0 }]) };
  const caps = resolveMemberCapabilities(merged);
  assert.equal(caps.allowCalendarCreate, true);
  assert.equal(caps.allowRewardRedeem, false);
  assert.equal(merged.rewardMode, 'flat');
  assert.equal(merged.sidekickGroceryAdd, true);
}

console.log('PASS map-household-settings');

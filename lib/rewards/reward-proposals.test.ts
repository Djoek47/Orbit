/**
 * Revision G §7.4 proposal cadence.
 * Run: npx --yes tsx lib/rewards/reward-proposals.test.ts
 */
import assert from 'node:assert/strict';

import { canProposeReward, PROPOSAL_COOLDOWN_DAYS, proposalPayload } from './reward-proposals';

{
  assert.equal(canProposeReward({ hasOpenProposal: true }).ok, false);
  assert.equal(canProposeReward({ hasOpenProposal: false }).ok, true);
  const now = new Date('2026-08-20T12:00:00Z');
  const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const cooldown = canProposeReward({ hasOpenProposal: false, lastProposedAt: recent, now });
  assert.equal(cooldown.ok, false);
  if (!cooldown.ok) assert.equal(cooldown.reason, 'cooldown');
  const old = new Date(now.getTime() - (PROPOSAL_COOLDOWN_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(canProposeReward({ hasOpenProposal: false, lastProposedAt: old, now }).ok, true);
  assert.deepEqual(proposalPayload(' Extra screen ', '  note  '), { title: 'Extra screen', note: 'note' });
  assert.deepEqual(proposalPayload('Bike'), { title: 'Bike' });
  console.log('PASS proposal open + 7-day cooldown');
}

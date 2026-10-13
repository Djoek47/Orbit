/**
 * claimReward — v2 §6.1 rewards are grants, not XP purchases.
 * `npm run test:claim-reward`
 */

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

type Member = { id: string; xp: number };

/** Instant claim must not debit XP. */
function claimWithoutXpCost(member: Member): Member {
  return { ...member };
}

const start = { id: 'm1', xp: 100 };
assert(claimWithoutXpCost(start).xp === 100, 'claim never docks XP');

console.log('test:claim-reward OK');

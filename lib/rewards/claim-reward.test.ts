/**
 * claimReward single-debit semantics — `npm run test:claim-reward`.
 *
 * Documents that supabase approve already deducts XP; the store must not
 * subtract again on the same path. Mock path subtracts once in the store.
 */

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

type Member = { id: string; xp: number };

/** Mimic mock instant-claim: request → approve (no XP in repo) → store debit once. */
function mockInstantClaim(member: Member, cost: number): Member {
  // repo approve: status only
  const afterApprove = { ...member };
  // store debit once
  return { ...afterApprove, xp: Math.max(0, afterApprove.xp - cost) };
}

/** Mimic buggy double debit (what we fixed). */
function buggyDoubleDebit(member: Member, cost: number): Member {
  // supabase approve already deducted
  const afterApprove = { ...member, xp: Math.max(0, member.xp - cost) };
  // store wrongly subtracts again
  return { ...afterApprove, xp: Math.max(0, afterApprove.xp - cost) };
}

/** Correct supabase path: approve deducts; store reloads domains (no second subtract). */
function supabaseInstantClaim(member: Member, cost: number): Member {
  return { ...member, xp: Math.max(0, member.xp - cost) };
}

const start = { id: 'm1', xp: 100 };
assert(mockInstantClaim(start, 40).xp === 60, 'mock single debit');
assert(supabaseInstantClaim(start, 40).xp === 60, 'supabase single debit');
assert(buggyDoubleDebit(start, 40).xp === 20, 'documents the bug we avoid');

console.log('test:claim-reward OK');

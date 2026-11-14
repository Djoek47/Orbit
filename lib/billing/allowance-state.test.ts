import assert from 'node:assert/strict';

import { TOKENS_PER_MONTH } from '../../constants/poppins-ai-rates';
import { summarizeActUsage, type ActEvent } from '../ai/act-events';
import { summarizeCredits } from './credit-ledger';
import {
  allowanceFraction,
  currentMonthlyAllowance,
  resetMonthlyAllowance,
  setCurrentMonthlyAllowance,
} from './allowance-state';

const NOW = '2026-10-07T12:00:00.000Z';

function act(tokens: number): ActEvent {
  return {
    id: `e-${Math.random().toString(36).slice(2)}`,
    at: NOW,
    memberId: 'm1',
    memberName: 'Nero',
    tokens,
    outcome: 'committed',
  } as unknown as ActEvent;
}

// ── Defaults to what the app always did ───────────────────────────────────────
resetMonthlyAllowance();
assert.equal(currentMonthlyAllowance(), TOKENS_PER_MONTH, 'paid behaviour unless told otherwise');

// ── Paid household: 300 a month, nothing bought ──────────────────────────────
const paid = summarizeActUsage([act(10)], [], { now: NOW });
assert.equal(paid.tripped, false);
assert.equal(paid.tokensRemaining > 0, true);

// ── Trial household: zero allowance ──────────────────────────────────────────
setCurrentMonthlyAllowance(0);

// Nothing bought: Poppins is paused before it has said a word. This is the trial lock.
const trialEmpty = summarizeActUsage([], [], { now: NOW, topUpBalance: 0 });
assert.equal(trialEmpty.tripped, true, 'a trial with no credits cannot run Poppins');
assert.equal(trialEmpty.tokensRemaining, 0);

// A pack bought: Poppins runs, and runs on exactly what was bought — not 300 more on top.
const trialBought = summarizeActUsage([], [], { now: NOW, topUpBalance: 200 });
assert.equal(trialBought.tripped, false, 'buying a pack unlocks Poppins on a trial');
assert.equal(trialBought.tokensRemaining, 200, 'and only the pack is spendable');

// Spending some of it leaves the rest.
const trialSpending = summarizeActUsage([act(35)], [], { now: NOW, topUpBalance: 165 });
assert.equal(trialSpending.tripped, false);
assert.equal(trialSpending.tokensRemaining, 165);

// The credits screen agrees: no free month, the bought balance is the whole story.
const credits = summarizeCredits([], 0);
assert.equal(credits.monthlyLeft, 0, '"This month" reads 0 on a trial, not 300');

// An explicit allowance always wins over the household's, for callers that know better.
assert.equal(summarizeActUsage([], [], { now: NOW, monthlyAllowance: 300 }).tripped, false);

// ── Fractions never divide by zero ───────────────────────────────────────────
// The orb's glow and the 80% warning divide by the allowance; NaN in a style renders nothing.
assert.equal(allowanceFraction(0, 0), 0);
assert.equal(allowanceFraction(10, 0), 1);
assert.equal(allowanceFraction(150, 300), 0.5);
assert.equal(allowanceFraction(400, 300), 1, 'clamped');
assert.ok(Number.isFinite(allowanceFraction(5, 0)));

// ── Bad input cannot hand out actions ────────────────────────────────────────
setCurrentMonthlyAllowance(-50);
assert.equal(currentMonthlyAllowance(), 0, 'never negative');
setCurrentMonthlyAllowance(Number.NaN);
assert.equal(currentMonthlyAllowance(), TOKENS_PER_MONTH, 'garbage falls back to the paid default');
setCurrentMonthlyAllowance(12.7);
assert.equal(currentMonthlyAllowance(), 13, 'whole actions only');

resetMonthlyAllowance();
console.log('allowance-state: ok');

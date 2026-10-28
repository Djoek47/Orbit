/**
 * Overlapping hydrations must recover once and leave offered/in_progress intact.
 * Run: npx --yes tsx lib/tour/tour-hydrate.test.ts
 */
import assert from 'node:assert/strict';

import { createHydrationInFlight, runHydrateTourPass } from '@/lib/tour/tour-hydrate';
import { offerTourState, startTourState } from '@/lib/tour/tour-store';
import { emptyTourState, type TourState } from '@/lib/tour/tour-types';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function overlappingHydrations(seed: TourState) {
  const flight = createHydrationInFlight();
  let recoverBody = 0;
  let live: TourState = { ...seed };
  const saved: TourState[] = [];
  const tracked: string[] = [];

  const recover = async () => {
    recoverBody += 1;
    await delay(25);
    if (recoverBody >= 2) {
      live = { ...live, status: 'skipped' };
      return { recovered: true, reason: 'blank_launches' };
    }
    return { recovered: false };
  };

  const input = {
    key: 'hh-1:member-1:admin' as const,
    flight,
    recover,
    loadState: async () => live,
    saveState: async (state: TourState) => {
      saved.push(state);
      live = state;
    },
    trackOffered: (reason: 'upgrade' | 'new') => {
      tracked.push(reason);
    },
    isUpgrade: true,
    tourId: 'admin' as const,
  };

  const [a, b] = await Promise.all([
    runHydrateTourPass({ ...input, cancelled: () => false }),
    runHydrateTourPass({ ...input, cancelled: () => false }),
  ]);

  return { a, b, recoverBody, live, saved, tracked };
}

async function main() {
  {
    const seed = startTourState('admin');
    const { a, b, recoverBody, live, saved } = await overlappingHydrations(seed);
    assert.equal(recoverBody, 1, 'recovery body runs once for overlapping hydrations');
    assert.equal(
      [a.skippedInFlight, b.skippedInFlight].filter(Boolean).length,
      1,
      'the second same-key run returns immediately'
    );
    const kept = a.state ?? b.state;
    assert.equal(kept?.status, 'in_progress');
    assert.equal(live.status, 'in_progress', 'in_progress must not be skipAllTours’d');
    assert.equal(saved.length, 0, 'must not re-offer over an in_progress tour');
  }

  {
    const seed = offerTourState('admin');
    const { recoverBody, live } = await overlappingHydrations(seed);
    assert.equal(recoverBody, 1);
    assert.equal(live.status, 'offered', 'offered must survive a healthy overlapping launch');
  }

  {
    const flight = createHydrationInFlight();
    let cancelled = false;
    const saved: TourState[] = [];
    const tracked: string[] = [];
    const pass = runHydrateTourPass({
      key: 'hh-1:member-1:admin',
      flight,
      cancelled: () => cancelled,
      recover: async () => {
        await delay(20);
        return { recovered: false };
      },
      loadState: async () => emptyTourState('admin'),
      saveState: async (state) => {
        saved.push(state);
      },
      trackOffered: (reason) => {
        tracked.push(reason);
      },
      isUpgrade: true,
      tourId: 'admin',
    });
    cancelled = true;
    const result = await pass;
    assert.equal(result.state, null);
    assert.equal(saved.length, 0, 'cancelled run must not saveTourState');
    assert.equal(tracked.length, 0, 'cancelled run must not track tour.offered');
  }

  console.log('PASS tour-hydrate overlapping recover + cancelled persist');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

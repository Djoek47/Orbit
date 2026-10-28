/**
 * WO16 §6 — IUI tier harness tests.
 * Run: npx --yes tsx lib/poppins/iui-tiers.test.ts
 */
import assert from 'node:assert/strict';

import { hearAndDrive } from '@/lib/poppins/aiuic';
import { resolveBaseUtterance } from '@/lib/poppins/base-utterance';
import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';
import { poppinsUiOrchestrator as O } from '@/lib/poppins/ui-orchestrator';
import type { IuiBeat } from '@/lib/poppins/ui-scenes';
import type { IuiCommitReverse } from '@/lib/poppins/iui-reverse';
import { resetTurnOwnership } from '@/lib/poppins/turn-ownership';

const commits: string[] = [];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitUntil(pred: () => boolean, ms = 3500, step = 40) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (pred()) return true;
    await sleep(step);
  }
  return pred();
}

function reset(
  handler?: (beat: IuiBeat) => Promise<{ ok: boolean; reverse?: IuiCommitReverse | null }>
) {
  commits.length = 0;
  // Each case is a fresh session: no turn or commit memory carried from the last case.
  resetTurnOwnership();
  O.clear();
  O.setSpeaking(false);
  O.setCommitHandler(async (beat) => {
    const name =
      beat.payload.groceryName ?? beat.payload.title ?? beat.payload.rewardName ?? beat.payload.write;
    commits.push(`${beat.payload.write ?? 'none'}:${name}`);
    if (handler) return handler(beat);
    const write = beat.payload.write ?? 'none';
    if (
      write === 'claim_reward' ||
      write === 'create_itinerary_stop' ||
      write === 'advance_itinerary'
    ) {
      return { ok: true, reverse: null };
    }
    if (beat.payload.items?.length) {
      const batch = beat.payload.items
        .filter((i) => !i.dropped)
        .map((item) => ({
          write,
          entityId: `e-${item.id}`,
          itemId: item.id,
          label: item.label,
          beatId: beat.id,
        }));
      return {
        ok: true,
        reverse: { write, entityId: batch[batch.length - 1]!.entityId, beatId: beat.id, batch },
      };
    }
    return { ok: true, reverse: { write, entityId: 'e1', beatId: beat.id } };
  });
}

async function main() {
  // 1. Base, no speaking: jam → commit, result_mark, undoCount === 1
  {
    reset();
    hearAndDrive('add jam to the list', ['Noah', 'Mia']);
    assert.equal(O.getState().phase !== 'narrow', true, 'jam is confident');
    await waitUntil(() => commits.length >= 1, 4000);
    if (!commits.length) {
      O.confirm({ fromTap: true });
      await waitUntil(() => commits.length >= 1, 2000);
    }
    await waitUntil(() => O.undoCount() >= 1, 2000);
    assert.ok(commits.some((c) => /jam/i.test(c)), `expected jam commit, got ${commits}`);
    assert.equal(O.undoCount(), 1, `undoCount after jam, got ${O.undoCount()}`);
    console.log('1 PASS Base jam commit + undo');
  }

  // 2. Base, narrow + chip tap → Jam commit, result_mark, undoCount === 1
  {
    reset();
    hearAndDrive('add kam to the list', ['Noah']);
    assert.equal(O.getState().phase, 'narrow');
    const chips = O.getState().playlist[0]?.payload.chips;
    assert.equal(chips?.length, 2);
    const jam = chips!.find((c) => /jam/i.test(c.label)) ?? chips![0]!;
    O.chooseFromTap(
      { groceryName: jam.label, title: jam.label, selectedChipId: jam.id },
      jam.label,
      'chip'
    );
    await waitUntil(() => commits.length >= 1, 3500);
    if (!commits.length) {
      O.confirm({ fromTap: true });
      await waitUntil(() => commits.length >= 1, 2000);
    }
    await waitUntil(() => O.undoCount() >= 1, 2500);
    assert.ok(commits.some((c) => /jam/i.test(c)), `commits ${commits}`);
    assert.equal(O.undoCount(), 1, `narrow undoCount got ${O.undoCount()}`);
    const scenes = mapUiActionsToPlaylist([
      {
        type: 'add_grocery',
        name: '',
        provisional: true,
        chips: [
          { id: 'a', label: 'Ham' },
          { id: 'b', label: 'Jam' },
        ],
      },
    ]).map((b) => b.scene);
    assert.ok(scenes.includes('result_mark'), `narrow playlist needs result_mark: ${scenes}`);
    console.log('2 PASS Base narrow chip + undo');
  }

  // 3. Base, unnamed grocery — not local_write / not "Added that…"
  {
    reset();
    const result = await resolveBaseUtterance('add something to the grocery list', {
      memberNames: ['Noah'],
      ask: async () => ({ answer: 'What should I add?' }),
    });
    assert.notEqual(result.kind, 'local_write');
    assert.equal(/Added that/i.test(result.answer), false, result.answer);
    console.log('3 PASS unnamed grocery not false confirm');
  }

  // 4. Base, model down: clear grocery still resolves locally
  {
    reset();
    const result = await resolveBaseUtterance('clear the grocery list', {
      memberNames: ['Noah'],
      ask: async () => {
        throw new Error('model_unavailable');
      },
    });
    assert.equal(result.calledModel, false);
    assert.ok(
      result.kind === 'local_write' || result.kind === 'offline_local',
      `kind=${result.kind}`
    );
    assert.match(result.answer, /clear/i);
    console.log('4 PASS clear grocery model-down');
  }

  // 5. Base, capability not shadowed
  {
    reset();
    hearAndDrive('give Mia 5 dollars allowance', ['Mia', 'Noah']);
    const beat = O.getState().playlist[0];
    assert.equal(beat?.payload.write, 'grant_allowance', `scene=${beat?.scene}`);
    assert.notEqual(beat?.scene, 'coach_steps');

    reset();
    hearAndDrive('who is ahead', ['Mia', 'Noah']);
    const ranks = O.getState().playlist[0];
    assert.equal(ranks?.scene, 'ranks_peek', `got ${ranks?.scene}`);
    console.log('5 PASS allowance + ranks not shadowed');
  }

  // 6. Max, speaking around the turn — never narrow with chips undefined; never commit raw kam
  {
    reset();
    hearAndDrive('add kam to the list', ['Noah']);
    assert.equal(O.getState().phase, 'narrow');
    O.setSpeaking(true);
    O.drive([{ type: 'add_grocery', name: 'kam', title: 'kam', provisional: false }], {
      replace: false,
    });
    const mid = O.getState();
    const midBeat = mid.playlist[mid.index];
    assert.equal(
      mid.phase === 'narrow' && midBeat?.payload.chips === undefined,
      false,
      `blank narrow: phase=${mid.phase} chips=${midBeat?.payload.chips?.length}`
    );
    if (mid.phase === 'narrow') {
      assert.equal(midBeat?.payload.chips?.length, 2);
    }
    O.setSpeaking(false);
    await sleep(1200);
    assert.equal(
      commits.some((c) => /^add_grocery:kam$/i.test(c)),
      false,
      `must not commit kam: ${commits}`
    );
    console.log('6 PASS Max speaking no blank / no kam commit');
  }

  // 7. Max, hold interrupted — commit exactly once
  {
    reset();
    hearAndDrive('add jam to the list', ['Noah']);
    O.setSpeaking(false);
    await sleep(400);
    if (O.getState().holding || O.getState().phase === 'hold' || O.getState().phase === 'unfold') {
      O.setSpeaking(true);
      await sleep(200);
      O.setSpeaking(false);
    }
    await waitUntil(() => commits.length >= 1, 4000);
    if (!commits.length) {
      O.confirm({ fromTap: true });
      await waitUntil(() => commits.length >= 1, 2000);
    }
    await sleep(900);
    const jamCommits = commits.filter((c) => /jam/i.test(c));
    assert.equal(jamCommits.length, 1, `expected one jam commit, got ${commits}`);
    console.log('7 PASS hold interrupted once');
  }

  // 8. No-reverse writes: claim_reward → undoCount === 0
  {
    reset();
    O.drive([{ type: 'claim_reward', rewardName: 'Movie night' }]);
    O.confirm({ fromTap: true });
    await waitUntil(() => commits.some((c) => c.startsWith('claim_reward')), 2000);
    assert.ok(commits.some((c) => c.startsWith('claim_reward')));
    assert.equal(O.undoCount(), 0, `undoCount should be 0, got ${O.undoCount()}`);
    console.log('8 PASS claim_reward no undo');
  }

  // 9. Homework batch: items.length === 2
  {
    const playlist = mapUiActionsToPlaylist([
      {
        type: 'create_task',
        title: 'Math',
        memberName: 'Noah',
        items: [
          { id: 'h1', label: 'Math homework', assignee: 'Noah', category: 'homework_education' },
          { id: 'h2', label: 'Reading homework', assignee: 'Noah', category: 'homework_education' },
        ],
      },
    ]);
    const hw = playlist.find((b) => b.scene === 'homework_compose');
    assert.ok(hw, 'homework_compose beat');
    assert.equal(hw!.payload.items?.length, 2, 'two homework rows on payload');
    console.log('9 PASS homework batch items');
  }

  // 10. Task batch: undoLedgerRows returns two distinct labels
  {
    reset(async (beat) => {
      const write = beat.payload.write ?? 'create_task';
      const items = beat.payload.items?.filter((i) => !i.dropped) ?? [];
      const batch = items.map((item) => ({
        write,
        entityId: `e-${item.id}`,
        itemId: item.id,
        label: item.label,
        beatId: beat.id,
      }));
      return {
        ok: true,
        reverse: { write, entityId: batch[0]!.entityId, beatId: beat.id, batch },
      };
    });
    O.drive([
      {
        type: 'create_task',
        title: 'Bins',
        memberName: 'Noah',
        items: [
          { id: '1', label: 'Bins', assignee: 'Noah', due: 'today' },
          { id: '2', label: 'Dishes', assignee: 'Noah', due: 'today' },
        ],
      },
    ]);
    O.revise({ composeReady: true, provisional: false });
    await O.confirm({ fromTap: true });
    let rows: Array<{ id: string; label: string }> = [];
    await waitUntil(() => {
      rows = O.undoLedgerRows();
      return rows.length >= 2;
    }, 2500);
    const labels = rows.map((r) => r.label);
    assert.ok(labels.length >= 2, `expected ≥2 ledger rows, got ${JSON.stringify(rows)}`);
    assert.notEqual(labels[0], labels[1], `distinct labels, got ${labels}`);
    console.log('10 PASS task batch distinct undo labels');
  }

  console.log('iui-tiers.test.ts: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

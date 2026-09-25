/**
 * Replays the TestFlight screenshots through the real Poppins pipeline, both tiers.
 * Run: npx --yes tsx scripts/poppins-tier-replay.ts
 *
 * Base = the local grammar only, Poppins never "speaking".
 * Max  = the same, plus a model plan arriving ~1s later while Poppins speaks.
 * Every scenario must end with exactly the expected writes and a visible stage throughout.
 */
import assert from 'node:assert/strict';

import { driveAiuic, hearAndDrive } from '@/lib/poppins/aiuic';
import { resolveBaseUtterance } from '@/lib/poppins/base-utterance';
import { stageHeaderLabel } from '@/lib/poppins/stage-header';
import { stageSceneKey } from '@/lib/poppins/stage-scene';
import { resetTurnOwnership } from '@/lib/poppins/turn-ownership';
import { poppinsUiOrchestrator as O } from '@/lib/poppins/ui-orchestrator';
import { IUI_SCENES } from '@/lib/poppins/ui-scenes';

const MEMBERS = ['Nero', 'Mia'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const writes: string[] = [];
const blanks: string[] = [];
const CARDED = new Set<string>([...IUI_SCENES, 'narrow']);

/** Sample the stage every 40 ms: the header must be human and the scene must have a card. */
function watch(tag: string) {
  const id = setInterval(() => {
    const s = O.getState();
    if (!s.live) return;
    const beat = s.playlist[s.index];
    if (!beat) {
      blanks.push(`${tag}: live with no beat`);
      return;
    }
    const key = stageSceneKey(s.phase, beat);
    if (!CARDED.has(key)) blanks.push(`${tag}: no card for ${key}`);
    const header = stageHeaderLabel(s, 'Poppins');
    if (/_|COMPOSE|MARK · LIVE/.test(header)) blanks.push(`${tag}: raw header ${header}`);
  }, 40);
  return () => clearInterval(id);
}

function reset() {
  writes.length = 0;
  resetTurnOwnership();
  O.clear();
  O.setSpeaking(false);
  O.setCommitHandler(async (beat) => {
    const p = beat.payload;
    writes.push(`${p.write}:${p.groceryName ?? p.title ?? ''}${p.assignee ? `>${p.assignee}` : ''}`);
    return { reverse: { write: p.write as never, entityId: `e${writes.length}`, beatId: beat.id } };
  });
  O.setUndoHandler(async () => undefined);
}

function snapshot() {
  const s = O.getState();
  const beat = s.playlist[s.index];
  return `${stageHeaderLabel(s, 'Poppins').padEnd(24)} scene=${beat ? stageSceneKey(s.phase, beat) : '-'} ` +
    `title=${JSON.stringify(beat?.payload.title ?? beat?.payload.groceryName ?? '')} ` +
    `who=${beat?.payload.assignee ?? '-'} undo=${O.undoCount()}`;
}

async function scenario(name: string, fn: () => Promise<void>) {
  reset();
  const stop = watch(name);
  console.log(`\n▸ ${name}`);
  await fn();
  stop();
  console.log(`  writes: ${JSON.stringify(writes)}`);
}

async function main() {
  // ── BASE ────────────────────────────────────────────────────────────────────────────
  await scenario('BASE · "assign a task to clean my dishes" → pick Nero → Today', async () => {
    O.beginTurn();
    hearAndDrive('assign a task to clean my dishes', MEMBERS, { userOriginated: true });
    await sleep(300);
    console.log(`  who?:    ${snapshot()}`);
    O.chooseFromTap({ assignee: 'Nero', spokenName: 'Nero' }, 'Nero', 'face');
    await sleep(200);
    console.log(`  when?:   ${snapshot()}`);
    O.chooseFromTap({ due: 'Today' }, 'Today', 'when');
    await sleep(1400);
    console.log(`  settled: ${snapshot()}`);
    assert.deepEqual(writes, ['create_task:Clean Dishes>Nero']);
    assert.equal(O.undoCount(), 1, 'Undo is offered');
  });

  await scenario('BASE · "add kam to the list" → tap Jam', async () => {
    O.beginTurn();
    hearAndDrive('add kam to the list', MEMBERS, { userOriginated: true });
    await sleep(200);
    console.log(`  narrow:  ${snapshot()}`);
    O.chooseFromTap(
      { groceryName: 'Jam', title: 'Jam', selectedChipId: 'jam', provisional: false, composeReady: true },
      'Jam',
      'chip'
    );
    await sleep(1400);
    console.log(`  settled: ${snapshot()}`);
    assert.deepEqual(writes, ['add_grocery:Jam']);
    assert.equal(O.undoCount(), 1, 'the narrow path keeps its Undo');
  });

  await scenario('BASE · model down · "clear the grocery list" still works', async () => {
    O.beginTurn();
    const r = await resolveBaseUtterance('clear the grocery list', {
      memberNames: MEMBERS,
      ask: async () => {
        throw new Error('model down');
      },
    });
    console.log(`  resolved: kind=${r.kind} calledModel=${r.calledModel} answer=${JSON.stringify(r.answer)}`);
    assert.equal(r.calledModel, false);
    await O.confirm({ fromTap: true });
    await sleep(200);
    assert.deepEqual(writes, ['clear_grocery:']);
  });

  await scenario('BASE · "add something to the grocery list" never claims success', async () => {
    O.beginTurn();
    const r = await resolveBaseUtterance('add something to the grocery list', {
      memberNames: MEMBERS,
      ask: async () => ({ answer: 'What should I add?' }),
    });
    console.log(`  resolved: kind=${r.kind} answer=${JSON.stringify(r.answer)}`);
    assert.notEqual(r.kind, 'local_write');
    assert.ok(!/^added/i.test(r.answer));
    await sleep(900);
    assert.deepEqual(writes, []);
  });

  // ── MAX ─────────────────────────────────────────────────────────────────────────────
  await scenario('MAX · screenshot 6 — words stage "Clean Dishes", model plans "Wash the dishes → Nero"', async () => {
    O.beginTurn();
    hearAndDrive('assign a task to clean my dishes', MEMBERS, { userOriginated: true });
    O.setSpeaking(true); // Poppins starts answering
    await sleep(600);
    driveAiuic([{ type: 'create_task_draft', title: 'Wash the dishes', assignee: 'Nero', due: 'Today' }],
      'assign a task to clean my dishes', { memberNames: MEMBERS, source: 'model' });
    console.log(`  refined: ${snapshot()}`);
    await sleep(700);
    O.setSpeaking(false); // reply ends → hold resumes
    await sleep(1400);
    console.log(`  settled: ${snapshot()}`);
    assert.deepEqual(writes, ['create_task:Clean Dishes>Nero'], 'one task, not two');
  });

  await scenario('MAX · screenshot 2 — model plan lands after the act already committed', async () => {
    O.beginTurn();
    hearAndDrive('assign the dishes to Nero today', MEMBERS, { userOriginated: true });
    await sleep(1400);
    driveAiuic([{ type: 'create_task_draft', title: 'Wash the dishes', assignee: 'Nero', due: 'Today' }],
      'assign the dishes to Nero today', { memberNames: MEMBERS, source: 'model' });
    await sleep(1400);
    console.log(`  after:   ${snapshot()}`);
    assert.equal(writes.length, 1, 'no second write');
  });

  await scenario('MAX · narrow while speaking, model merge clears the chips', async () => {
    O.beginTurn();
    hearAndDrive('add kam to the list', MEMBERS, { userOriginated: true });
    O.setSpeaking(true);
    await sleep(200);
    driveAiuic([{ type: 'add_grocery', name: '' }], 'add kam to the list', { memberNames: MEMBERS, source: 'model' });
    await sleep(700);
    console.log(`  speaking: ${snapshot()}`);
    O.setSpeaking(false);
    await sleep(1400);
    assert.ok(!writes.some((w) => /kam/i.test(w)), `the mangled word is never written: ${writes}`);
  });

  await scenario('MAX · barge-in "and walk the dog" while dishes waits for who', async () => {
    O.beginTurn();
    hearAndDrive('assign a task to clean my dishes', MEMBERS, { userOriginated: true });
    O.beginTurn();
    hearAndDrive('and walk the dog for Mia', MEMBERS, { userOriginated: true });
    driveAiuic([{ type: 'create_task_draft', title: 'Walk the dog', assignee: 'Mia' }], 'and walk the dog for Mia', {
      memberNames: MEMBERS,
      source: 'model',
    });
    const cards = O.getState().playlist.filter((b) => b.scene === 'task_compose').map((b) => b.payload.title);
    console.log(`  cards:   ${JSON.stringify(cards)}`);
    assert.equal(cards.length, 2, 'both requests are on the stage');
  });

  assert.deepEqual(blanks, [], `the stage was never blank or raw:\n${blanks.join('\n')}`);
  O.clear();
  console.log('\nALL SCENARIOS PASS — stage never blank, header always human, one write per request.');
  process.exit(0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});

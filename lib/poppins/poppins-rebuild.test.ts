/**
 * The Poppins rebuild — each test pins one cause of what testers saw on TestFlight.
 * Run: npx --yes tsx lib/poppins/poppins-rebuild.test.ts
 *
 *  A. Blank card        — the hold halo wrapped the card and faded it to 0.
 *  B. Untappable Undo    — the stage was unbounded and slid under the dock.
 *  C. "Clean → Nero" ×2  — local and model plans for one request became two acts.
 *  D. "Clean"            — the title was resolved twice and lost its object.
 *  E. Stale state        — partial transcripts planned acts; raw scene ids in the header.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { hearAndDrive, driveAiuic } from '@/lib/poppins/aiuic';
import { parseCompoundHouseholdIntent } from '@/lib/poppins/clause-segment';
import { stageHeaderLabel } from '@/lib/poppins/stage-header';
import {
  assignableMembers,
  haloOpacity,
  HALO_ARMED_OPACITY,
  resultMarkTitle,
  stageSceneKey,
} from '@/lib/poppins/stage-scene';
import {
  actFamilyOfBeat,
  commitFingerprint,
  refinementPatch,
  resetTurnOwnership,
} from '@/lib/poppins/turn-ownership';
import { rewriteAiuicActions } from '@/lib/poppins/ui-intent';
import { poppinsUiOrchestrator as O } from '@/lib/poppins/ui-orchestrator';
import { IUI_SCENES, type IuiBeat } from '@/lib/poppins/ui-scenes';
import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';
import { serverNeedsMultipart, voiceResult } from '@/lib/voice/voice-response';

const root = process.cwd();
const src = (rel: string) => readFileSync(join(root, rel), 'utf8');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitUntil(pred: () => boolean, ms = 3500) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (pred()) return true;
    await sleep(30);
  }
  return pred();
}

const MEMBERS = ['Nero', 'Mia'];
const commits: string[] = [];

function reset() {
  commits.length = 0;
  resetTurnOwnership();
  O.clear();
  O.setSpeaking(false);
  O.setCommitHandler(async (beat) => {
    const p = beat.payload;
    commits.push(`${p.write}:${p.groceryName ?? p.title ?? ''}>${p.assignee ?? ''}`);
    return { reverse: { write: p.write as never, entityId: `e${commits.length}`, beatId: beat.id } };
  });
  O.setUndoHandler(async () => undefined);
}

function liveWriteBeats(): IuiBeat[] {
  return O.getState().playlist.filter((b) => b.scene !== 'result_mark' && b.scene !== 'thinking');
}

async function main() {
  // ── A. The card is never hidden by its hold halo ─────────────────────────────────────
  {
    assert.equal(haloOpacity({}), 0, 'no halo while waiting for input…');
    assert.equal(haloOpacity({ hold: true }), HALO_ARMED_OPACITY);
    assert.equal(haloOpacity({ holding: true }), 1);
    const card = src('components/orbit/poppins-stage/iui-card.tsx');
    // The halo is a self-closing sibling: its opacity cannot reach the card's content.
    assert.match(card, /<Animated\.View\s+pointerEvents="none"\s+style=\{\[\s*styles\.halo,[\s\S]*?haloStyle,\s*\]\}\s*\/>/);
    assert.equal((card.match(/haloStyle/g) ?? []).length, 2, 'haloStyle is defined once and used once');
    // The card body is a plain View — no nested scroll competing with the stage scroll.
    assert.ok(!card.includes('<ScrollView'), 'card body does not scroll on its own');
    // One accessible card element would hide every chip and face from VoiceOver.
    assert.match(card, /accessible=\{false\}/);
    console.log('A PASS card never hidden by its halo');
  }

  // ── B. The stage scrolls above the dock; every scene has a card; never blank ──────────
  {
    const tab = src('app/(tabs)/poppins.tsx');
    const stageScroll = tab.indexOf('<ScrollView');
    const stageEl = tab.indexOf('<PoppinsStage');
    const scrollEnd = tab.indexOf('</ScrollView>', stageScroll);
    assert.ok(stageScroll > 0 && stageEl > stageScroll && scrollEnd > stageEl, 'stage lives in its own scroll view');
    assert.ok(tab.indexOf('<PoppinsDock') > scrollEnd, 'dock renders after (below) the body');
    assert.ok(!tab.includes('<Modal'), 'no second, modal confirm sheet');
    const thread = src('components/orbit/poppins/poppins-thread-panel.tsx');
    assert.ok(!/position:\s*'absolute'/.test(thread), 'the thread is a flex sibling, not a sheet over the card');

    const stage = src('components/orbit/poppins-stage.tsx');
    for (const scene of IUI_SCENES) {
      assert.ok(stage.includes(`case '${scene}':`), `stage has a card for ${scene}`);
    }
    assert.ok(stage.includes("case 'narrow':"), 'narrow has its own card');
    assert.ok(stage.includes('default:'), 'unknown scenes get a fallback card');
    assert.ok(!stage.includes("drive.phase !== 'narrow' &&"), 'no phase gate can blank a card');

    const grocery = { scene: 'grocery_add', payload: { chips: [{ id: 'a', label: 'Ham' }, { id: 'b', label: 'Jam' }] } } as unknown as IuiBeat;
    assert.equal(stageSceneKey('narrow', grocery), 'narrow');
    const chipsGone = { scene: 'grocery_add', payload: {} } as unknown as IuiBeat;
    assert.equal(stageSceneKey('narrow', chipsGone), 'grocery_add', 'narrow without chips falls back to the card');

    assert.equal(resultMarkTitle({ title: 'Assign' }, [{ id: '1', label: 'Clean Dishes → Nero' }]), undefined);
    assert.equal(resultMarkTitle({ title: 'Jam' }, []), 'Jam');

    const noActive = assignableMembers([
      { role: 'owner', status: undefined as never },
      { role: 'child', status: 'invited' },
      { role: 'guest', status: 'active' },
    ]);
    assert.equal(noActive.length, 1, 'with nobody marked active, joined members are still assignable');
    console.log('B PASS stage bounded, exhaustive, never blank');
  }

  // ── C. One request is one act, whichever planner speaks first ─────────────────────────
  {
    // C1 — the screenshot: local "Clean Dishes" (who missing), then the model's
    //      "Wash the dishes → Nero". One card, Nero filled in, one commit.
    reset();
    O.beginTurn();
    hearAndDrive('assign a task to clean my dishes', MEMBERS, { userOriginated: true });
    assert.equal(liveWriteBeats().length, 1);
    driveAiuic(
      [{ type: 'create_task_draft', title: 'Wash the dishes', assignee: 'Nero', due: 'Today' }],
      'assign a task to clean my dishes',
      { memberNames: MEMBERS, source: 'model' }
    );
    const beats = liveWriteBeats();
    assert.equal(beats.length, 1, `one task card, got ${beats.map((b) => b.payload.title).join(', ')}`);
    assert.equal(beats[0]!.payload.title, 'Clean Dishes', 'the spoken title is kept');
    assert.equal(beats[0]!.payload.assignee, 'Nero', 'the model filled the empty slot');
    await waitUntil(() => commits.length > 0);
    if (!commits.length) void O.confirm({ fromTap: true });
    await waitUntil(() => commits.length > 0);
    await sleep(400);
    assert.deepEqual(commits, ['create_task:Clean Dishes>Nero']);
    console.log('C1 PASS local + model plan → one act');

    // C2 — the model plan arrives after the local act already committed and the stage
    //      cleared ("It's already assigned"). No second task.
    reset();
    O.beginTurn();
    hearAndDrive('assign the dishes to Nero today', MEMBERS, { userOriginated: true });
    await waitUntil(() => commits.length > 0);
    if (!commits.length) void O.confirm({ fromTap: true });
    await waitUntil(() => commits.length > 0);
    await waitUntil(() => !O.getState().live, 6500);
    driveAiuic(
      [{ type: 'create_task_draft', title: 'Wash the dishes', assignee: 'Nero', due: 'Today' }],
      'assign the dishes to Nero today',
      { memberNames: MEMBERS, source: 'model' }
    );
    await sleep(1600);
    assert.equal(commits.length, 1, `late model plan must not commit again: ${commits}`);
    console.log('C2 PASS late model plan after commit → no duplicate');

    // C3 — the model sees something the grammar missed: a different family still lands.
    reset();
    O.beginTurn();
    hearAndDrive('add milk to the list', MEMBERS, { userOriginated: true });
    driveAiuic(
      [
        { type: 'add_grocery', name: 'Milk' },
        { type: 'create_calendar_event', title: 'Dentist', date: 'Tomorrow', time: '3pm' },
      ],
      'add milk to the list',
      { memberNames: MEMBERS, source: 'model' }
    );
    const families = liveWriteBeats().map((b) => actFamilyOfBeat(b));
    assert.deepEqual(families, ['grocery', 'event'], `got ${families}`);
    console.log('C3 PASS a new family from the model still stages');

    // C4 — a turn with no local plan belongs to the model.
    reset();
    O.beginTurn();
    driveAiuic([{ type: 'add_grocery', name: 'Oat milk' }], 'we are low on the oat stuff', {
      memberNames: MEMBERS,
      source: 'model',
    });
    assert.equal(liveWriteBeats().length, 1);
    console.log('C4 PASS model-only turn stages');

    // C5 — a spoken correction is a new turn, but the live card still owns its family.
    reset();
    O.beginTurn();
    hearAndDrive('assign a task to clean my dishes', MEMBERS, { userOriginated: true });
    O.beginTurn(); // "…to Mia"
    driveAiuic([{ type: 'create_task_draft', title: 'Dishes', assignee: 'Mia' }], 'to Mia', {
      memberNames: MEMBERS,
      source: 'model',
    });
    assert.equal(liveWriteBeats().length, 1, 'the correction refines the card, never a copy');
    assert.equal(liveWriteBeats()[0]!.payload.assignee, 'Mia');
    console.log('C5 PASS correction refines the live card');

    // C6 — a pending model confirmation for an act the words already staged is "handled".
    reset();
    O.beginTurn();
    hearAndDrive('clear the grocery list', MEMBERS, { userOriginated: true });
    assert.equal(O.ownsToolFamily('clear_grocery_list'), true);
    assert.equal(O.ownsToolFamily('grant_allowance'), false);
    console.log('C6 PASS pending confirmation for an owned act is handled on stage');

    // C7 — Undo, then say it again: it lands (the duplicate guard forgets undone acts).
    reset();
    O.beginTurn();
    hearAndDrive('add jam to the list', MEMBERS, { userOriginated: true });
    await waitUntil(() => commits.length === 1);
    await waitUntil(() => O.undoCount() === 1, 2000);
    await O.undoLast();
    await sleep(500);
    O.beginTurn();
    hearAndDrive('add jam to the list', MEMBERS, { userOriginated: true });
    await waitUntil(() => commits.length === 2);
    assert.equal(commits.length, 2, `re-adding after Undo must work: ${commits}`);
    console.log('C7 PASS undo then repeat lands');

    // Pure rules.
    const current = { title: 'Clean Dishes', slotSource: { title: 'speech' } } as never;
    assert.deepEqual(refinementPatch(current, { title: 'Wash the dishes', assignee: 'Nero' } as never), {
      assignee: 'Nero',
    });
    assert.deepEqual(
      refinementPatch({ narrow: true, chips: [] } as never, { groceryName: 'kam' } as never),
      {},
      'a mangled word never fills an open Narrow choice'
    );
    const a = commitFingerprint({ scene: 'task_compose', payload: { write: 'create_task', title: 'Dishes', assignee: 'Nero' } } as never);
    const b = commitFingerprint({ scene: 'task_compose', payload: { write: 'create_task', title: 'Dishes', assignee: 'Mia' } } as never);
    assert.notEqual(a, b, 'the same chore for two people is two acts');
  }

  // ── D. Titles keep their object ──────────────────────────────────────────────────────
  {
    const title = (utterance: string) =>
      mapUiActionsToPlaylist(
        rewriteAiuicActions(parseCompoundHouseholdIntent(utterance, { memberNames: MEMBERS } as never), utterance, {
          memberNames: MEMBERS,
        })
      ).find((b) => b.scene === 'task_compose' || b.scene === 'homework_compose')?.payload.title;
    assert.equal(title('assign a task to clean my dishes'), 'Clean Dishes');
    assert.equal(title('clean my dishes'), 'Clean Dishes');
    assert.equal(title('wash my car'), 'Wash the car', 'catalog matches still win');
    // "Mark it done" gets a settle mark, so its Undo has somewhere to live.
    const done = mapUiActionsToPlaylist([{ type: 'complete_task', taskId: 't1', title: 'Dishes' }]);
    assert.deepEqual(done.map((b) => b.scene), ['task_done', 'result_mark']);
    console.log('D PASS titles and settle marks');
  }

  // ── E. Max plans only from final transcripts; the header speaks human ────────────────
  {
    const controller = src('lib/poppins/use-poppins-controller.ts');
    const finalGate = controller.indexOf('if (!meta?.final) return;');
    assert.ok(finalGate > 0 && controller.indexOf('planLocally(text)', finalGate) > finalGate);
    const session = src('lib/voice/poppins-voice-session.ts');
    assert.equal((session.match(/final: true/g) ?? []).length, 2, 'final only on completed + typed');
    assert.match(controller, /source: 'model'/, 'model plans are marked as such');
    assert.match(controller, /notifyHandledOnStage/);

    const header = (beat: Partial<IuiBeat> | null, extra: Record<string, unknown> = {}) =>
      stageHeaderLabel(
        {
          live: Boolean(beat),
          playlist: beat ? [beat as IuiBeat] : [],
          index: 0,
          phase: 'unfold',
          holding: false,
          commitFailed: false,
          ...extra,
        } as never,
        'Poppins'
      );
    assert.equal(header(null), 'POPPINS');
    assert.equal(header({ scene: 'task_compose', commit: 'hold', payload: { write: 'create_task', composeReady: false } }), 'CHORES · NEEDS YOU');
    assert.equal(header({ scene: 'grocery_add', commit: 'hold', payload: { write: 'add_grocery' } }, { holding: true }), 'GROCERIES · HOLDING');
    assert.equal(header({ scene: 'result_mark', commit: 'none', payload: {} }), 'ALL SET');
    for (const scene of IUI_SCENES) {
      const label = header({ scene, commit: 'hold', payload: {} });
      assert.ok(!label.includes('_') && !/COMPOSE|MARK · LIVE/.test(label), `${scene} → ${label}`);
    }
    console.log('E PASS final-only planning, human header');
  }

  // ── F. Base: the upload avoids FormData, and a failure names its real cause ──────────
  {
    const voice = src('lib/voice/poppins-voice.ts');
    const jsonAt = voice.indexOf("'Content-Type': 'application/json'");
    const formAt = voice.indexOf('new FormData()');
    assert.ok(jsonAt > 0 && formAt > jsonAt, 'JSON upload is tried before the multipart fallback');
    assert.match(voice, /expo-file-system\/legacy/);

    // An old deployment rejects JSON — fall back; any other error is a real answer.
    assert.equal(
      serverNeedsMultipart({ status: 500, payload: { error: 'TypeError: Could not parse content as FormData.' } }),
      true
    );
    assert.equal(serverNeedsMultipart({ status: 500, payload: { error: 'whisper_failed' } }), false);
    assert.equal(serverNeedsMultipart({ status: 200, payload: {} }), false);

    assert.deepEqual(voiceResult({ status: 200, ok: true, payload: { transcript: 'add jam' } }), {
      transcript: 'add jam',
      answer: '',
    });
    const failure = (payload: Record<string, unknown>, status = 200) => {
      try {
        voiceResult({ status, ok: status < 400, payload });
        return null;
      } catch (error) {
        return error as Error & { causeCode?: string };
      }
    };
    const noKey = failure({ error: 'whisper_failed', detail: 'OPENAI_API_KEY missing' });
    assert.ok(noKey && /OPENAI_API_KEY missing/.test(noKey.message), 'the server detail survives');
    assert.ok(noKey && /http 200/.test(noKey.message), 'and the HTTP status');
    assert.equal(failure({ error: 'Unauthorized' }, 401)?.causeCode, 'signed_out');
    console.log('F PASS Base upload + named failures');
  }

  O.clear();
  console.log('poppins-rebuild.test.ts ok');
  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

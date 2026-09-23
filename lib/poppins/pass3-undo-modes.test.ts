/**
 * Pass 3 undo reverse + prefs.
 * Run: npx --yes tsx lib/poppins/pass3-undo-modes.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  derivedModeLine,
  modeFromSpeakBack,
  voiceLabel,
  controlLabel,
  DEFAULT_POPPINS_INTERACTION_PREFS,
} from '@/lib/poppins/poppins-prefs';
import { TOKEN_WEIGHT_SPEAK_BACK } from '@/constants/poppins-ai-rates';
import { undoWindowMsForAssignee } from '@/lib/poppins/iui-commit';
import { reverseIuiCommit, type IuiCommitReverse } from '@/lib/poppins/iui-reverse';
import { UNDO_MS } from '@/lib/poppins/ui-orchestrator';
import { RESULT_LINGER_MS } from '@/lib/poppins/ui-scenes';

async function main() {
  const root = process.cwd();

  assert.ok(UNDO_MS > RESULT_LINGER_MS, 'undo window must outlast entrance linger');
  assert.equal(undoWindowMsForAssignee(5000, 'Maya', { name: 'Alex' }), 10000);
  assert.equal(undoWindowMsForAssignee(5000, 'Alex', { name: 'Alex' }), 5000);
  assert.equal(undoWindowMsForAssignee(5000, 'me', { name: 'Alex' }), 5000);
  assert.equal(RESULT_LINGER_MS, 980);

  assert.equal(voiceLabel(false), 'Quiet');
  assert.equal(voiceLabel(true), 'Speak back');
  assert.equal(controlLabel(false), 'Guided');
  assert.equal(controlLabel(true), 'Direct');
  assert.equal(modeFromSpeakBack(false), 'silent');
  assert.equal(modeFromSpeakBack(true), 'spoken');
  assert.match(derivedModeLine(DEFAULT_POPPINS_INTERACTION_PREFS), /Quiet · Guided/);
  assert.match(
    derivedModeLine({ ...DEFAULT_POPPINS_INTERACTION_PREFS, speakBack: true, actImmediately: true }),
    new RegExp(`Speak back · Direct — about ${TOKEN_WEIGHT_SPEAK_BACK}`)
  );

  {
    const deleted: string[] = [];
    const reverse: IuiCommitReverse = { write: 'create_task', entityId: 'task-1' };
    await reverseIuiCommit(reverse, {
      deleteTask: async (id) => {
        deleted.push(id);
      },
    });
    assert.deepEqual(deleted, ['task-1']);
  }

  {
    const removed: string[] = [];
    await reverseIuiCommit(
      { write: 'add_grocery', entityId: 'g1' },
      {
        removeGroceryItem: async (id) => {
          removed.push(id);
        },
      }
    );
    assert.deepEqual(removed, ['g1']);
  }

  {
    const mark = readFileSync(join(root, 'components/orbit/poppins-stage/iui-result-mark.tsx'), 'utf8');
    assert.match(mark, /Tap to undo/);
    assert.match(mark, /onUndo/);

    const orch = readFileSync(join(root, 'lib/poppins/ui-orchestrator.ts'), 'utf8');
    assert.match(orch, /undoableMark/);
    assert.match(orch, /undoReverse/);
    assert.match(orch, /UNDO_MS/);

    const commit = readFileSync(join(root, 'lib/poppins/iui-commit.ts'), 'utf8');
    assert.match(commit, /reverse:/);
    assert.match(commit, /entityId/);

    const settings = readFileSync(join(root, 'app/settings.tsx'), 'utf8');
    assert.match(settings, /PoppinsModeCards/);
    assert.match(settings, /PoppinsAdvancedSheet/);
    const cards = readFileSync(join(root, 'components/orbit/poppins-mode-cards.tsx'), 'utf8');
    assert.match(cards, /Poppins Base/);
    assert.match(cards, /Poppins Max/);
    const advanced = readFileSync(join(root, 'components/orbit/poppins-advanced-sheet.tsx'), 'utf8');
    assert.match(advanced, /Act immediately/);
    assert.match(advanced, /Show thinking/);

    const welcome = readFileSync(join(root, 'app/welcome.tsx'), 'utf8');
    assert.match(welcome, /poppins-voice/);
    assert.match(welcome, /Set up Poppins/);
    assert.match(welcome, /PoppinsSetupPanel/);

    const panel = readFileSync(join(root, 'components/orbit/onboarding/poppins-setup-panel.tsx'), 'utf8');
    assert.match(panel, /PoppinsModeCards/);
    assert.match(panel, /Advanced/);
  }

  console.log('PASS pass3 undo + modes');
}

void main();

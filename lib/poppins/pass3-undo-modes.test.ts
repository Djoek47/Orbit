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
  DEFAULT_POPPINS_INTERACTION_PREFS,
  SPOKEN_COST_LINE_PLACEHOLDER,
} from '@/lib/poppins/poppins-prefs';
import { reverseIuiCommit, type IuiCommitReverse } from '@/lib/poppins/iui-reverse';
import { UNDO_MS } from '@/lib/poppins/ui-orchestrator';
import { RESULT_LINGER_MS } from '@/lib/poppins/ui-scenes';

async function main() {
  const root = join(import.meta.dirname, '../..');

  assert.ok(UNDO_MS > RESULT_LINGER_MS, 'undo window must outlast entrance linger');
  assert.equal(UNDO_MS, 5000);
  assert.equal(RESULT_LINGER_MS, 980);

  assert.equal(voiceLabel(false), 'Quiet');
  assert.equal(voiceLabel(true), 'Spoken');
  assert.equal(modeFromSpeakBack(false), 'silent');
  assert.equal(modeFromSpeakBack(true), 'spoken');
  assert.match(derivedModeLine(DEFAULT_POPPINS_INTERACTION_PREFS), /Quiet · Guided/);
  assert.match(SPOKEN_COST_LINE_PLACEHOLDER, /TBD|measured/i);

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
    assert.match(settings, /Speak back/);
    assert.match(settings, /Act immediately/);
    assert.match(settings, /derivedModeLine/);

    const welcome = readFileSync(join(root, 'app/welcome.tsx'), 'utf8');
    assert.match(welcome, /poppins-voice/);
    assert.match(welcome, /Should Poppins talk back/);
  }

  console.log('PASS pass3 undo + modes');
}

void main();

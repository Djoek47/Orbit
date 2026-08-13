/**
 * Map Poppins tool ui_actions → IUI playlist. Never dump a human form by default.
 */

import {
  defaultCommitForScene,
  isIuiScene,
  type IuiBeat,
  type IuiCommitKind,
  type IuiPayload,
  type IuiScene,
  type IuiWriteKind,
} from '@/lib/poppins/ui-scenes';

function beat(
  scene: IuiScene,
  payload: IuiPayload,
  commit: IuiCommitKind,
  write: IuiWriteKind = 'none'
): IuiBeat {
  return {
    id: `beat-${scene}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    scene,
    phase: commit === 'hold' ? 'hold' : 'show',
    commit,
    payload: { ...payload, write },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function flattenUiActions(
  results: Array<Record<string, unknown> | undefined | null>
): Array<Record<string, unknown>> {
  return results.flatMap((result) => {
    if (!result || !Array.isArray(result.ui_actions)) return [];
    return result.ui_actions as Array<Record<string, unknown>>;
  });
}

export function mapUiActionsToPlaylist(actions: Array<Record<string, unknown>>): IuiBeat[] {
  const playlist: IuiBeat[] = [];

  for (const action of actions) {
    const type = String(action.type ?? '');
    const prefill = asRecord(action.prefill);

    if (type === 'present_ui_scene') {
      const raw = String(action.scene ?? 'thinking');
      const scene = isIuiScene(raw) ? raw : 'thinking';
      const commit =
        (action.commit as IuiCommitKind | undefined) ?? defaultCommitForScene(scene);
      playlist.push(beat(scene, asRecord(action.payload) as IuiPayload, commit));
      continue;
    }

    if (type === 'navigate') {
      const route = String(action.route ?? '');
      playlist.push(
        beat(
          'navigate_coach',
          {
            route,
            coachLine: String(action.reason ?? 'I can open that for you.'),
            thinkingLine: String(action.reason ?? ''),
          },
          'none'
        )
      );
      continue;
    }

    if (type === 'add_grocery') {
      playlist.push(
        beat(
          'grocery_add',
          {
            groceryName: String(action.name ?? ''),
            aisle: action.category ? String(action.category) : undefined,
            title: String(action.name ?? 'Grocery'),
          },
          'hold',
          'add_grocery'
        )
      );
      continue;
    }

    if (type === 'complete_task') {
      playlist.push(
        beat(
          'list_peek',
          {
            title: String(action.title ?? 'Task'),
            taskId: String(action.taskId ?? ''),
            peek: [{ id: String(action.taskId ?? 't'), title: String(action.title ?? 'Task') }],
          },
          'hold',
          'complete_task'
        )
      );
      continue;
    }

    if (type === 'create_task' || type === 'create_task_draft') {
      playlist.push(
        beat(
          'task_compose',
          {
            title: String(action.title ?? prefill.title ?? ''),
            assignee: action.assignee
              ? String(action.assignee)
              : prefill.assignee
                ? String(prefill.assignee)
                : undefined,
            due: action.due ? String(action.due) : prefill.due ? String(prefill.due) : undefined,
          },
          'hold',
          'create_task'
        )
      );
      continue;
    }

    if (type === 'create_calendar_event' || type === 'create_event') {
      playlist.push(
        beat(
          'calendar_zoom',
          {
            title: String(action.title ?? prefill.title ?? 'Event'),
            date: String(action.date ?? prefill.date ?? ''),
            time: String(action.time ?? prefill.time ?? ''),
            location: String(action.location ?? prefill.location ?? ''),
          },
          'hold',
          'create_event'
        )
      );
      continue;
    }

    if (type === 'create_itinerary') {
      const label = String(action.title ?? prefill.title ?? 'Stop');
      playlist.push(
        beat(
          'itinerary_stage',
          {
            itineraryTitle: label,
            stops: [{ id: 'stop-1', label, emoji: '🛒', category: 'Shop' }],
          },
          'hold',
          'create_itinerary_stop'
        )
      );
      continue;
    }

    if (type === 'advance_itinerary_stop') {
      playlist.push(
        beat(
          'itinerary_stage',
          {
            itineraryId: String(action.itineraryId ?? ''),
            thinkingLine: 'Advancing the next stop.',
          },
          'hold',
          'advance_itinerary'
        )
      );
      continue;
    }

    if (type === 'claim_reward') {
      playlist.push(
        beat(
          'reward_mint',
          {
            rewardName: String(action.rewardName ?? 'Reward'),
            title: String(action.rewardName ?? 'Reward'),
            confirmSummary: `Mint ${String(action.rewardName ?? 'this reward')}?`,
          },
          'confirm'
        )
      );
      continue;
    }

    if (type === 'update_task') {
      playlist.push(
        beat(
          'task_compose',
          {
            title: String(asRecord(action.patch).title ?? 'Update task'),
            assignee: asRecord(action.patch).assignee
              ? String(asRecord(action.patch).assignee)
              : undefined,
            taskId: String(action.taskId ?? ''),
          },
          'confirm'
        )
      );
      continue;
    }

    if (type === 'confirm' || type === 'pending_confirm') {
      const ids = Array.isArray(action.confirmationIds)
        ? action.confirmationIds.map((id) => String(id))
        : [];
      playlist.push(
        beat(
          'confirm',
          {
            confirmSummary: String(action.confirmSummary ?? action.summary ?? 'Confirm?'),
            confirmationIds: ids,
          },
          'confirm'
        )
      );
      continue;
    }

    if (type === 'member_pick' || type === 'list_members') {
      const faces = Array.isArray(action.faces) ? action.faces : [];
      playlist.push(
        beat(
          'member_pick',
          {
            faces: faces.slice(0, 3).map((face, i) => {
              const f = asRecord(face);
              return {
                id: String(f.id ?? i),
                name: String(f.name ?? 'Member'),
                emoji: f.emoji ? String(f.emoji) : undefined,
              };
            }),
          },
          'none'
        )
      );
      continue;
    }

    if (type === 'list_tasks' || type === 'list_overdue' || type === 'list_peek') {
      const rows = Array.isArray(action.rows) ? action.rows : [];
      playlist.push(
        beat(
          'list_peek',
          {
            peek: rows.slice(0, 3).map((row, i) => {
              const r = asRecord(row);
              return {
                id: String(r.id ?? i),
                title: String(r.title ?? 'Task'),
                detail: r.assignee ? String(r.assignee) : undefined,
              };
            }),
            thinkingLine: String(action.thinkingLine ?? ''),
          },
          'none'
        )
      );
      continue;
    }

    playlist.push(
      beat('thinking', { thinkingLine: String(action.note ?? action.type ?? 'Working.') }, 'none')
    );
  }

  return playlist;
}

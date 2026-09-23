/**
 * Map Poppins tool ui_actions → IUI playlist. Never dump a human form by default.
 */

import {
  coerceCommit,
  isIuiScene,
  type IuiBeat,
  type IuiCommitKind,
  type IuiPayload,
  type IuiScene,
  type IuiWriteKind,
} from '@/lib/poppins/ui-scenes';
import { withComposeProgress } from '@/lib/poppins/iui-compose';
import { withHomeworkComposeProgress } from '@/lib/poppins/homework-compose';
import {
  GROCERY_META_TASK_IDS,
  GROCERY_META_TASK_TITLES,
  isGroceryAddIntent,
  isHomeworkIntent,
  isScheduleIntent,
  extractItemName,
  matchGroceryCatalog,
  resolvePoppinsChoreTitle,
} from '@/lib/poppins/catalog-match';
import { classifyGroceryItem } from '@/lib/grocery/classify';

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

function isGroceryMetaDraft(
  action: Record<string, unknown>,
  prefill: Record<string, unknown>,
  utteranceHint?: string
): boolean {
  const libraryTaskId = String(action.libraryTaskId ?? prefill.libraryTaskId ?? '');
  if (libraryTaskId && GROCERY_META_TASK_IDS.has(libraryTaskId)) return true;
  const title = String(action.title ?? prefill.title ?? '').trim().toLowerCase();
  if (GROCERY_META_TASK_TITLES.some((meta) => title === meta || title.includes(meta))) {
    return true;
  }
  if (utteranceHint && isGroceryAddIntent(utteranceHint)) return true;
  return false;
}

function groceryBeatsFromAction(action: Record<string, unknown>): IuiBeat[] {
  const groceryName = String(action.name ?? action.title ?? '').trim();
  const storeHint = String(action.storeHint ?? '').trim();
  const askLine =
    typeof action.ask === 'string'
      ? action.ask
      : typeof action.thinkingLine === 'string'
        ? action.thinkingLine
        : undefined;
  const classified = groceryName ? classifyGroceryItem(groceryName) : null;
  const aisle =
    classified && classified.confidence !== 'fallback'
      ? classified.categoryName
      : undefined;
  return [
    beat(
      'grocery_add',
      {
        groceryName: groceryName || undefined,
        aisle,
        title: groceryName || undefined,
        shoppingLane: action.lane === 'clothing' ? 'clothing' : 'grocery',
        thinkingLine:
          askLine ||
          (action.lane === 'clothing' ? 'Shopping list' : storeHint || 'Grocery list'),
        location: storeHint || undefined,
        sourceUtterance:
          typeof action.sourceUtterance === 'string' ? action.sourceUtterance : undefined,
        // Groceries are household-wide — never copy assignee onto the beat.
        // Empty name + ask → wait for speech; do not arm HOLD.
        composeReady: groceryName ? undefined : false,
        provisional: groceryName ? undefined : true,
      },
      groceryName ? 'hold' : 'none',
      'add_grocery'
    ),
    ...(groceryName
      ? [
          beat(
            'result_mark',
            {
              markKind: 'added' as const,
              title: groceryName || undefined,
              groceryName: groceryName || undefined,
            },
            'none'
          ),
        ]
      : []),
  ];
}

function isHomeworkDraft(action: Record<string, unknown>, prefill: Record<string, unknown>): boolean {
  const category = String(action.category ?? prefill.category ?? '');
  if (category === 'homework_education') return true;
  const title = String(action.title ?? prefill.title ?? '');
  return isHomeworkIntent(title);
}

function taskDraftBeats(action: Record<string, unknown>, prefill: Record<string, unknown>): IuiBeat[] {
  const rawTitle = String(action.title ?? prefill.title ?? '');
  const resolved = resolvePoppinsChoreTitle(rawTitle);
  const title = resolved.title || rawTitle;
  const libraryTaskId = action.libraryTaskId
    ? String(action.libraryTaskId)
    : prefill.libraryTaskId
      ? String(prefill.libraryTaskId)
      : resolved.libraryTaskId;
  const homework = isHomeworkDraft(action, prefill);
  const scene: IuiScene = homework ? 'homework_compose' : 'task_compose';
  const basePayload: IuiPayload = {
    title,
    assignee: action.assignee
      ? String(action.assignee)
      : prefill.assignee
        ? String(prefill.assignee)
        : undefined,
    due: action.due ? String(action.due) : prefill.due ? String(prefill.due) : undefined,
    category: homework
      ? 'homework_education'
      : action.category
        ? String(action.category)
        : prefill.category
          ? String(prefill.category)
          : resolved.category,
    libraryTaskId,
    taskQuery: action.taskQuery ? String(action.taskQuery) : undefined,
    repeat: action.repeat ? String(action.repeat) : undefined,
    showEmoji: true,
    thinkingLine: homework ? 'Homework' : 'Assign',
    composeKind: homework ? 'homework' : undefined,
    provisional: resolved.provisional === true || action.provisional === true,
    sourceUtterance:
      typeof action.sourceUtterance === 'string'
        ? action.sourceUtterance
        : typeof prefill.sourceUtterance === 'string'
          ? prefill.sourceUtterance
          : undefined,
  };
  const payload = homework
    ? withHomeworkComposeProgress(basePayload)
    : withComposeProgress(basePayload);
  const write: IuiWriteKind = homework ? 'create_homework' : 'create_task';
  return [
    beat(scene, payload, 'hold', write),
    beat('result_mark', { markKind: 'assigned', title: payload.title || 'Task' }, 'none'),
  ];
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
      const payload = asRecord(action.payload) as IuiPayload;
      const commit = coerceCommit(scene, action.commit as IuiCommitKind | undefined, payload.route);
      playlist.push(beat(scene, payload, commit));
      continue;
    }

    if (type === 'navigate') {
      let route = String(action.route ?? '');
      const openEditor = action.openEditor === true;
      if (route.startsWith('/create-task') && openEditor) route = '/assign-task';
      if (
        (route.startsWith('/assign-task') || route.startsWith('/create-task')) &&
        !openEditor
      ) {
        playlist.push(...taskDraftBeats(action, prefill));
        continue;
      }
      playlist.push(
        beat(
          'navigate_coach',
          {
            route,
            coachLine: String(action.reason ?? 'Opening that now.'),
            thinkingLine: String(action.reason ?? ''),
          },
          'none'
        )
      );
      continue;
    }

    if (type === 'add_grocery') {
      playlist.push(...groceryBeatsFromAction(action));
      continue;
    }

    if (type === 'complete_task') {
      playlist.push(
        beat(
          'task_done',
          {
            title: typeof action.title === 'string' ? action.title.trim() || undefined : undefined,
            taskId: String(action.taskId ?? ''),
            markKind: 'done',
            thinkingLine: 'Done',
          },
          'hold',
          'complete_task'
        )
      );
      continue;
    }

    if (type === 'create_task' || type === 'create_task_draft' || type === 'assign_task') {
      const utteranceHint = String(action.utterance ?? prefill.utterance ?? '');
      if (isGroceryMetaDraft(action, prefill, utteranceHint)) {
        const itemName =
          extractItemName(utteranceHint) ||
          extractItemName(String(action.title ?? '')) ||
          (typeof action.name === 'string' && action.name.trim() ? action.name.trim() : undefined);
        if (!itemName) continue;
        playlist.push(...groceryBeatsFromAction({ ...action, name: itemName }));
        continue;
      }
      // Homework library titles like "Practice math facts" match schedule keywords —
      // never divert a homework_education draft (or homework utterance) to calendar.
      if (
        !isHomeworkDraft(action, prefill) &&
        !isHomeworkIntent(utteranceHint) &&
        isScheduleIntent(String(action.title ?? utteranceHint))
      ) {
        playlist.push(
          beat(
            'calendar_zoom',
            {
              title: String(action.title ?? 'Event'),
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
      // No assignee + catalog-confident title → grocery (household-wide), not faces.
      const draftAssignee = action.assignee ?? prefill.assignee;
      const draftTitle = String(action.title ?? prefill.title ?? '').trim();
      if (
        !draftAssignee &&
        !isHomeworkDraft(action, prefill) &&
        !isHomeworkIntent(utteranceHint) &&
        !isScheduleIntent(draftTitle || utteranceHint)
      ) {
        const catalogHit =
          (draftTitle ? matchGroceryCatalog(draftTitle) : null) ||
          (utteranceHint
            ? matchGroceryCatalog(extractItemName(utteranceHint) || utteranceHint)
            : null);
        if (catalogHit?.confident) {
          playlist.push(
            ...groceryBeatsFromAction({
              ...action,
              name: catalogHit.name,
              title: catalogHit.name,
            })
          );
          continue;
        }
      }
      playlist.push(...taskDraftBeats(action, prefill));
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
            confirmSummary: 'Advance to the next stop?',
          },
          'confirm',
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
          'confirm',
          'claim_reward'
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
            confirmSummary: 'Update this task?',
          },
          'confirm',
          'update_task'
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
            faces: faces.map((face, i) => {
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
                title: typeof r.title === 'string' ? r.title.trim() : '',
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

  return sanitizeGroceryPlaylist(playlist);
}

/** B1/B3 — grocery turns never ask who; collapse duplicate grocery names. */
function sanitizeGroceryPlaylist(playlist: IuiBeat[]): IuiBeat[] {
  const hasGroceryWrite = playlist.some(
    (item) => item.payload.write === 'add_grocery' || item.scene === 'grocery_add'
  );
  let next = playlist;
  if (hasGroceryWrite) {
    next = playlist.filter((item) => item.scene !== 'member_pick');
    next = next.map((item) => {
      if (item.payload.write !== 'add_grocery' && item.scene !== 'grocery_add') return item;
      if (!item.payload.assignee && !item.payload.spokenName) return item;
      const { assignee: _a, spokenName: _s, ...rest } = item.payload;
      return { ...item, payload: rest };
    });
  }

  const seenGrocery = new Set<string>();
  const deduped: IuiBeat[] = [];
  for (const item of next) {
    if (item.payload.write === 'add_grocery' || item.scene === 'grocery_add') {
      const key = (item.payload.groceryName ?? item.payload.title ?? '').trim().toLowerCase();
      if (key && seenGrocery.has(key)) {
        console.warn('iui.duplicate_suppressed', { write: 'add_grocery', key });
        continue;
      }
      if (key) seenGrocery.add(key);
    }
    if (item.scene === 'result_mark' && item.payload.markKind === 'added') {
      const key = (item.payload.groceryName ?? item.payload.title ?? '').trim().toLowerCase();
      // Skip orphan result_mark after a suppressed duplicate grocery_add.
      if (key && !seenGrocery.has(key)) continue;
    }
    deduped.push(item);
  }
  return deduped;
}

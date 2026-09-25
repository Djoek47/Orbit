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
  toChoreDisplayTitle,
} from '@/lib/poppins/catalog-match';
import { classifyGroceryItem } from '@/lib/grocery/classify';
import { groupConsecutiveActs } from '@/lib/poppins/group-acts';
import type { IuiGroupItem } from '@/lib/poppins/ui-scenes';
import { applySlotOrder } from '@/lib/poppins/slot-order';

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
  const rawItems = Array.isArray(action.items) ? action.items : null;
  const storeHint = String(action.storeHint ?? '').trim();
  const askLine =
    typeof action.ask === 'string'
      ? action.ask
      : typeof action.thinkingLine === 'string'
        ? action.thinkingLine
        : undefined;

  const items: IuiGroupItem[] | undefined = rawItems
    ? rawItems.map((row, index) => {
        const r = asRecord(row);
        const label = String(r.label ?? r.name ?? r.title ?? '').trim();
        const classified = label ? classifyGroceryItem(label) : null;
        return {
          id: String(r.id ?? `g-${index}`),
          label,
          aisle:
            classified && classified.confidence !== 'fallback'
              ? classified.categoryName
              : undefined,
          status: 'pending' as const,
        };
      })
    : undefined;

  const groceryName =
    items?.[0]?.label ||
    String(action.name ?? action.title ?? '').trim();
  const narrowChips = Array.isArray(action.chips)
    ? (action.chips as Array<Record<string, unknown>>)
        .slice(0, 2)
        .map((chip, i) => ({
          id: String(chip.id ?? `narrow-${i}`),
          label: String(chip.label ?? chip.name ?? '').trim(),
          kind: 'library' as const,
        }))
        .filter((chip) => chip.label)
    : undefined;
  const isNarrow = Boolean(action.provisional === true && narrowChips?.length === 2 && !groceryName);
  const classified = groceryName ? classifyGroceryItem(groceryName) : null;
  const aisle =
    classified && classified.confidence !== 'fallback'
      ? classified.categoryName
      : undefined;
  const count = items?.filter((item) => !item.dropped && item.label).length ?? (groceryName ? 1 : 0);
  // Missing required slot → hold + composeReady:false (waits), never commit:'none' (WO16 §2.2).
  const missingName = !groceryName && !isNarrow && !items?.length;

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
          (isNarrow
            ? 'Which one?'
            : missingName
              ? 'What should I add?'
              : action.lane === 'clothing'
                ? 'Shopping list'
                : storeHint || 'Grocery list'),
        location: storeHint || undefined,
        sourceUtterance:
          typeof action.sourceUtterance === 'string' ? action.sourceUtterance : undefined,
        items,
        progressLabel: count > 1 ? `1 of ${count}` : undefined,
        composeReady: groceryName || isNarrow ? (isNarrow ? false : undefined) : false,
        provisional: isNarrow || (groceryName ? undefined : true),
        narrow: isNarrow || undefined,
        chips: isNarrow ? narrowChips : undefined,
      },
      'hold',
      'add_grocery'
    ),
    ...(groceryName && !items
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
      : groceryName && items
        ? [
            beat(
              'result_mark',
              {
                markKind: 'added' as const,
                title: count > 1 ? `${count} items` : groceryName,
                groceryName: groceryName || undefined,
              },
              'none'
            ),
          ]
        : isNarrow
          ? [
              // Empty title so sanitizeGroceryPlaylist does not treat "Added" as an orphan key.
              beat(
                'result_mark',
                {
                  markKind: 'added' as const,
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
  const rawItems = Array.isArray(action.items) ? action.items : null;
  const items: IuiGroupItem[] | undefined = rawItems
    ? rawItems.map((row, index) => {
        const r = asRecord(row);
        return {
          id: String(r.id ?? `t-${index}`),
          label: String(r.label ?? r.title ?? '').trim(),
          assignee: r.assignee ? String(r.assignee) : undefined,
          due: r.due ? String(r.due) : undefined,
          libraryTaskId: r.libraryTaskId ? String(r.libraryTaskId) : undefined,
          category: r.category ? String(r.category) : undefined,
          status: 'pending' as const,
        };
      })
    : undefined;

  const rawTitle = String(action.title ?? prefill.title ?? items?.[0]?.label ?? '');
  const resolved = resolvePoppinsChoreTitle(rawTitle);
  // The title arriving here is usually already resolved upstream. Re-resolving a display
  // title is lossy ("Clean Dishes" → "Clean": the second pass strips "Dishes" as a domain
  // word). Take the resolver's title only when it found a catalog task.
  const title =
    resolved.libraryTaskId && resolved.title
      ? resolved.title
      : rawTitle.trim()
        ? toChoreDisplayTitle(rawTitle.trim())
        : resolved.title || '';
  const libraryTaskId = action.libraryTaskId
    ? String(action.libraryTaskId)
    : prefill.libraryTaskId
      ? String(prefill.libraryTaskId)
      : resolved.libraryTaskId;
  const homework = isHomeworkDraft(action, prefill);
  const scene: IuiScene = homework ? 'homework_compose' : 'task_compose';
  const activeItems = items?.filter((item) => !item.dropped) ?? [];
  const needsFace = activeItems.some((item) => !item.assignee?.trim());
  const basePayload: IuiPayload = {
    title,
    assignee: action.assignee
      ? String(action.assignee)
      : prefill.assignee
        ? String(prefill.assignee)
        : items?.[0]?.assignee,
    due: action.due ? String(action.due) : prefill.due ? String(prefill.due) : items?.[0]?.due,
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
        : typeof action.utterance === 'string'
          ? action.utterance
          : typeof prefill.sourceUtterance === 'string'
            ? prefill.sourceUtterance
            : undefined,
    items,
    progressLabel: activeItems.length > 1 ? `1 of ${activeItems.length}` : undefined,
    // Grouped tasks with every row filled skip the face grid; a missing person opens it for that row.
    composeReady: items ? !needsFace : undefined,
  };
  // Mark speech-filled slots so model merge cannot overwrite them (WO12 §C3).
  const slotSource: NonNullable<IuiPayload['slotSource']> = { ...(basePayload.slotSource ?? {}) };
  if (basePayload.title?.trim()) slotSource.title = slotSource.title ?? 'speech';
  if (basePayload.assignee?.trim()) slotSource.assignee = slotSource.assignee ?? 'speech';
  if (basePayload.due?.trim()) slotSource.due = slotSource.due ?? 'speech';
  if (basePayload.libraryTaskId?.trim()) slotSource.libraryTaskId = slotSource.libraryTaskId ?? 'speech';
  basePayload.slotSource = slotSource;

  const ordered = applySlotOrder(basePayload);
  const payload =
    items && items.length > 1
      ? ordered
      : homework
        ? withHomeworkComposeProgress(ordered)
        : withComposeProgress(ordered);
  const write: IuiWriteKind = homework ? 'create_homework' : 'create_task';
  return [
    beat(scene, payload, 'hold', write),
    beat(
      'result_mark',
      {
        markKind: 'assigned',
        title:
          activeItems.length > 1 ? `${activeItems.length} tasks` : payload.title || 'Task',
      },
      'none'
    ),
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
  const grouped = groupConsecutiveActs(actions);

  for (const action of grouped) {
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
      // Ranks tab → read-only peek on stage (unless they asked for the full editor).
      if ((route.includes('/rewards') || route.includes('/ranks')) && !openEditor) {
        playlist.push(
          beat(
            'ranks_peek',
            {
              peek: [],
              thinkingLine: 'Who’s ahead this week.',
            },
            'none'
          )
        );
        continue;
      }
      // Grant-allowance surface → stage confirm card.
      if (route.includes('grant-allowance') || route.includes('create-allowance')) {
        playlist.push(
          beat(
            'allowance_act',
            {
              allowanceMemberName: String(
                action.memberName ?? prefill.memberName ?? action.assignee ?? 'someone'
              ),
              allowanceAmountLabel: String(
                action.amountLabel ?? prefill.amountLabel ?? action.amount ?? 'Allowance'
              ),
              allowanceNote: action.note ? String(action.note) : undefined,
              allowanceKind: 'grant',
              confirmSummary: 'Grant allowance?',
            },
            'confirm',
            'grant_allowance'
          )
        );
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

    if (type === 'clear_grocery_list' || type === 'clear_grocery') {
      playlist.push(
        beat(
          'confirm',
          {
            confirmSummary: 'Clear the grocery list?',
            thinkingLine: 'Clearing the list',
          },
          'confirm',
          'clear_grocery'
        ),
        beat('result_mark', { markKind: 'done', title: 'List cleared' }, 'none')
      );
      continue;
    }

    if (type === 'complete_task') {
      const doneTitle =
        typeof action.title === 'string' ? action.title.trim() || undefined : undefined;
      playlist.push(
        beat(
          'task_done',
          {
            title: doneTitle,
            taskId: String(action.taskId ?? ''),
            markKind: 'done',
            thinkingLine: 'Done',
          },
          'hold',
          'complete_task'
        ),
        // Every act gets a settle mark so its Undo has somewhere to live.
        beat('result_mark', { markKind: 'done', title: doneTitle }, 'none')
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
      const date = String(action.date ?? prefill.date ?? '');
      const time = String(action.time ?? prefill.time ?? '');
      const allDay = action.allDay === true || /\ball[\s-]?day\b/i.test(String(action.sourceUtterance ?? ''));
      const ready = Boolean(date) && (Boolean(time) || allDay);
      const assignee = action.assignee ?? action.responsible ?? action.who ?? prefill.assignee;
      playlist.push(
        beat(
          'calendar_zoom',
          {
            title: String(action.title ?? prefill.title ?? 'Event'),
            date,
            time,
            endTime: action.endTime ? String(action.endTime) : undefined,
            allDay: allDay || undefined,
            timeGuessed: action.timeGuessed === true || undefined,
            location: String(action.location ?? prefill.location ?? ''),
            assignee: assignee ? String(assignee) : undefined,
            withWho: Array.isArray(action.withWho) ? action.withWho.map(String) : undefined,
            // The design's default: remind an hour before, unless they said otherwise.
            remind: action.remind === false ? false : true,
            composeReady: ready,
            focusSlot: !date ? 'date' : !ready ? 'time' : null,
          },
          'hold',
          'create_event'
        )
      );
      continue;
    }

    if (type === 'create_itinerary') {
      const stopsRaw = Array.isArray(action.stops) ? action.stops : [];
      const mappedStops =
        stopsRaw.length > 0
          ? stopsRaw.slice(0, 20).map((row, i) => {
              const s = asRecord(row);
              const label = String(s.label ?? s.title ?? `Stop ${i + 1}`).trim() || `Stop ${i + 1}`;
              const address = s.address ? String(s.address) : undefined;
              const placeQuery = s.placeQuery ? String(s.placeQuery) : undefined;
              const time = s.time ? String(s.time) : undefined;
              return {
                id: String(s.id ?? `stop-${i + 1}`),
                label,
                stayMin: typeof s.stayMin === 'number' ? s.stayMin : undefined,
                savedPlaceId: s.savedPlaceId ? String(s.savedPlaceId) : undefined,
                note: s.note ? String(s.note) : undefined,
                emoji:
                  String(s.kind ?? '') === 'shop' || String(s.kind ?? '') === 'grocery'
                    ? '🛒'
                    : String(s.kind ?? '') === 'gym' || String(s.kind ?? '') === 'practice'
                      ? '🏋️'
                      : String(s.kind ?? '') === 'work'
                        ? '💼'
                        : String(s.kind ?? '') === 'school'
                          ? '🏫'
                          : '📍',
                category: s.kind ? String(s.kind) : undefined,
                kind: s.kind ? String(s.kind) : undefined,
                address,
                placeQuery,
                time,
                needsAddress:
                  typeof s.needsAddress === 'boolean'
                    ? s.needsAddress
                    : !address && String(s.kind ?? '') !== 'shop',
              };
            })
          : [
              {
                id: 'stop-1',
                label: String(action.title ?? prefill.title ?? 'Stop'),
                emoji: '📍',
                needsAddress: true,
              },
            ];
      playlist.push(
        beat(
          'itinerary_stage',
          {
            itineraryTitle: String(action.title ?? prefill.title ?? 'Trip'),
            date: action.date ? String(action.date) : undefined,
            time: action.start ? String(action.start) : undefined,
            stops: mappedStops,
            thinkingLine: `${mappedStops.length} stop${mappedStops.length === 1 ? '' : 's'}`,
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
            confirmSummary: `Claim ${String(action.rewardName ?? 'this reward')}?`,
          },
          'confirm',
          'claim_reward'
        )
      );
      continue;
    }

    if (type === 'save_place' || type === 'upsert_place' || type === 'remember_place') {
      const placeName = String(action.name ?? action.placeName ?? action.title ?? 'Place').trim();
      const placeKind = String(action.kind ?? action.placeKind ?? 'custom').trim() || 'custom';
      const placeAddress = String(action.address ?? action.placeAddress ?? action.placeQuery ?? '').trim();
      playlist.push(
        beat(
          'place_save',
          {
            placeName,
            placeKind,
            placeAddress,
            title: placeName,
            location: placeAddress || undefined,
            thinkingLine: 'Saving a place.',
            confirmSummary: placeAddress
              ? `Save ${placeName} · ${placeAddress}?`
              : `Save ${placeName}?`,
          },
          'hold',
          'upsert_place'
        )
      );
      continue;
    }

    if (type === 'grant_allowance' || type === 'allowance_act') {
      const memberName = String(action.memberName ?? action.assignee ?? 'someone').trim();
      const amountLabel = String(action.amountLabel ?? action.amount ?? '').trim() || 'Allowance';
      playlist.push(
        beat(
          'allowance_act',
          {
            allowanceMemberId: action.memberId ? String(action.memberId) : undefined,
            allowanceMemberName: memberName,
            allowanceAmountLabel: amountLabel,
            allowanceAmountXp:
              typeof action.amountXp === 'number'
                ? action.amountXp
                : Number(action.amountXp) || undefined,
            allowanceNote: action.note ? String(action.note) : undefined,
            allowanceKind:
              action.kind === 'hold' || action.kind === 'payout' ? action.kind : 'grant',
            title: amountLabel,
            confirmSummary: `Grant ${amountLabel} to ${memberName}?`,
          },
          'confirm',
          'grant_allowance'
        )
      );
      continue;
    }

    if (type === 'ranks_peek' || type === 'show_ranks') {
      const rows = Array.isArray(action.rows) ? action.rows : [];
      playlist.push(
        beat(
          'ranks_peek',
          {
            peek: rows.map((row, i) => {
              const r = asRecord(row);
              return {
                id: String(r.id ?? i),
                title: String(r.title ?? r.name ?? 'Member'),
                detail: r.detail ? String(r.detail) : undefined,
              };
            }),
            thinkingLine: 'Who’s ahead this week.',
          },
          'none'
        )
      );
      continue;
    }

    if (type === 'remember_house_fact') {
      const text = String(action.text ?? '').trim();
      if (text) {
        playlist.push(
          beat(
            'memory_note',
            {
              memoryText: text,
              memorySubject: String(action.subject ?? 'house'),
              memoryKind:
                action.kind === 'like' ||
                action.kind === 'dislike' ||
                action.kind === 'routine' ||
                action.kind === 'note'
                  ? action.kind
                  : 'note',
              title: text,
            },
            'none'
          )
        );
      }
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
    (item) =>
      item.payload.write === 'add_grocery' ||
      item.payload.write === 'clear_grocery' ||
      item.scene === 'grocery_add'
  );
  let next = playlist;
  if (hasGroceryWrite) {
    next = playlist.filter((item) => item.scene !== 'member_pick');
    next = next.map((item) => {
      if (
        item.payload.write !== 'add_grocery' &&
        item.payload.write !== 'clear_grocery' &&
        item.scene !== 'grocery_add'
      ) {
        return item;
      }
      if (!item.payload.assignee && !item.payload.spokenName) return item;
      const { assignee: _a, spokenName: _s, ...rest } = item.payload;
      return { ...item, payload: rest };
    });
  }

  const seenGrocery = new Set<string>();
  const deduped: IuiBeat[] = [];
  for (const item of next) {
    if (item.payload.write === 'clear_grocery') {
      deduped.push(item);
      continue;
    }
    if (item.payload.write === 'add_grocery' || item.scene === 'grocery_add') {
      if (item.payload.items?.length) {
        const unique: typeof item.payload.items = [];
        for (const row of item.payload.items) {
          const key = row.label.trim().toLowerCase();
          if (!key || row.dropped) {
            unique.push(row);
            continue;
          }
          if (seenGrocery.has(key)) {
            console.warn('iui.duplicate_suppressed', { write: 'add_grocery', key });
            continue;
          }
          seenGrocery.add(key);
          unique.push(row);
        }
        if (!unique.some((row) => !row.dropped && row.label.trim())) continue;
        const first = unique.find((row) => !row.dropped && row.label.trim());
        deduped.push({
          ...item,
          payload: {
            ...item.payload,
            items: unique,
            groceryName: first?.label ?? item.payload.groceryName,
            title: first?.label ?? item.payload.title,
            progressLabel:
              unique.filter((row) => !row.dropped).length > 1
                ? `1 of ${unique.filter((row) => !row.dropped).length}`
                : undefined,
          },
        });
        continue;
      }
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
      // Empty key = Narrow companion waiting for a chip (WO16 §3.1) — keep it.
      if (key && !seenGrocery.has(key) && !/^\d+\s+items?$/i.test(key)) continue;
    }
    deduped.push(item);
  }
  return assertPlaylistShape(deduped);
}

/** WO16 §5 — every write beat needs a commit path; every non-none commit needs a write. */
function assertPlaylistShape(playlist: IuiBeat[]): IuiBeat[] {
  const dev =
    (typeof __DEV__ !== 'undefined' && __DEV__) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');
  if (!dev) return playlist;
  for (const beat of playlist) {
    const write = beat.payload.write ?? 'none';
    if (beat.commit !== 'none' && write === 'none') {
      console.warn('iui.shape: commit without write', {
        scene: beat.scene,
        commit: beat.commit,
      });
    }
    if (write !== 'none' && beat.commit === 'none' && beat.scene !== 'result_mark') {
      console.warn('iui.shape: write without commit path', {
        scene: beat.scene,
        write,
      });
    }
  }
  return playlist;
}

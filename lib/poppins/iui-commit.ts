/**
 * Single commit path for IUI acts — stage HOLD and notification Approve share this.
 * validateAct runs here so every writer shares one gate.
 * Successful writes return a reverse descriptor for the undo window.
 * Outward notify effects can be deferred via effectOutbox (Direct / Guided undo).
 */
import { notifyActCommitted } from '@/lib/ai/act-events';
import { resolvePoppinsChoreTitle } from '@/lib/poppins/catalog-match';
import { effectOutbox } from '@/lib/poppins/effect-outbox';
import type { IuiCommitReverse } from '@/lib/poppins/iui-reverse';
import { ActRejectedError, validateAct, type ActRejection } from '@/lib/poppins/validate-act';
import type { IuiBeat, IuiWriteKind } from '@/lib/poppins/ui-scenes';
import { emitTourEvent } from '@/lib/tour/tour-events';
import { householdDueTimeLocal } from '@/lib/rules/household-view';
import { formatLocalDate } from '@/lib/streaks/local-date';
import { buildLibraryAssignInput } from '@/lib/tasks/assign-from-library';
import { dueLabelForDate, occurrenceDateForDueLabel } from '@/lib/tasks/due-label';
import { dueAtForFrequency } from '@/lib/tasks/recurrence-defaults';
import { allLibraryTasks } from '@/lib/tasks/task-library';
import type {
  CreateEventInput,
  CreateGroceryInput,
  CreateItineraryInput,
  CreateTaskInput,
  HouseholdEvent,
  HouseholdMember,
  HouseholdSnapshot,
  HouseholdTask,
  Itinerary,
  GroceryItem,
} from '@/types/orbit';

export type IuiCommitWrites = {
  household: HouseholdSnapshot;
  currentMember?: HouseholdMember | null;
  createTask: (
    input: CreateTaskInput,
    options?: {
      deferEffects?: boolean;
      onDeferredNotify?: (run: () => Promise<void>) => void;
    }
  ) => Promise<HouseholdTask | null>;
  createEvent: (input: CreateEventInput) => Promise<HouseholdEvent | null | unknown>;
  createItinerary: (input: CreateItineraryInput) => Promise<Itinerary | null | void>;
  addMissingGrocery: (input: CreateGroceryInput) => void | Promise<GroceryItem | void | unknown>;
  clearGroceryList?: () => void | Promise<void>;
  completeTask: (taskId: string) => Promise<unknown>;
  updateTask: (task: HouseholdTask) => Promise<unknown>;
  claimReward: (rewardId: string) => Promise<unknown>;
  advanceItineraryStop: (itineraryId: string, stopId: string) => Promise<unknown>;
  upsertSavedPlace?: (place: import('@/types/orbit').SavedPlace) => void;
  grantAllowance?: (
    input: Omit<import('@/types/orbit').CreateAllowanceInput, 'kind'>
  ) => Promise<import('@/types/orbit').AllowanceGrant | null>;
  onVoiceTaskCreated?: (task: HouseholdTask) => void;
  /** Undo window ms for deferred notify (other-person acts use ≥10s). */
  undoWindowMs?: number;
  /** Direct mode: do not invent assignee/due defaults from speech silence. */
  directMode?: boolean;
  /** WO11 — per-row progress while a group batch writes. */
  onGroupItemStatus?: (
    itemId: string,
    status: 'saving' | 'done' | 'failed',
    entityId?: string
  ) => void;
};

export type CommitIuiResult =
  | { ok: true; reverse?: IuiCommitReverse }
  | { ok: false; slot: string; reason: ActRejection; ask?: string };

function asId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' && id.trim() ? id : undefined;
}

export function isOtherPersonAssignee(
  assignee: string | undefined,
  currentMember?: Pick<HouseholdMember, 'name'> | null
): boolean {
  if (!assignee?.trim()) return false;
  const self = (currentMember?.name ?? '').trim().toLowerCase();
  if (!self) return true;
  return assignee.trim().toLowerCase() !== self && assignee.trim().toLowerCase() !== 'me';
}

/** Same window the outbox and the Undo button must use. */
export function undoWindowMsForAssignee(
  baseMs: number,
  assignee: string | undefined,
  currentMember?: Pick<HouseholdMember, 'name'> | null
): number {
  return isOtherPersonAssignee(assignee, currentMember) ? Math.max(baseMs, 10_000) : baseMs;
}

function slotFromModel(
  payload: IuiBeat['payload'],
  key: 'assignee' | 'due' | 'date' | 'time' | 'title'
): boolean {
  return payload.slotSource?.[key] === 'model';
}

export async function commitIuiBeat(
  beat: IuiBeat,
  writes: IuiCommitWrites
): Promise<CommitIuiResult> {
  const gate = validateAct(beat.payload, beat.scene);
  if (!gate.ok) {
    throw new ActRejectedError(gate);
  }

  const {
    household,
    currentMember,
    createTask,
    createEvent,
    createItinerary,
    addMissingGrocery,
    clearGroceryList,
    completeTask,
    updateTask,
    claimReward,
    advanceItineraryStop,
    onVoiceTaskCreated,
    undoWindowMs = 5000,
    directMode = false,
    onGroupItemStatus,
  } = writes;
  const p = beat.payload;
  const write = (p.write ?? 'none') as IuiWriteKind;
  const isHomeworkWrite = write === 'create_homework' || p.category === 'homework_education';
  let wrote = false;
  let reverse: IuiCommitReverse | undefined;
  let deferredNotify: (() => Promise<void>) | undefined;

  // WO11 §2.4 — batch grocery group (one HOLD; parallel writes).
  if (write === 'add_grocery' && p.items && p.items.length > 0) {
    const active = p.items.filter((item) => !item.dropped && item.label.trim());
    const batch: IuiCommitReverse[] = [];
    let anyOk = false;
    await Promise.all(
      active.map(async (item) => {
        onGroupItemStatus?.(item.id, 'saving');
        try {
          const created = await addMissingGrocery({
            name: item.label,
            category: item.aisle || (p.shoppingLane === 'clothing' ? 'Clothing' : undefined),
            categoryId: p.shoppingLane === 'clothing' ? 'clothing' : undefined,
          });
          const entityId = asId(created);
          anyOk = true;
          if (entityId) {
            batch.push({
              write: 'add_grocery',
              entityId,
              beatId: beat.id,
              itemId: item.id,
              label: item.label,
            });
            onGroupItemStatus?.(item.id, 'done', entityId);
          } else {
            onGroupItemStatus?.(item.id, 'done');
          }
        } catch (error) {
          console.warn('IUI batch add_grocery failed', item.label, error);
          onGroupItemStatus?.(item.id, 'failed');
        }
      })
    );
    if (!anyOk) {
      return { ok: false, slot: 'groceryName', reason: 'missing', ask: "Couldn't save — retry" };
    }
    wrote = true;
    if (batch.length) {
      reverse = {
        write: 'add_grocery',
        entityId: batch[batch.length - 1]!.entityId,
        beatId: beat.id,
        batch,
      };
    }
    await notifyActCommitted(beat.id, write, beat.payload.actMode);
    emitTourEvent('poppins_act_committed', { beatId: beat.id, write });
    return { ok: true, reverse };
  }

  // WO11 §2.4 — batch task group (serial — shared household state).
  if (
    (write === 'create_task' || write === 'create_homework') &&
    p.items &&
    p.items.length > 0
  ) {
    const active = p.items.filter((item) => !item.dropped && item.label.trim());
    const batch: IuiCommitReverse[] = [];
    for (const item of active) {
      onGroupItemStatus?.(item.id, 'saving');
      try {
        const rowBeat: IuiBeat = {
          ...beat,
          payload: {
            ...p,
            title: item.label,
            assignee: item.assignee ?? p.assignee,
            due: item.due ?? p.due,
            libraryTaskId: item.libraryTaskId ?? p.libraryTaskId,
            category: item.category ?? p.category,
            write,
            items: undefined,
          },
        };
        const rowResult = await commitIuiBeat(rowBeat, {
          ...writes,
          onGroupItemStatus: undefined,
        });
        if (rowResult.ok && rowResult.reverse) {
          batch.push(rowResult.reverse);
          onGroupItemStatus?.(item.id, 'done', rowResult.reverse.entityId);
        } else if (rowResult.ok) {
          onGroupItemStatus?.(item.id, 'done');
        } else {
          onGroupItemStatus?.(item.id, 'failed');
        }
      } catch (error) {
        console.warn('IUI batch create_task failed', item.label, error);
        onGroupItemStatus?.(item.id, 'failed');
      }
    }
    if (!batch.length) {
      return { ok: false, slot: 'title', reason: 'missing', ask: "Couldn't save — retry" };
    }
    reverse = {
      write,
      entityId: batch[batch.length - 1]!.entityId,
      beatId: beat.id,
      batch,
    };
    // Child commits already notified; one tour ping for the group.
    emitTourEvent('poppins_act_committed', { beatId: beat.id, write });
    return { ok: true, reverse };
  }

  if ((write === 'create_task' || write === 'create_homework') && (p.title || p.libraryTaskId)) {
    try {
      const resolved = resolvePoppinsChoreTitle(String(p.title ?? ''), {
        existingTasks: household.tasks.map((task) => ({
          title: task.title,
          status: task.status,
        })),
      });
      const libraryId = p.libraryTaskId || resolved.libraryTaskId;
      const library = libraryId
        ? allLibraryTasks().find((item) => item.id === libraryId)
        : undefined;

      // Direct: missing assignee/due from speech is unfilled — ask, don't invent.
      if (directMode) {
        if (!p.assignee?.trim() || slotFromModel(p, 'assignee')) {
          return {
            ok: false,
            slot: 'assignee',
            reason: 'missing',
            ask: 'Who should do this?',
          };
        }
        if (!p.due?.trim() || slotFromModel(p, 'due')) {
          return {
            ok: false,
            slot: 'due',
            reason: 'missing',
            ask: 'When is it due?',
          };
        }
      }

      const assignee = directMode
        ? String(p.assignee).trim()
        : p.assignee || currentMember?.name || household.members[0]?.name || 'Me';
      const dueChip = directMode ? String(p.due).trim() : p.due ?? 'Today';
      const occurrenceDate = occurrenceDateForDueLabel(dueChip);
      const dueLabel = dueLabelForDate(occurrenceDate);
      const [y, m, d] = occurrenceDate.split('-').map(Number);
      const occurrence = new Date(y, (m ?? 1) - 1, d ?? 1);
      const dueAt = dueAtForFrequency(
        'none',
        occurrence,
        householdDueTimeLocal(household, occurrence)
      )?.toISOString();
      const title = resolved.title || p.title;
      let created = null;
      const createOpts = {
        deferEffects: true as const,
        onDeferredNotify: (run: () => Promise<void>) => {
          deferredNotify = run;
        },
      };
      if (library) {
        created = await createTask(
          {
            ...buildLibraryAssignInput(
              library,
              assignee,
              library.defaultFrequency,
              occurrence,
              householdDueTimeLocal(household, occurrence)
            ),
            due: dueLabel,
            occurrenceDate,
            dueAt,
            proofRequired: isHomeworkWrite ? true : undefined,
          },
          createOpts
        );
      } else if (title) {
        created = await createTask(
          {
            title,
            category: p.category ?? p.selectedChipId ?? resolved.category ?? 'home_maintenance',
            assignee,
            due: dueLabel,
            dueAt,
            xp: 10,
            repeat: p.repeat === 'Daily' ? 'Daily' : 'None',
            difficulty: 'medium',
            weight: 1,
            occurrenceDate,
            proofRequired: isHomeworkWrite,
          },
          createOpts
        );
      }
      if (created) {
        wrote = true;
        reverse = { write, entityId: created.id, beatId: beat.id };
        onVoiceTaskCreated?.(created);
        if (deferredNotify) {
          const window = undoWindowMsForAssignee(undoWindowMs, assignee, currentMember);
          effectOutbox.enqueue(
            {
              id: `notify-${beat.id}`,
              beatId: beat.id,
              run: deferredNotify,
            },
            window
          );
        }
      }
    } catch (error) {
      console.warn('IUI create_task failed', error);
      throw error;
    }
  }

  if (write === 'create_event' && p.title) {
    const allDay = /\ball[\s-]?day\b/i.test(p.sourceUtterance ?? '');
    if (directMode) {
      if (!p.date?.trim() || slotFromModel(p, 'date')) {
        return { ok: false, slot: 'date', reason: 'missing', ask: 'What day?' };
      }
      if (!allDay && (!p.time?.trim() || slotFromModel(p, 'time'))) {
        return { ok: false, slot: 'time', reason: 'missing', ask: 'What time?' };
      }
    }
    const created = await createEvent({
      title: p.title,
      date: directMode ? String(p.date) : p.date || formatLocalDate(new Date()),
      time: directMode ? (allDay ? '' : String(p.time)) : p.time || '09:00',
      location: p.location || '',
      responsible: p.assignee || currentMember?.name || '',
      category: 'Appointment',
    });
    const entityId = asId(created);
    wrote = true;
    if (entityId) reverse = { write, entityId };
  }

  if (write === 'add_grocery' && p.groceryName) {
    const created = await addMissingGrocery({
      name: p.groceryName,
      category: p.aisle || (p.shoppingLane === 'clothing' ? 'Clothing' : undefined),
      categoryId: p.shoppingLane === 'clothing' ? 'clothing' : undefined,
    });
    const entityId = asId(created);
    wrote = true;
    if (entityId) reverse = { write, entityId };
  }

  if (write === 'clear_grocery') {
    const grocerySnapshot = (household.groceries ?? []).map((item) => ({
      name: item.name,
      category: item.category,
      categoryId: item.categoryId,
      quantity: item.quantity != null ? String(item.quantity) : undefined,
    }));
    await clearGroceryList?.();
    wrote = true;
    reverse = {
      write,
      entityId: 'grocery-list',
      beatId: beat.id,
      grocerySnapshot,
    };
  }

  if (write === 'complete_task') {
    const prior =
      (p.taskId ? household.tasks.find((item) => item.id === p.taskId) : undefined) ??
      household.tasks.find(
        (item) =>
          p.title &&
          item.status !== 'Completed' &&
          item.title.toLowerCase().includes(p.title.toLowerCase())
      );
    if (prior) {
      await completeTask(prior.id);
      wrote = true;
      reverse = { write, entityId: prior.id, taskSnapshot: { ...prior } };
    }
  }

  if (write === 'update_task' && p.taskId) {
    const task = household.tasks.find((item) => item.id === p.taskId);
    if (task) {
      await updateTask({
        ...task,
        title: p.title || task.title,
        assignee: p.assignee || task.assignee,
      });
      wrote = true;
      reverse = { write, entityId: task.id, taskSnapshot: { ...task } };
    }
  }

  if (write === 'claim_reward' && p.rewardName) {
    const reward = household.rewards?.find(
      (item) => item.title.toLowerCase() === p.rewardName!.toLowerCase()
    );
    if (reward) {
      await claimReward(reward.id);
      wrote = true;
      // No reliable unclaim — omit reverse so Undo is not offered (audit IUI P1).
    }
  }

  if (write === 'upsert_place' && (p.placeName || p.title)) {
    const name = String(p.placeName ?? p.title ?? 'Place').trim();
    const kindRaw = String(p.placeKind ?? 'custom').toLowerCase();
    const allowed = new Set([
      'home',
      'work',
      'school',
      'shop',
      'practice',
      'family',
      'cafe',
      'pickup',
      'clothing',
      'custom',
    ]);
    const kind = (allowed.has(kindRaw) ? kindRaw : 'custom') as import('@/types/orbit').SavedPlaceKind;
    const address = String(p.placeAddress ?? p.location ?? '').trim();
    const id = `place-${Date.now().toString(36)}`;
    const place = {
      id,
      name,
      kind,
      address: address || name,
      placeQuery: address || name,
    };
    writes.upsertSavedPlace?.(place);
    wrote = true;
    reverse = { write, entityId: id };
  }

  if (write === 'grant_allowance' && p.allowanceMemberName && p.allowanceAmountLabel) {
    const member =
      household.members.find((m) => m.id === p.allowanceMemberId) ??
      household.members.find(
        (m) => m.name.toLowerCase() === p.allowanceMemberName!.trim().toLowerCase()
      );
    if (member && writes.grantAllowance) {
      const grant = await writes.grantAllowance({
        memberId: member.id,
        memberName: member.name,
        amountLabel: p.allowanceAmountLabel,
        amountXp: p.allowanceAmountXp,
        note: p.allowanceNote,
      });
      if (grant) {
        wrote = true;
        reverse = { write, entityId: grant.id };
      }
    }
  }

  if (write === 'create_itinerary_stop') {
    const { mapStopKindToStore } = await import('@/lib/itinerary/itinerary-intent');
    const stops = (p.stops ?? []).map((stop, index) => {
      const kindRaw = String(stop.kind ?? stop.category ?? 'other');
      const kind = mapStopKindToStore(
        kindRaw as
          | 'shop'
          | 'school'
          | 'work'
          | 'gym'
          | 'appointment'
          | 'other'
          | 'practice'
          | 'pickup'
      );
      return {
        label: stop.label,
        kind,
        sortOrder: index,
        address: stop.address,
        placeQuery: stop.placeQuery ?? stop.label,
        time: stop.time,
      };
    });
    const fallbackLabel = p.itineraryTitle ?? 'Trip';
    const created = await createItinerary({
      title: p.itineraryTitle ?? stops[0]?.label ?? fallbackLabel,
      date: p.date ? String(p.date) : formatLocalDate(new Date()),
      suggestedByPoppins: true,
      stops: stops.length
        ? stops
        : [
            {
              label: fallbackLabel,
              kind: 'shop' as const,
              sortOrder: 0,
            },
          ],
    });
    const entityId = asId(created);
    wrote = true;
    // No deleteItinerary in store yet — omit reverse so Undo is honest (audit IUI P1).
    void entityId;
  }

  if (write === 'advance_itinerary' && p.itineraryId) {
    const trip = household.itineraries?.find((item) => item.id === p.itineraryId);
    const next = trip?.stops.find((s) => s.status === 'active') ?? trip?.stops[0];
    if (next) {
      await advanceItineraryStop(p.itineraryId, next.id);
      wrote = true;
      // No rewindItineraryStop in store yet — omit reverse.
    }
  }

  if (wrote) {
    await notifyActCommitted(
      beat.id,
      write === 'none' ? undefined : write,
      beat.payload.actMode
    );
    emitTourEvent('poppins_act_committed', { beatId: beat.id, write });
    emitTourEvent('poppins_spoke', { beatId: beat.id, write, phase: 'committed' });
    return { ok: true, reverse };
  }

  // Write beat that did not land — never settle as "All set" (audit IUI P1).
  if (write !== 'none') {
    return {
      ok: false,
      slot: write,
      reason: 'missing',
      ask: "I couldn't do that — check the name and try again.",
    };
  }
  return { ok: true, reverse };
}

/**
 * Single commit path for IUI acts — stage HOLD and notification Approve share this.
 * validateAct runs here so every writer shares one gate.
 * Successful writes return a reverse descriptor for the 5s undo window.
 */
import { notifyActCommitted } from '@/lib/ai/act-events';
import { resolvePoppinsChoreTitle } from '@/lib/poppins/catalog-match';
import type { IuiCommitReverse } from '@/lib/poppins/iui-reverse';
import { ActRejectedError, validateAct, type ActRejection } from '@/lib/poppins/validate-act';
import type { IuiBeat, IuiWriteKind } from '@/lib/poppins/ui-scenes';
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
  createTask: (input: CreateTaskInput) => Promise<HouseholdTask | null>;
  createEvent: (input: CreateEventInput) => Promise<HouseholdEvent | null | unknown>;
  createItinerary: (input: CreateItineraryInput) => Promise<Itinerary | null | void>;
  addMissingGrocery: (input: CreateGroceryInput) => void | Promise<GroceryItem | void | unknown>;
  completeTask: (taskId: string) => Promise<unknown>;
  updateTask: (task: HouseholdTask) => Promise<unknown>;
  claimReward: (rewardId: string) => Promise<unknown>;
  advanceItineraryStop: (itineraryId: string, stopId: string) => Promise<unknown>;
  onVoiceTaskCreated?: (task: HouseholdTask) => void;
};

export type CommitIuiResult =
  | { ok: true; reverse?: IuiCommitReverse }
  | { ok: false; slot: string; reason: ActRejection };

function asId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' && id.trim() ? id : undefined;
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
    completeTask,
    updateTask,
    claimReward,
    advanceItineraryStop,
    onVoiceTaskCreated,
  } = writes;
  const p = beat.payload;
  const write = (p.write ?? 'none') as IuiWriteKind;
  const isHomeworkWrite = write === 'create_homework' || p.category === 'homework_education';
  let wrote = false;
  let reverse: IuiCommitReverse | undefined;

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
      const assignee = p.assignee || currentMember?.name || household.members[0]?.name || 'Me';
      const dueChip = p.due ?? 'Today';
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
      if (library) {
        created = await createTask({
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
        });
      } else if (title) {
        created = await createTask({
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
        });
      }
      if (created) {
        wrote = true;
        reverse = { write, entityId: created.id };
        onVoiceTaskCreated?.(created);
      }
    } catch (error) {
      console.warn('IUI create_task failed', error);
      throw error;
    }
  }

  if (write === 'create_event' && p.title) {
    const created = await createEvent({
      title: p.title,
      date: p.date || formatLocalDate(new Date()),
      time: p.time || '09:00',
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
      reverse = { write, entityId: reward.id };
    }
  }

  if (write === 'create_itinerary_stop') {
    const stopLabel = p.stops?.[0]?.label ?? p.itineraryTitle ?? 'Stop';
    const created = await createItinerary({
      title: p.itineraryTitle ?? stopLabel,
      date: formatLocalDate(new Date()),
      suggestedByPoppins: true,
      stops: [
        {
          label: stopLabel,
          kind: 'shop',
          sortOrder: 0,
        },
      ],
    });
    const entityId = asId(created);
    wrote = true;
    if (entityId) reverse = { write, entityId };
  }

  if (write === 'advance_itinerary' && p.itineraryId) {
    const trip = household.itineraries?.find((item) => item.id === p.itineraryId);
    const next = trip?.stops.find((s) => s.status === 'active') ?? trip?.stops[0];
    if (next) {
      await advanceItineraryStop(p.itineraryId, next.id);
      wrote = true;
      reverse = {
        write,
        entityId: next.id,
        itineraryId: p.itineraryId,
        stopId: next.id,
        stopStatus: next.status,
      };
    }
  }

  if (wrote) {
    await notifyActCommitted(
      beat.id,
      write === 'none' ? undefined : write,
      beat.payload.actMode
    );
  }
  return { ok: true, reverse };
}

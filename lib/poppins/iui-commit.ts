/**
 * Single commit path for IUI acts — stage HOLD and notification Approve share this.
 * validateAct runs here so every writer shares one gate.
 */
import { notifyActCommitted } from '@/lib/ai/act-events';
import { resolvePoppinsChoreTitle } from '@/lib/poppins/catalog-match';
import { ActRejectedError, validateAct, type ActRejection } from '@/lib/poppins/validate-act';
import type { IuiBeat } from '@/lib/poppins/ui-scenes';
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
  HouseholdMember,
  HouseholdSnapshot,
  HouseholdTask,
  Itinerary,
} from '@/types/orbit';

export type IuiCommitWrites = {
  household: HouseholdSnapshot;
  currentMember?: HouseholdMember | null;
  createTask: (input: CreateTaskInput) => Promise<HouseholdTask | null>;
  createEvent: (input: CreateEventInput) => Promise<unknown>;
  createItinerary: (input: CreateItineraryInput) => Promise<Itinerary | null | void>;
  addMissingGrocery: (input: CreateGroceryInput) => void | Promise<unknown>;
  completeTask: (taskId: string) => Promise<unknown>;
  updateTask: (task: HouseholdTask) => Promise<unknown>;
  claimReward: (rewardId: string) => Promise<unknown>;
  advanceItineraryStop: (itineraryId: string, stopId: string) => Promise<unknown>;
  onVoiceTaskCreated?: (task: HouseholdTask) => void;
};

export type CommitIuiResult =
  | { ok: true }
  | { ok: false; slot: string; reason: ActRejection };

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
  const write = p.write ?? 'none';
  const isHomeworkWrite = write === 'create_homework' || p.category === 'homework_education';
  let wrote = false;

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
        onVoiceTaskCreated?.(created);
      }
    } catch (error) {
      console.warn('IUI create_task failed', error);
      throw error;
    }
  }

  if (write === 'create_event' && p.title) {
    await createEvent({
      title: p.title,
      date: p.date || formatLocalDate(new Date()),
      time: p.time || '09:00',
      location: p.location || '',
      responsible: p.assignee || currentMember?.name || '',
      category: 'Appointment',
    });
    wrote = true;
  }

  if (write === 'add_grocery' && p.groceryName) {
    await addMissingGrocery({
      name: p.groceryName,
      category: p.aisle || (p.shoppingLane === 'clothing' ? 'Clothing' : undefined),
      categoryId: p.shoppingLane === 'clothing' ? 'clothing' : undefined,
    });
    wrote = true;
  }

  if (write === 'complete_task') {
    const id =
      p.taskId ||
      household.tasks.find(
        (item) =>
          p.title &&
          item.status !== 'Completed' &&
          item.title.toLowerCase().includes(p.title.toLowerCase())
      )?.id;
    if (id) {
      await completeTask(id);
      wrote = true;
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
    }
  }

  if (write === 'claim_reward' && p.rewardName) {
    const reward = household.rewards?.find(
      (item) => item.title.toLowerCase() === p.rewardName!.toLowerCase()
    );
    if (reward) {
      await claimReward(reward.id);
      wrote = true;
    }
  }

  if (write === 'create_itinerary_stop') {
    const stopLabel = p.stops?.[0]?.label ?? p.itineraryTitle ?? 'Stop';
    await createItinerary({
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
    wrote = true;
  }

  if (write === 'advance_itinerary' && p.itineraryId) {
    const trip = household.itineraries?.find((item) => item.id === p.itineraryId);
    const next = trip?.stops.find((s) => s.status === 'active') ?? trip?.stops[0];
    if (next) {
      await advanceItineraryStop(p.itineraryId, next.id);
      wrote = true;
    }
  }

  if (wrote) {
    await notifyActCommitted(beat.id, write === 'none' ? undefined : write);
  }
  return { ok: true };
}

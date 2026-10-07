/**
 * Reverse a committed IUI write inside the undo window.
 * With the effect outbox, undo discards deferred notifies so they never leave the device.
 */
import { effectOutbox } from '@/lib/poppins/effect-outbox';
import type { IuiWriteKind } from '@/lib/poppins/ui-scenes';
import type { HouseholdTask } from '@/types/orbit';

export type IuiCommitReverse = {
  write: IuiWriteKind;
  entityId: string;
  /** Prior task snapshot for complete/update restore. */
  taskSnapshot?: HouseholdTask;
  /** Itinerary stop rewind. */
  itineraryId?: string;
  stopId?: string;
  stopStatus?: string;
  /** Beat id so undo can discard deferred outbox effects. */
  beatId?: string;
  /** WO11 — batch group commit: reverse each child newest-first via reverseIuiCommit. */
  batch?: IuiCommitReverse[];
  /** Payload item id / label at commit time — never re-derive by index (audit IUI P1). */
  itemId?: string;
  label?: string;
  /** Snapshot of grocery rows before clear_grocery. */
  grocerySnapshot?: Array<{
    name: string;
    category?: string;
    categoryId?: string;
    quantity?: string;
  }>;
};

export type IuiReverseWrites = {
  deleteTask?: (taskId: string) => Promise<void>;
  deleteEvent?: (eventId: string) => Promise<void>;
  removeGroceryItem?: (itemId: string) => Promise<void>;
  updateTask?: (task: HouseholdTask) => Promise<unknown>;
  /** Restore clear_grocery from snapshot. */
  addMissingGrocery?: (input: {
    name: string;
    category?: string;
    categoryId?: string;
    quantity?: string;
  }) => void | Promise<unknown>;
  /** Best-effort; may be absent if itinerary delete is unsupported. */
  deleteItinerary?: (itineraryId: string) => Promise<void>;
  rewindItineraryStop?: (
    itineraryId: string,
    stopId: string,
    status: string
  ) => Promise<void>;
  removeSavedPlace?: (placeId: string) => void;
  rejectAllowance?: (allowanceId: string) => Promise<void>;
};

export async function reverseIuiCommit(
  reverse: IuiCommitReverse,
  writes: IuiReverseWrites
): Promise<void> {
  if (reverse.batch?.length) {
    // Newest first.
    for (const child of [...reverse.batch].reverse()) {
      await reverseIuiCommit(child, writes);
    }
    return;
  }
  if (reverse.beatId) {
    effectOutbox.discard(reverse.beatId);
  }
  const { write, entityId } = reverse;
  switch (write) {
    case 'create_task':
    case 'create_homework':
      await writes.deleteTask?.(entityId);
      return;
    case 'create_event':
      await writes.deleteEvent?.(entityId);
      return;
    case 'add_grocery':
      await writes.removeGroceryItem?.(entityId);
      return;
    case 'clear_grocery':
      if (reverse.grocerySnapshot?.length) {
        for (const item of reverse.grocerySnapshot) {
          await writes.addMissingGrocery?.(item);
        }
      }
      return;
    case 'complete_task':
    case 'update_task':
      if (reverse.taskSnapshot) {
        await writes.updateTask?.(reverse.taskSnapshot);
      }
      return;
    case 'create_itinerary_stop':
      await writes.deleteItinerary?.(entityId);
      return;
    case 'advance_itinerary':
      if (reverse.itineraryId && reverse.stopId && reverse.stopStatus) {
        await writes.rewindItineraryStop?.(
          reverse.itineraryId,
          reverse.stopId,
          reverse.stopStatus
        );
      }
      return;
    case 'claim_reward':
      // No reliable unclaim API this pass — meter still reverses via ActEvent.
      return;
    case 'upsert_place':
      writes.removeSavedPlace?.(entityId);
      return;
    case 'grant_allowance':
      await writes.rejectAllowance?.(entityId);
      return;
    default:
      return;
  }
}

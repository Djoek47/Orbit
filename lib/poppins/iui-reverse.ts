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
};

export type IuiReverseWrites = {
  deleteTask?: (taskId: string) => Promise<void>;
  deleteEvent?: (eventId: string) => Promise<void>;
  removeGroceryItem?: (itemId: string) => Promise<void>;
  updateTask?: (task: HouseholdTask) => Promise<unknown>;
  /** Best-effort; may be absent if itinerary delete is unsupported. */
  deleteItinerary?: (itineraryId: string) => Promise<void>;
  rewindItineraryStop?: (
    itineraryId: string,
    stopId: string,
    status: string
  ) => Promise<void>;
};

export async function reverseIuiCommit(
  reverse: IuiCommitReverse,
  writes: IuiReverseWrites
): Promise<void> {
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
    default:
      return;
  }
}

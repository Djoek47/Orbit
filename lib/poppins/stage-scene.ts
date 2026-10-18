/**
 * Pure rules the stage renders by. No React Native here, so they are testable in Node.
 */
import type { IuiDriveState } from '@/lib/poppins/ui-orchestrator';
import type { IuiBeat, IuiPayload } from '@/lib/poppins/ui-scenes';
import type { HouseholdMember } from '@/types/orbit';

/** Halo opacity when a hold is armed but not running, and while it runs. */
export const HALO_ARMED_OPACITY = 0.45;
export const HALO_HOLDING_OPACITY = 1;

/**
 * The hold halo's opacity. It applies to the halo ONLY — the card beside it is always
 * fully opaque. (When the halo wrapped the card, 0 here meant an invisible card.)
 */
export function haloOpacity(state: { hold?: boolean; holding?: boolean }): number {
  if (state.holding) return HALO_HOLDING_OPACITY;
  if (state.hold) return HALO_ARMED_OPACITY;
  return 0;
}

/**
 * Which branch draws this beat. A Narrow choice needs at least two chips; the moment they
 * are gone the scene's own card takes over, so the stage is never blank.
 */
export function stageSceneKey(phase: IuiDriveState['phase'], beat: IuiBeat): string {
  if (phase === 'narrow' && (beat.payload.chips?.length ?? 0) >= 2) return 'narrow';
  return beat.scene;
}

/** Who can be picked: active members; if none are marked active, anyone who has joined. */
export function assignableMembers<M extends Pick<HouseholdMember, 'role' | 'status'>>(
  members: M[]
): M[] {
  const eligible = members.filter((m) => m.role !== 'guest' && m.role !== 'shared-device');
  const active = eligible.filter((m) => m.status === 'active');
  if (active.length) return active;
  return eligible.filter((m) => m.status !== 'invited' && m.status !== 'pending');
}

/** The settle mark's subtitle. When the ledger lists the acts, the ledger says it. */
export function resultMarkTitle(
  payload: Pick<IuiPayload, 'title' | 'groceryName'>,
  ledger: Array<{ id: string; label: string }>
): string | undefined {
  if (ledger.length) return undefined;
  const title = (payload.title ?? payload.groceryName ?? '').trim();
  return title || undefined;
}

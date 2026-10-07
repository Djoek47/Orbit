/**
 * The small status line at the top of the Poppins tab.
 *
 * It used to print the raw scene id ("TASK COMPOSE · LIVE", "RESULT MARK · LIVE") — a debug
 * label shipped to users. It now says the domain and what the stage is waiting for.
 */
import { stageDomainLabel } from '@/constants/iui-stage';
import type { IuiDriveState } from '@/lib/poppins/ui-orchestrator';

export function stageHeaderLabel(
  drive: Pick<IuiDriveState, 'live' | 'playlist' | 'index' | 'phase' | 'holding' | 'commitFailed'>,
  idleName: string
): string {
  const beat = drive.live ? drive.playlist[drive.index] : undefined;
  if (!beat) return idleName.toUpperCase();
  if (beat.scene === 'result_mark') return 'ALL SET';
  if (beat.scene === 'coach_steps' || beat.scene === 'navigate_coach') return 'TEACHING · FREE';
  if (beat.scene === 'thinking') return 'WORKING';
  const domain =
    beat.scene === 'confirm' && (beat.payload.write ?? 'none') === 'none'
      ? 'CONFIRM'
      : stageDomainLabel(beat.scene, beat.payload.write).toUpperCase();
  if (drive.commitFailed) return `${domain} · NOT SAVED`;
  if (drive.phase === 'narrow') return `${domain} · WHICH ONE?`;
  if (drive.holding) return `${domain} · HOLDING`;
  if (beat.commit === 'confirm' && domain !== 'CONFIRM') return `${domain} · CONFIRM`;
  if (beat.payload.composeReady === false) return `${domain} · NEEDS YOU`;
  return domain;
}

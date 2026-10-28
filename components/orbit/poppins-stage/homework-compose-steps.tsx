/**
 * Homework compose — who, subject, when. Same stepper the chore composer used before the
 * card shell; kept verbatim when the stage was rebuilt.
 */
import { IuiChips } from '@/components/orbit/poppins-stage/iui-chips';
import { IuiFaces } from '@/components/orbit/poppins-stage/iui-faces';
import { IuiGhostField } from '@/components/orbit/poppins-stage/iui-ghost-field';
import { IuiStepper } from '@/components/orbit/poppins-stage/iui-stepper';
import { IUI_CREATED_CHIP_ID } from '@/lib/poppins/iui-compose';
import {
  HOMEWORK_DUE_CHIPS,
  HOMEWORK_SUBJECT_CHIPS,
  homeworkComposeStepLabel,
  nextHomeworkComposeStep,
  type HomeworkComposeStep,
} from '@/lib/poppins/homework-compose';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import type { IuiChip, IuiFace, IuiPayload } from '@/lib/poppins/ui-scenes';
import { useOrbit } from '@/store/orbit-store';

export function HomeworkComposeSteps({
  payload,
  faces,
  selectedName,
  accent,
  hold,
  holdProgress,
  holding,
  frozen,
  titleHeard,
  title,
}: {
  payload: IuiPayload;
  faces: IuiFace[];
  selectedName?: string;
  accent: string;
  hold: boolean;
  holdProgress: number;
  holding: boolean;
  frozen: boolean;
  titleHeard: boolean;
  title: string;
}) {
  const { household } = useOrbit();
  const rawStep = payload.composeStep ?? nextHomeworkComposeStep(payload);
  const step: HomeworkComposeStep =
    rawStep === 'category' || rawStep === 'task'
      ? 'subject'
      : rawStep === 'who' || rawStep === 'subject' || rawStep === 'when' || rawStep === 'ready'
        ? rawStep
        : nextHomeworkComposeStep(payload);
  const childFaces = faces.filter((face) =>
    household.members.some((m) => m.id === face.id && m.role === 'child')
  );
  const shownFaces = childFaces.length ? childFaces : faces;

  const goBack = () => {
    if (step === 'subject') {
      poppinsUiOrchestrator.revise({ assignee: '', spokenName: undefined });
      return;
    }
    poppinsUiOrchestrator.revise({ due: '' });
  };

  const customTitle = Boolean((payload.title ?? title).trim()) && !payload.libraryTaskId;
  const showDue = step === 'when' || step === 'ready' || (step === 'subject' && customTitle);

  return (
    <IuiStepper
      kicker={homeworkComposeStepLabel(step)}
      accent={accent}
      hold={hold && step === 'ready'}
      holdProgress={holdProgress}
      holding={holding}
      frozen={frozen}
      onBack={step === 'who' ? undefined : goBack}>
      {step === 'who' ? (
        <IuiFaces
          faces={shownFaces}
          selectedName={selectedName}
          pulsingName={payload.spokenName}
          accent={accent}
          onSelect={(name) =>
            poppinsUiOrchestrator.chooseFromTap({ assignee: name, spokenName: name }, name, 'face')
          }
        />
      ) : null}

      {step === 'subject' ? (
        <IuiChips
          chips={(() => {
            const pool = HOMEWORK_SUBJECT_CHIPS.map(
              (chip): IuiChip => ({
                id: chip.id,
                label: chip.label,
                emoji: chip.emoji,
                kind: 'library',
              })
            );
            const custom = (payload.title ?? title).trim();
            const already = pool.some((chip) => chip.label.toLowerCase() === custom.toLowerCase());
            if (custom && !already) {
              return [{ id: IUI_CREATED_CHIP_ID, label: custom, kind: 'created' }, ...pool];
            }
            return pool;
          })()}
          selectedId={
            payload.selectedChipId === IUI_CREATED_CHIP_ID ||
            (Boolean(payload.title) && !payload.libraryTaskId)
              ? IUI_CREATED_CHIP_ID
              : payload.libraryTaskId ?? payload.selectedChipId
          }
          accent={accent}
          showEmoji
          onSelect={(id) => {
            if (id === IUI_CREATED_CHIP_ID) {
              poppinsUiOrchestrator.chooseFromTap(
                {
                  libraryTaskId: undefined,
                  selectedChipId: IUI_CREATED_CHIP_ID,
                  title: (payload.title ?? title).trim(),
                  category: 'homework_education',
                },
                (payload.title ?? title).trim() || 'homework',
                'chip'
              );
              return;
            }
            const chip = HOMEWORK_SUBJECT_CHIPS.find((item) => item.id === id);
            poppinsUiOrchestrator.chooseFromTap(
              {
                libraryTaskId: id,
                selectedChipId: id,
                title: chip ? `${chip.label} homework` : id,
                category: 'homework_education',
              },
              chip?.label ?? id,
              'chip'
            );
          }}
        />
      ) : null}

      {showDue ? (
        <>
          {step !== 'subject' ? (
            <IuiGhostField text={title} accent={accent} catchUp={titleHeard} />
          ) : null}
          <IuiChips
            chips={HOMEWORK_DUE_CHIPS.map((chip) => ({ id: chip.id, label: chip.label }))}
            selectedId={payload.due}
            accent={accent}
            onSelect={(id) => {
              poppinsUiOrchestrator.chooseFromTap({ due: id, repeat: undefined }, id, 'when');
            }}
          />
        </>
      ) : null}
    </IuiStepper>
  );
}

/**
 * IUI stage — one idea at a time inside the Activity window.
 */

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { IuiCard } from '@/components/orbit/poppins-stage/iui-card';
import { IuiChips } from '@/components/orbit/poppins-stage/iui-chips';
import { IuiCoachCard } from '@/components/orbit/poppins-stage/iui-coach-card';
import { IuiDay } from '@/components/orbit/poppins-stage/iui-day';
import { IuiDomainGrid } from '@/components/orbit/poppins-stage/iui-domain-grid';
import { IuiEventCard } from '@/components/orbit/poppins-stage/iui-event-card';
import { IuiFaces } from '@/components/orbit/poppins-stage/iui-faces';
import { IuiGhostField } from '@/components/orbit/poppins-stage/iui-ghost-field';
import { IuiGroceryCard } from '@/components/orbit/poppins-stage/iui-grocery-card';
import { IuiGroupRows } from '@/components/orbit/poppins-stage/iui-group-rows';
import { IuiLattice } from '@/components/orbit/poppins-stage/iui-lattice';
import { IuiObjectCard } from '@/components/orbit/poppins-stage/iui-object-card';
import { IuiPeek } from '@/components/orbit/poppins-stage/iui-peek';
import { IuiResultMark } from '@/components/orbit/poppins-stage/iui-result-mark';
import { IuiRoad } from '@/components/orbit/poppins-stage/iui-road';
import { IuiStepper } from '@/components/orbit/poppins-stage/iui-stepper';
import { IuiTroubleMissingSlot, IuiTroubleModelDown } from '@/components/orbit/poppins-stage/iui-trouble';
import { IuiTripCard } from '@/components/orbit/poppins-stage/iui-trip-card';
import { TaskComposeSteps } from '@/components/orbit/poppins-stage/task-compose-steps';
import { useTourControls } from '@/components/orbit/tour/tour-provider';
import { stageAccent, stageDomainLabel, stageFill } from '@/constants/iui-stage';
import { HOW_TO_INDEX } from '@/lib/poppins/how-to';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { householdHasChildren } from '@/lib/household/has-children';
import { composeStepLabel, IUI_CREATED_CHIP_ID, IUI_DUE_CHIPS, nextComposeStep } from '@/lib/poppins/iui-compose';
import {
  HOMEWORK_DUE_CHIPS,
  HOMEWORK_SUBJECT_CHIPS,
  homeworkComposeStepLabel,
  nextHomeworkComposeStep,
  type HomeworkComposeStep,
} from '@/lib/poppins/homework-compose';
import { poppinsUiOrchestrator, usePoppinsUiDrive } from '@/lib/poppins/ui-orchestrator';
import type { IuiBeat, IuiChip, IuiFace, IuiPayload } from '@/lib/poppins/ui-scenes';
import { allLibraryTasks, choreDomains, homeworkDomain } from '@/lib/tasks/task-library';
import { commitIuiBeat } from '@/lib/poppins/iui-commit';
import { getSessionDirectMode, getSessionUndoMs } from '@/lib/poppins/session-act-mode';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdTask } from '@/types/orbit';

function monthLabel(date?: string) {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toLocaleString('en', { month: 'long' });
  return d.toLocaleString('en', { month: 'long' });
}

function dayNumber(date?: string) {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().getDate();
  return d.getDate();
}

function weekdayLabel(date?: string, due?: string) {
  if (due && /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(due)) {
    return due;
  }
  const d = date ? new Date(date) : null;
  if (!d || Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleString('en', { weekday: 'long' });
}

function HomeworkComposeSteps({
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

export function PoppinsStage({
  onVoiceTaskCreated,
}: {
  onVoiceTaskCreated?: (task: HouseholdTask) => void;
} = {}) {
  const drive = usePoppinsUiDrive();
  const { c, glassBorder, isDark } = useOrbitColors();
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
    accentTheme,
  } = useOrbit();
  const tour = useTourControls();
  const accent = accentTheme.primary;
  const [holdProgress, setHoldProgress] = useState(0);

  const faces: IuiFace[] = useMemo(
    () =>
      household.members
        .filter((m) => m.status === 'active' && m.role !== 'guest' && m.role !== 'shared-device')
        .map((m) => ({
          id: m.id,
          name: m.name,
          emoji: memberDisplayEmoji(m),
          imageUri: isAvatarImageUri(m.avatar) ? m.avatar : undefined,
        })),
    [household.members]
  );

  const hasKids = householdHasChildren(household.members);
  const composeDomains = useMemo(() => {
    const chores = choreDomains().map((d) => ({
      id: d.id,
      label:
        d.shortName === 'Shared Spaces'
          ? 'Shared'
          : (d.shortName ?? d.name.replace(/\s*&\s*.+$/, '')),
    }));
    if (!hasKids) return chores;
    const hw = homeworkDomain();
    if (!hw) return chores;
    return [...chores, { id: hw.id, label: hw.shortName ?? 'Homework' }];
  }, [hasKids]);

  const writesRef = useRef({
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
    directMode: getSessionDirectMode(),
    undoWindowMs: getSessionUndoMs(),
  });
  writesRef.current = {
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
    directMode: getSessionDirectMode(),
    undoWindowMs: getSessionUndoMs(),
  };

  useEffect(() => {
    poppinsUiOrchestrator.setHapticHandler((kind) => {
      if (kind === 'show' || kind === 'hold') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      } else if (kind === 'settle') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      } else if (kind === 'veto') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
          () => undefined
        );
      }
    });
    poppinsUiOrchestrator.setCoachHandler((route) => {
      try {
        router.push(route as never);
      } catch {
        /* ignore */
      }
    });
    poppinsUiOrchestrator.setCommitHandler(async (beat: IuiBeat) => {
      const result = await commitIuiBeat(beat, {
        ...writesRef.current,
        onGroupItemStatus: (itemId, status) => {
          poppinsUiOrchestrator.patchGroupItemStatus(itemId, status);
        },
      });
      return result.ok ? { reverse: result.reverse } : { ask: result.ask, reverse: undefined };
    });
    return () => {
      poppinsUiOrchestrator.setCommitHandler(null);
      poppinsUiOrchestrator.setCoachHandler(null);
      poppinsUiOrchestrator.setHapticHandler(null);
    };
  }, []);

  useEffect(() => {
    if (!drive.holding || !drive.holdStartedAt) {
      setHoldProgress(0);
      return;
    }
    const tick = () => {
      const elapsed = Date.now() - (drive.holdStartedAt ?? Date.now());
      setHoldProgress(Math.min(1, elapsed / drive.holdMs));
    };
    tick();
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, [drive.holding, drive.holdStartedAt, drive.holdMs]);

  const beat = drive.playlist[drive.index];
  if (!drive.live || !beat) return null;

  const payload = beat.payload;
  const sceneFaces = payload.faces?.length ? payload.faces : faces;
  const selectedName = payload.assignee;
  const unfolded =
    drive.phase === 'unfold' || drive.phase === 'hold' || drive.phase === 'settle';
  const title = payload.title ?? '';
  const titleHeard = Boolean(title && drive.spoken.toLowerCase().includes(title.toLowerCase()));
  const peekHighlight = (payload.peek ?? []).reduce((best, row, i) => {
    if (!drive.spoken) return best;
    return drive.spoken.toLowerCase().includes(row.title.toLowerCase()) ? i : best;
  }, -1);
  const queueAhead = drive.playlist.slice(drive.index + 1);
  const queuedRows = queueAhead.flatMap((next) => {
    if (next.scene === 'result_mark' || next.scene === 'thinking') return [];
    if (next.payload.items?.length) {
      const live = next.payload.items.filter((i) => !i.dropped);
      return [
        {
          id: `queue:${next.id}`,
          label:
            next.scene === 'grocery_add'
              ? `Groceries · ${live.length} items`
              : live.map((i) => i.label).join(', '),
          assignee: next.payload.assignee,
          due: next.payload.due,
          status: 'pending' as const,
        },
      ];
    }
    const label =
      next.payload.groceryName ?? next.payload.title ?? next.payload.thinkingLine ?? '';
    if (!label.trim()) return [];
    return [
      {
        id: `queue:${next.id}`,
        label: label.trim(),
        assignee: next.payload.assignee,
        due: next.payload.due,
        status: 'pending' as const,
      },
    ];
  });
  const groupKicker =
    payload.progressLabel ??
    (payload.items && payload.items.filter((item) => !item.dropped).length > 1
      ? `${payload.items.filter((item) => !item.dropped).length} items`
      : undefined);
  const stageText = (scene = beat.scene, write = payload.write) =>
    stageAccent(scene, write, isDark);
  const stageInk = (scene = beat.scene, write = payload.write) => stageFill(scene, write);
  const undoRows = poppinsUiOrchestrator.undoLedgerRows();
  const undoCount = poppinsUiOrchestrator.undoCount();
  const undoOpen = Boolean(drive.undoUntil && Date.now() < drive.undoUntil && undoCount > 0);

  return (
    <View key={beat.id} style={styles.root}>
      {drive.spoken.trim() ? (
        <Text style={[styles.spoken, { color: c.textMuted }]} numberOfLines={2}>
          {drive.spoken.trim()}
        </Text>
      ) : payload.thinkingLine || drive.thinkingLine ? (
        <Text style={[styles.think, { color: c.textSubtle }]} numberOfLines={2}>
          {payload.thinkingLine || drive.thinkingLine}
        </Text>
      ) : null}

      {beat.scene === 'thinking' ? (
        <Text style={[styles.lead, { color: c.text }]}>{payload.thinkingLine || 'Working.'}</Text>
      ) : null}

      {beat.scene === 'member_pick' ? (
        <IuiStepper kicker="Who" accent={accent}>
          <IuiFaces
            faces={sceneFaces}
            selectedName={selectedName}
            pulsingName={payload.spokenName}
            accent={accent}
            onSelect={(name) =>
              poppinsUiOrchestrator.chooseFromTap({ assignee: name, spokenName: name }, name, 'face')
            }
          />
        </IuiStepper>
      ) : null}

      {beat.scene === 'task_compose' ? (
        payload.items && payload.items.length > 1 ? (
          <IuiCard
            accent={stageText()}
            fillAccent={stageInk()}
            kicker="Chores"
            countLabel={groupKicker ?? `${payload.items.filter((i) => !i.dropped).length} tasks`}
            hold={payload.composeReady === true}
            holdProgress={holdProgress}
            holding={drive.holding}
            frozen={drive.frozen}
            leftFooter={
              payload.composeReady === true ? 'One hold for all' : 'Fill who is missing'
            }
            rightFooter="tap × to drop one"
            accessibilityLabel="Task batch card">
            <IuiGroupRows
              items={payload.items}
              queued={queuedRows}
              accent={stageInk()}
              kind="task"
              allowDrop={drive.phase !== 'settle'}
              onDrop={(id) => poppinsUiOrchestrator.dropGroupItem(id)}
            />
            {payload.composeReady === false ? (
              <IuiFaces
                faces={sceneFaces}
                selectedName={selectedName}
                accent={stageInk()}
                onSelect={(name) =>
                  poppinsUiOrchestrator.chooseFromTap(
                    { assignee: name, spokenName: name },
                    name,
                    'face'
                  )
                }
              />
            ) : null}
          </IuiCard>
        ) : (
          <TaskComposeSteps
            payload={payload}
            faces={sceneFaces}
            selectedName={selectedName}
            accent={stageText()}
            fillAccent={stageInk()}
            domains={composeDomains}
            hold={payload.composeReady === true}
            holdProgress={holdProgress}
            holding={drive.holding}
            frozen={drive.frozen}
            titleHeard={titleHeard}
            title={title}
          />
        )
      ) : null}

      {beat.scene === 'homework_compose' ? (
        <HomeworkComposeSteps
          payload={payload}
          faces={sceneFaces}
          selectedName={selectedName}
          accent={stageText()}
          hold={payload.composeReady === true}
          holdProgress={holdProgress}
          holding={drive.holding}
          frozen={drive.frozen}
          titleHeard={titleHeard}
          title={title}
        />
      ) : null}

      {beat.scene === 'calendar_zoom' ? (
        <IuiEventCard
          payload={payload}
          accent={stageText()}
          fillAccent={stageInk()}
          hold={Boolean(payload.title)}
          holdProgress={holdProgress}
          holding={drive.holding}
          frozen={drive.frozen}
          dayEvents={household.events ?? []}
        />
      ) : null}

      {beat.scene === 'itinerary_stage' ? (
        <IuiTripCard
          payload={payload}
          accent={stageText()}
          fillAccent={stageInk()}
          hold
          holdProgress={holdProgress}
          holding={drive.holding}
          frozen={drive.frozen}
          groceryCount={(household.groceries ?? []).filter((g) => g.status !== 'Purchased').length}
        />
      ) : null}

      {beat.scene === 'grocery_add' ? (
        !(payload.groceryName || payload.title || (payload.items && payload.items.length)) ? (
          <IuiTroubleMissingSlot
            accent={stageText()}
          fillAccent={stageInk()}
            question="What should I add?"
            why="I heard the list, not the thing."
            chips={[
              { id: 'milk', label: 'Milk' },
              { id: 'coffee', label: 'Coffee' },
              { id: 'eggs', label: 'Eggs' },
            ]}
            onPick={(_id, label) =>
              poppinsUiOrchestrator.chooseFromTap(
                { groceryName: label, title: label },
                label,
                'grocery'
              )
            }
          />
        ) : (
          <IuiGroceryCard
            payload={payload}
            accent={stageText()}
          fillAccent={stageInk()}
            hold
            holdProgress={holdProgress}
            holding={drive.holding}
            frozen={drive.frozen}
            queued={queuedRows}
            countLabel={groupKicker}
            onAddNow={() => void poppinsUiOrchestrator.confirm({ fromTap: true })}
            onNotThat={() => poppinsUiOrchestrator.veto()}
            onDropQueued={(id) => poppinsUiOrchestrator.dropQueuedBeat(id)}
          />
        )
      ) : null}

      {beat.scene === 'task_done' ? (
        <>
          {payload.modelOffline === true ? (
            <IuiTroubleModelDown
              accent={stageText()}
              confirmation={payload.title ?? 'Saved'}
            />
          ) : null}
          <IuiResultMark
            kind="done"
            title={payload.title}
            modelOffline={false}
            undoable={undoOpen}
            undoUntil={drive.undoUntil}
            undoLabel={
              undoCount > 1
                ? `Undo all ${undoCount === 4 ? 'four' : undoCount}`
                : undoCount === 1
                  ? 'Undo'
                  : undefined
            }
            ledger={undoRows}
            onUndo={() => {
              void poppinsUiOrchestrator.undoLast();
            }}
          />
        </>
      ) : null}

      {beat.scene === 'result_mark' ? (
        <>
          {payload.modelOffline === true ? (
            <IuiTroubleModelDown
              accent={stageText()}
              confirmation={payload.title ?? payload.groceryName ?? 'Saved'}
            />
          ) : null}
          <IuiResultMark
            kind={payload.markKind ?? 'added'}
            title={payload.title ?? payload.groceryName}
            modelOffline={false}
            undoable={undoOpen}
            undoUntil={drive.undoUntil}
            undoLabel={
              undoCount > 1
                ? `Undo all ${undoCount === 4 ? 'four' : undoCount}`
                : undoCount === 1
                  ? 'Undo'
                  : undefined
            }
            ledger={undoRows}
            onUndo={() => {
              void poppinsUiOrchestrator.undoLast();
            }}
          />
        </>
      ) : null}

      {beat.scene === 'reward_mint' ? (
        <View style={styles.stack}>
          <IuiObjectCard
            title={payload.rewardName ?? payload.title ?? 'Reward'}
            emoji="✨"
            accent={stageInk('reward_mint')}
          />
          <Text style={[styles.hint, { color: c.textMuted }]}>
            {payload.confirmSummary ?? 'Say yes to mint.'}
          </Text>
        </View>
      ) : null}

      {beat.scene === 'list_peek' ? (
        <IuiPeek
          rows={payload.peek ?? []}
          accent={stageInk()}
          highlightIndex={peekHighlight >= 0 ? peekHighlight : 0}
        />
      ) : null}

      {beat.scene === 'confirm' ? (
        <View style={styles.stack}>
          <Text style={[styles.lead, { color: c.text }]}>{payload.confirmSummary ?? 'Confirm?'}</Text>
          <Text style={[styles.hint, { color: c.textMuted }]}>Say yes, or wait — I will not assume.</Text>
        </View>
      ) : null}

      {beat.scene === 'navigate_coach' ? (
        <View style={styles.stack}>
          <Text style={[styles.lead, { color: c.text }]}>{payload.coachLine ?? 'Opening that now.'}</Text>
        </View>
      ) : null}

      {beat.scene === 'coach_steps' ? (
        <IuiCoachCard
          payload={payload}
          accent={stageText()}
          fillAccent={stageInk()}
          onWalkThrough={() => {
            const entry = HOW_TO_INDEX.find((item) => item.id === payload.howToId);
            const steps =
              entry?.steps ??
              (payload.coachSteps ?? []).map((step) => ({
                text: step.text,
                route: step.route,
                targetId: step.targetId as never,
              }));
            tour?.startAdHocTour({
              steps,
              title: payload.title,
              canDoItForYou: payload.canDoItForYou === true,
              returnRoute: '/(tabs)/poppins',
              onDoItForMe: entry?.canDoItForYou
                ? () => {
                    if (entry.doItAction) {
                      poppinsUiOrchestrator.drive([entry.doItAction], { replace: true });
                    } else {
                      router.push('/(tabs)/tasks' as never);
                    }
                  }
                : undefined,
            });
          }}
          onJustDoIt={
            payload.canDoItForYou
              ? () => {
                  const entry = HOW_TO_INDEX.find((item) => item.id === payload.howToId);
                  if (entry?.doItAction) {
                    poppinsUiOrchestrator.drive([entry.doItAction], { replace: true });
                  } else {
                    router.push('/(tabs)/tasks' as never);
                  }
                }
              : undefined
          }
        />
      ) : null}

      {beat.commit === 'hold' && beat.payload.composeReady === true ? (
        <Pressable onPress={() => poppinsUiOrchestrator.confirm({ fromTap: true })} hitSlop={12}>
          <Text style={[styles.fallback, { color: c.textSubtle }]}>
            {drive.frozen ? 'Tap to confirm' : 'or tap to confirm'}
          </Text>
        </Pressable>
      ) : null}

      {beat.commit === 'confirm' ? (
        <View style={styles.confirmRow}>
          <Pressable
            onPress={() => poppinsUiOrchestrator.veto()}
            style={[styles.quietBtn, { borderColor: glassBorder(0.12) }]}>
            <Text style={{ color: c.text }}>No</Text>
          </Pressable>
          <Pressable
            onPress={() => poppinsUiOrchestrator.confirm({ fromTap: true })}
            style={[styles.quietBtn, { borderColor: `${accent}66` }]}>
            <Text style={{ color: c.text }}>Yes</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 8,
    gap: 12,
    paddingTop: 4,
  },
  think: {
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontWeight: '600',
    textAlign: 'center',
  },
  spoken: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '400',
    letterSpacing: -0.2,
    textAlign: 'center',
    maxWidth: 310,
    paddingHorizontal: 12,
  },
  lead: {
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  stack: { width: '100%', alignItems: 'center', gap: 16 },
  hint: { fontSize: 14, textAlign: 'center' },
  fallback: { fontSize: 11, marginTop: 8, textAlign: 'center' },
  confirmRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  quietBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
});

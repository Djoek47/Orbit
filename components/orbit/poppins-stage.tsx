/**
 * IUI stage — the card for whatever Poppins is doing right now.
 *
 * One beat, one card. `stageSceneKey` picks exactly one branch from a single switch; a
 * Narrow choice is its own branch; anything unrecognised gets a fallback card with a way
 * out. Nothing is gated off by phase, so while the stage is live it is never blank.
 *
 * Below the card sits one commit affordance: Yes / No for confirm beats, "tap to confirm"
 * for hold beats that have no button of their own.
 *
 * The stage never sizes itself. The Poppins screen scrolls it as one unit, bounded above
 * the dock, so a long card can never slide under the mic.
 */

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { HomeworkComposeSteps } from '@/components/orbit/poppins-stage/homework-compose-steps';
import { IuiAllowanceCard } from '@/components/orbit/poppins-stage/iui-allowance-card';
import { IuiCard } from '@/components/orbit/poppins-stage/iui-card';
import { IuiChips } from '@/components/orbit/poppins-stage/iui-chips';
import { IuiCoachCard } from '@/components/orbit/poppins-stage/iui-coach-card';
import { IuiEventCard } from '@/components/orbit/poppins-stage/iui-event-card';
import { IuiFaces } from '@/components/orbit/poppins-stage/iui-faces';
import { IuiGroceryCard } from '@/components/orbit/poppins-stage/iui-grocery-card';
import { IuiGroupRows } from '@/components/orbit/poppins-stage/iui-group-rows';
import { IuiMemoryNote } from '@/components/orbit/poppins-stage/iui-memory-note';
import { IuiObjectCard } from '@/components/orbit/poppins-stage/iui-object-card';
import { IuiPeek } from '@/components/orbit/poppins-stage/iui-peek';
import { IuiPlaceCard } from '@/components/orbit/poppins-stage/iui-place-card';
import { IuiResultMark } from '@/components/orbit/poppins-stage/iui-result-mark';
import { IuiStepper } from '@/components/orbit/poppins-stage/iui-stepper';
import { IuiTripCard } from '@/components/orbit/poppins-stage/iui-trip-card';
import {
  IuiTroubleMissingSlot,
  IuiTroubleRowFailed,
} from '@/components/orbit/poppins-stage/iui-trouble';
import { TaskComposeSteps } from '@/components/orbit/poppins-stage/task-compose-steps';
import { useTourControls } from '@/components/orbit/tour/tour-provider';
import { stageAccent, stageDomainLabel, stageFill } from '@/constants/iui-stage';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { householdHasChildren } from '@/lib/household/has-children';
import { HOW_TO_INDEX } from '@/lib/poppins/how-to';
import { commitIuiBeat } from '@/lib/poppins/iui-commit';
import { assignableMembers, resultMarkTitle, stageSceneKey } from '@/lib/poppins/stage-scene';
import { getSessionDirectMode, getSessionUndoMs } from '@/lib/poppins/session-act-mode';
import {
  poppinsUiOrchestrator,
  usePoppinsUiDrive,
  type IuiDriveState,
} from '@/lib/poppins/ui-orchestrator';
import type { IuiBeat, IuiFace, IuiGroupItem } from '@/lib/poppins/ui-scenes';
import { choreDomains, homeworkDomain } from '@/lib/tasks/task-library';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdTask } from '@/types/orbit';

const OTHER_CHIP_ID = '__something_else';

function undoLabelFor(count: number): string | undefined {
  if (count > 1) return `Undo all ${count}`;
  if (count === 1) return 'Undo';
  return undefined;
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
    upsertSavedPlace,
    grantAllowance,
  } = useOrbit();
  const tour = useTourControls();
  const [holdProgress, setHoldProgress] = useState(0);

  const faces: IuiFace[] = useMemo(
    () =>
      assignableMembers(household.members).map((m) => ({
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

  const ranksPeekRows = useMemo(
    () =>
      [...assignableMembers(household.members)]
        .sort((a, b) => (b.weekXp ?? 0) - (a.weekXp ?? 0))
        .slice(0, 5)
        .map((m, i) => ({
          id: m.id,
          title: `${i + 1}. ${m.name}`,
          detail: `${m.weekXp ?? 0} XP this week`,
        })),
    [household.members]
  );

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
    upsertSavedPlace,
    grantAllowance,
    onVoiceTaskCreated,
    directMode: getSessionDirectMode(),
    undoWindowMs: getSessionUndoMs(),
  });
  // Keep the commit handler's writers current without writing a ref during render.
  useLayoutEffect(() => {
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
      upsertSavedPlace,
      grantAllowance,
      onVoiceTaskCreated,
      directMode: getSessionDirectMode(),
      undoWindowMs: getSessionUndoMs(),
    };
  });

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
      return result.ok
        ? { reverse: result.reverse, note: result.note }
        : { ask: result.ask, reverse: undefined };
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
  const key = stageSceneKey(drive.phase, beat);
  const sceneFaces = payload.faces?.length ? payload.faces : faces;
  const selectedName = payload.assignee;
  const title = payload.title ?? '';
  const titleHeard = Boolean(title && drive.spoken.toLowerCase().includes(title.toLowerCase()));
  const text = (scene = beat.scene, write = payload.write) => stageAccent(scene, write, isDark);
  const ink = (scene = beat.scene, write = payload.write) => stageFill(scene, write);
  const kicker = (scene = beat.scene, write = payload.write) => stageDomainLabel(scene, write);
  const undoRows = poppinsUiOrchestrator.undoLedgerRows();
  const undoCount = poppinsUiOrchestrator.undoCount();
  const undoOpen = Boolean(drive.undoUntil && Date.now() < drive.undoUntil && undoCount > 0);
  const queuedRows = queuedRowsAhead(drive);
  const activeItems = payload.items?.filter((item) => !item.dropped) ?? [];
  const groupKicker =
    payload.progressLabel ?? (activeItems.length > 1 ? `${activeItems.length} items` : undefined);
  const holdState = {
    holdProgress,
    holding: drive.holding,
    frozen: drive.frozen,
  };

  const pickFace = (name: string) =>
    poppinsUiOrchestrator.chooseFromTap({ assignee: name, spokenName: name }, name, 'face');

  // Design "one row failed — the rest stand": the rows that saved keep their checks; the
  // one that didn't gets its own card with Retry / Leave it.
  const failed = poppinsUiOrchestrator.failedRows();
  const retryFailed = async () => {
    if (!failed) return;
    for (const item of failed.items) {
      poppinsUiOrchestrator.patchBeatItem(failed.beat.id, item.id, { status: 'saving' });
      try {
        const result = await commitIuiBeat(
          { ...failed.beat, payload: { ...failed.beat.payload, items: [{ ...item, status: 'pending' }] } },
          { ...writesRef.current, onGroupItemStatus: undefined }
        );
        poppinsUiOrchestrator.patchBeatItem(failed.beat.id, item.id, { status: result.ok ? 'done' : 'failed' });
      } catch {
        poppinsUiOrchestrator.patchBeatItem(failed.beat.id, item.id, { status: 'failed' });
      }
    }
  };
  const leaveFailed = () => {
    if (!failed) return;
    for (const item of failed.items) poppinsUiOrchestrator.patchBeatItem(failed.beat.id, item.id, { dropped: true });
  };
  const failedLabel = failed ? failed.items.map((item) => item.label).join(' and ') : '';
  const savedLabels = failed
    ? (failed.beat.payload.items ?? []).filter((item) => item.status === 'done' && !item.dropped).map((item) => item.label)
    : [];
  const savedLine = failed
    ? savedLabels.length
      ? `${joinWords(savedLabels)} ${savedLabels.length === 1 ? 'is' : 'are'} ${
          failed.beat.payload.write === 'add_grocery' ? 'on the list' : 'saved'
        }. Only ${failedLabel.toLowerCase()} came back.`
      : `Only ${failedLabel.toLowerCase()} came back.`
    : '';

  const resultMark = (
    <View style={styles.stack}>
      <IuiResultMark
        kind={payload.markKind ?? 'added'}
        title={resultMarkTitle(payload, undoOpen ? undoRows : [])}
        modelOffline={payload.modelOffline === true}
        undoable={undoOpen}
        undoUntil={drive.undoUntil}
        undoLabel={undoLabelFor(undoCount)}
        ledger={undoOpen ? undoRows : []}
        onUndo={() => void poppinsUiOrchestrator.undoLast()}
        onUndoOne={(id) => void poppinsUiOrchestrator.undoOne(id)}
      />
      {failed ? (
        <IuiTroubleRowFailed
          accent={text()}
          failedLabel={failedLabel}
          savedLine={savedLine}
          onRetry={() => void retryFailed()}
          onLeave={leaveFailed}
        />
      ) : null}
    </View>
  );

  const batchCard = (label: string) => (
    <IuiCard
      accent={text()}
      fillAccent={ink()}
      kicker={kicker()}
      countLabel={groupKicker ?? `${activeItems.length} tasks`}
      hold={payload.composeReady === true}
      {...holdState}
      leftFooter={payload.composeReady === true ? 'One hold for all' : 'Pick who is missing'}
      rightFooter="× drops one"
      accessibilityLabel={label}>
      <IuiGroupRows
        items={payload.items ?? []}
        queued={queuedRows}
        accent={ink()}
        kind="task"
        allowDrop={drive.phase !== 'settle'}
        onDrop={(id) => poppinsUiOrchestrator.dropGroupItem(id)}
      />
      {payload.composeReady === false ? (
        <IuiFaces faces={sceneFaces} selectedName={selectedName} accent={ink()} onSelect={pickFace} />
      ) : null}
    </IuiCard>
  );

  let card: ReactNode;
  switch (key) {
    case 'narrow': {
      const chips = payload.chips ?? [];
      card = (
        <IuiCard accent={text()} fillAccent={ink()} kicker={kicker()} countLabel="Which one?">
          <IuiChips
            chips={[...chips, { id: OTHER_CHIP_ID, label: 'Something else' }]}
            selectedId={payload.selectedChipId}
            accent={ink()}
            onSelect={(id) => {
              if (id === OTHER_CHIP_ID) {
                // Neither — drop the guesses and ask for the word again. Waits; never commits blind.
                poppinsUiOrchestrator.revise({
                  chips: undefined,
                  narrow: false,
                  provisional: false,
                  selectedChipId: undefined,
                  groceryName: '',
                  title: '',
                  composeReady: false,
                });
                return;
              }
              const label = chips.find((chip) => chip.id === id)?.label ?? id;
              poppinsUiOrchestrator.chooseFromTap(
                beat.scene === 'grocery_add'
                  ? { groceryName: label, title: label, selectedChipId: id, provisional: false, composeReady: true }
                  : { title: label, selectedChipId: id, libraryTaskId: id, provisional: false, composeReady: true },
                label,
                'chip'
              );
            }}
          />
          <Text style={[styles.cardHint, { color: c.textMuted }]}>Say it, or tap one.</Text>
        </IuiCard>
      );
      break;
    }

    case 'thinking':
      card = (
        <Text style={[styles.lead, { color: c.text }]}>{payload.thinkingLine || 'Working on it.'}</Text>
      );
      break;

    case 'member_pick':
      card = (
        <IuiStepper kicker={kicker('member_pick')} accent={text()}>
          <IuiFaces
            faces={sceneFaces}
            selectedName={selectedName}
            pulsingName={payload.spokenName}
            accent={ink()}
            onSelect={pickFace}
          />
        </IuiStepper>
      );
      break;

    case 'task_compose':
      card =
        activeItems.length > 1 ? (
          batchCard('Task batch card')
        ) : (
          <TaskComposeSteps
            payload={payload}
            faces={sceneFaces}
            selectedName={selectedName}
            accent={text()}
            fillAccent={ink()}
            domains={composeDomains}
            hold={payload.composeReady === true}
            {...holdState}
            titleHeard={titleHeard}
            title={title}
          />
        );
      break;

    case 'homework_compose':
      card =
        activeItems.length > 1 ? (
          batchCard('Homework batch card')
        ) : (
          <HomeworkComposeSteps
            payload={payload}
            faces={sceneFaces}
            selectedName={selectedName}
            accent={text()}
            hold={payload.composeReady === true}
            {...holdState}
            titleHeard={titleHeard}
            title={title}
          />
        );
      break;

    case 'calendar_zoom':
      card = (
        <IuiEventCard
          payload={payload}
          accent={text()}
          fillAccent={ink()}
          hold={Boolean(payload.title)}
          {...holdState}
          dayEvents={household.events ?? []}
          tellCandidate={
            household.members.find(
              (m) =>
                (m.role === 'admin' || m.role === 'owner' || m.role === 'adult') &&
                m.name !== payload.assignee &&
                m.id !== currentMember?.id
            )?.name
          }
        />
      );
      break;

    case 'itinerary_stage':
      card = (
        <IuiTripCard
          payload={{
            ...payload,
            stops: payload.stops?.length
              ? payload.stops
              : ((household.itineraries ?? [])
                  .find((trip) => trip.id === payload.itineraryId)
                  ?.stops?.map((stop, i) => ({
                    id: stop.id ?? `stop-${i}`,
                    label: stop.label ?? `Stop ${i + 1}`,
                    kind: String(stop.kind ?? 'other'),
                  })) ?? []),
          }}
          accent={text()}
          fillAccent={ink()}
          hold={beat.commit === 'hold'}
          {...holdState}
          groceryCount={(household.groceries ?? []).filter((g) => g.status !== 'Purchased').length}
        />
      );
      break;

    case 'grocery_add': {
      const named = Boolean(payload.groceryName || payload.title || activeItems.length);
      card = named ? (
        <IuiGroceryCard
          payload={payload}
          accent={text()}
          fillAccent={ink()}
          hold
          {...holdState}
          queued={queuedRows}
          countLabel={groupKicker}
          onAddNow={() => void poppinsUiOrchestrator.confirm({ fromTap: true })}
          onNotThat={() => poppinsUiOrchestrator.veto()}
          onDropQueued={(id) => poppinsUiOrchestrator.dropQueuedBeat(id)}
        />
      ) : (
        <IuiTroubleMissingSlot
          accent={text()}
          fillAccent={ink()}
          question="What should I add?"
          why="Say the item, or tap one."
          chips={[
            { id: 'milk', label: 'Milk' },
            { id: 'coffee', label: 'Coffee' },
            { id: 'eggs', label: 'Eggs' },
          ]}
          onPick={(_id, label) =>
            poppinsUiOrchestrator.chooseFromTap(
              { groceryName: label, title: label, composeReady: true },
              label,
              'grocery'
            )
          }
        />
      );
      break;
    }

    case 'task_done':
      card = (
        <IuiCard
          accent={text()}
          fillAccent={ink()}
          kicker={kicker()}
          hold={beat.commit === 'hold'}
          {...holdState}
          leftFooter={drive.holding ? 'Marking it done…' : 'One hold marks it done'}
          accessibilityLabel={`Mark done: ${payload.title ?? 'task'}`}>
          <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
            {payload.title ?? 'This task'}
          </Text>
          <Text style={[styles.cardHint, { color: c.textMuted }]}>Mark it done</Text>
        </IuiCard>
      );
      break;

    case 'result_mark':
      card = resultMark;
      break;

    case 'reward_mint':
      card = (
        <View style={styles.stack}>
          <IuiObjectCard
            title={payload.rewardName ?? payload.title ?? 'Reward'}
            emoji="✨"
            accent={ink('reward_mint')}
          />
          {payload.confirmSummary ? (
            <Text style={[styles.cardHint, { color: c.textMuted }]}>{payload.confirmSummary}</Text>
          ) : null}
        </View>
      );
      break;

    case 'place_save':
      card = (
        <IuiPlaceCard
          accent={text('place_save')}
          fillAccent={ink('place_save')}
          name={payload.placeName ?? payload.title ?? 'Place'}
          kind={payload.placeKind}
          address={payload.placeAddress ?? payload.location}
          holding={drive.holding}
          holdProgress={holdProgress}
        />
      );
      break;

    case 'allowance_act':
      card = (
        <IuiAllowanceCard
          accent={text('allowance_act')}
          fillAccent={ink('allowance_act')}
          memberName={payload.allowanceMemberName ?? 'someone'}
          amountLabel={payload.allowanceAmountLabel ?? 'Allowance'}
          note={payload.allowanceNote}
          kind={payload.allowanceKind}
        />
      );
      break;

    case 'ranks_peek':
      card = (
        <IuiCard
          accent={text('ranks_peek')}
          fillAccent={ink('ranks_peek')}
          kicker={kicker('ranks_peek')}
          countLabel="This week"
          accessibilityLabel="Who is ahead this week">
          <IuiPeek
            rows={
              payload.peek?.length
                ? payload.peek
                : ranksPeekRows.length
                  ? ranksPeekRows
                  : [{ id: 'empty', title: 'No ranks yet', detail: 'Finish a chore to climb.' }]
            }
            accent={ink('ranks_peek')}
            highlightIndex={0}
          />
        </IuiCard>
      );
      break;

    case 'memory_note':
      card = (
        <IuiMemoryNote
          text={payload.memoryText ?? payload.title ?? ''}
          subject={payload.memorySubject}
          kind={payload.memoryKind}
        />
      );
      break;

    case 'list_peek': {
      const peekHighlight = (payload.peek ?? []).findIndex((row) =>
        drive.spoken.toLowerCase().includes(row.title.toLowerCase())
      );
      card = (
        <IuiCard accent={text()} fillAccent={ink()} kicker={payload.title ?? kicker()}>
          <IuiPeek
            rows={
              payload.peek?.length
                ? payload.peek
                : [{ id: 'empty', title: 'Nothing here right now' }]
            }
            accent={ink()}
            highlightIndex={peekHighlight >= 0 ? peekHighlight : 0}
          />
        </IuiCard>
      );
      break;
    }

    case 'confirm':
      card = (
        <IuiCard
          accent={text()}
          fillAccent={ink()}
          kicker={payload.write && payload.write !== 'none' ? kicker() : 'Confirm'}
          accessibilityLabel="Confirm">
          <Text style={[styles.cardTitle, { color: c.text }]}>
            {payload.confirmSummary ?? 'Confirm?'}
          </Text>
          <Text style={[styles.cardHint, { color: c.textMuted }]}>Say yes, or tap below.</Text>
        </IuiCard>
      );
      break;

    case 'navigate_coach':
      card = (
        <Text style={[styles.lead, { color: c.text }]}>{payload.coachLine ?? 'Opening that now.'}</Text>
      );
      break;

    case 'coach_steps':
      card = (
        <IuiCoachCard
          payload={payload}
          accent={text()}
          fillAccent={ink()}
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
      );
      break;

    default:
      console.warn('iui.stage_unknown_scene', { scene: beat.scene, phase: drive.phase });
      card = (
        <IuiCard accent={text()} fillAccent={ink()} kicker={kicker()} accessibilityLabel="Stage card">
          <Text style={[styles.cardTitle, { color: c.text }]}>
            {payload.title ?? payload.groceryName ?? payload.thinkingLine ?? 'I lost track of that.'}
          </Text>
          <Pressable
            onPress={() => poppinsUiOrchestrator.clear()}
            accessibilityRole="button"
            accessibilityLabel="Start over"
            style={[styles.quietBtn, { borderColor: glassBorder(0.12) }]}>
            <Text style={{ color: c.text }}>Start over</Text>
          </Pressable>
        </IuiCard>
      );
  }

  const line = drive.spoken.trim() || payload.thinkingLine || drive.thinkingLine;
  const showLine = Boolean(line) && key !== 'thinking' && key !== 'navigate_coach';

  return (
    <View key={beat.id} style={styles.root}>
      {showLine ? (
        <Text
          style={[drive.spoken.trim() ? styles.spoken : styles.think, { color: c.textMuted }]}
          numberOfLines={2}>
          {line}
        </Text>
      ) : null}
      {card}
      <CommitAffordance beat={beat} drive={drive} sceneKey={key} accentBorder={ink()} />
    </View>
  );
}

/** Rows for acts queued behind the current one (the Batch board's "next" strip). */
function queuedRowsAhead(drive: IuiDriveState): IuiGroupItem[] {
  return drive.playlist.slice(drive.index + 1).flatMap((next) => {
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
    const label = next.payload.groceryName ?? next.payload.title ?? next.payload.thinkingLine ?? '';
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
}

/**
 * The one way to say yes by touch. Confirm beats get Yes / No. Hold beats get "tap to
 * confirm" unless their card already has its own button (groceries: Add now).
 */
function CommitAffordance({
  beat,
  drive,
  sceneKey,
  accentBorder,
}: {
  beat: IuiBeat;
  drive: IuiDriveState;
  sceneKey: string;
  accentBorder: string;
}) {
  const { c, glassBorder } = useOrbitColors();
  if (sceneKey === 'narrow' || drive.phase === 'settle') return null;

  if (drive.commitFailed) {
    return (
      <View style={styles.confirmRow}>
        <Pressable
          onPress={() => poppinsUiOrchestrator.veto()}
          accessibilityRole="button"
          accessibilityLabel="Skip"
          style={[styles.quietBtn, { borderColor: glassBorder(0.12) }]}>
          <Text style={{ color: c.text }}>Skip</Text>
        </Pressable>
        <Pressable
          onPress={() => void poppinsUiOrchestrator.confirm({ fromTap: true })}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={[styles.quietBtn, { borderColor: `${accentBorder}66` }]}>
          <Text style={{ color: c.text }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (beat.commit === 'confirm') {
    return (
      <View style={styles.confirmRow}>
        <Pressable
          onPress={() => poppinsUiOrchestrator.veto()}
          accessibilityRole="button"
          accessibilityLabel="No"
          style={[styles.quietBtn, { borderColor: glassBorder(0.12) }]}>
          <Text style={{ color: c.text }}>No</Text>
        </Pressable>
        <Pressable
          onPress={() => void poppinsUiOrchestrator.confirm({ fromTap: true })}
          accessibilityRole="button"
          accessibilityLabel="Yes"
          style={[styles.quietBtn, { borderColor: `${accentBorder}66` }]}>
          <Text style={{ color: c.text }}>Yes</Text>
        </Pressable>
      </View>
    );
  }

  if (
    beat.commit === 'hold' &&
    beat.payload.composeReady !== false &&
    beat.scene !== 'grocery_add'
  ) {
    return (
      <Pressable
        onPress={() => void poppinsUiOrchestrator.confirm({ fromTap: true })}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={drive.frozen ? 'Tap to confirm' : 'Confirm now'}
        style={styles.tapConfirm}>
        <Text style={[styles.fallback, { color: c.textSubtle }]}>
          {drive.frozen ? 'Tap to confirm' : 'or tap to confirm'}
        </Text>
      </Pressable>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    alignItems: 'center',
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
  cardTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: -0.3,
    paddingHorizontal: 8,
    paddingTop: 2,
  },
  cardHint: { fontSize: 13, lineHeight: 18, paddingHorizontal: 8, paddingBottom: 6 },
  stack: { width: '100%', alignItems: 'center', gap: 16 },
  fallback: { fontSize: 12, textAlign: 'center' },
  tapConfirm: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  confirmRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  quietBtn: {
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
  },
});

/** "Milk", "Milk and eggs", "Milk, eggs and jam". */
function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

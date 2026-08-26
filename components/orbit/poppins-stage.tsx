/**
 * IUI stage — one idea at a time inside the Activity window.
 */

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { IuiChips } from '@/components/orbit/poppins-stage/iui-chips';
import { IuiDay } from '@/components/orbit/poppins-stage/iui-day';
import { IuiDomainGrid } from '@/components/orbit/poppins-stage/iui-domain-grid';
import { IuiFaces } from '@/components/orbit/poppins-stage/iui-faces';
import { IuiGhostField } from '@/components/orbit/poppins-stage/iui-ghost-field';
import { IuiLattice } from '@/components/orbit/poppins-stage/iui-lattice';
import { IuiObjectCard } from '@/components/orbit/poppins-stage/iui-object-card';
import { IuiPeek } from '@/components/orbit/poppins-stage/iui-peek';
import { IuiResultMark } from '@/components/orbit/poppins-stage/iui-result-mark';
import { IuiRoad } from '@/components/orbit/poppins-stage/iui-road';
import { IuiStepper } from '@/components/orbit/poppins-stage/iui-stepper';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { householdHasChildren } from '@/lib/household/has-children';
import { composeStepLabel, IUI_CREATED_CHIP_ID, IUI_DUE_CHIPS, nextComposeStep } from '@/lib/poppins/iui-compose';
import { poppinsUiOrchestrator, usePoppinsUiDrive } from '@/lib/poppins/ui-orchestrator';
import type { IuiBeat, IuiChip, IuiFace, IuiPayload } from '@/lib/poppins/ui-scenes';
import { formatLocalDate } from '@/lib/streaks/local-date';
import { occurrenceDateForDueLabel } from '@/lib/tasks/due-label';
import { buildLibraryAssignInput } from '@/lib/tasks/assign-from-library';
import { allLibraryTasks, choreDomains, homeworkDomain } from '@/lib/tasks/task-library';
import { resolvePoppinsChoreTitle } from '@/lib/poppins/catalog-match';
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

function TaskComposeSteps({
  payload,
  faces,
  selectedName,
  accent,
  domains,
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
  domains: { id: string; label: string }[];
  hold: boolean;
  holdProgress: number;
  holding: boolean;
  frozen: boolean;
  titleHeard: boolean;
  title: string;
}) {
  const { household } = useOrbit();
  const step = payload.composeStep ?? nextComposeStep(payload);
  const showEmoji = payload.showEmoji !== false;
  const categoryId = payload.category ?? payload.selectedChipId;
  const query = (payload.taskQuery ?? '').toLowerCase().trim();
  const libraryTasks = allLibraryTasks()
    .filter((task) => task.domainId === categoryId)
    .filter((task) => {
      if (!query) return true;
      return (
        task.name.toLowerCase().includes(query) ||
        task.searchTerms.some((term) => term.toLowerCase().includes(query))
      );
    });
  const homework = categoryId === 'homework_education';
  const whoFaces = homework
    ? faces.filter((face) =>
        household.members.some((m) => m.id === face.id && m.role === 'child')
      )
    : faces;
  const shownFaces = whoFaces.length ? whoFaces : faces;

  const goBack = () => {
    if (step === 'category') {
      poppinsUiOrchestrator.revise({ assignee: '', spokenName: undefined });
      return;
    }
    if (step === 'task') {
      poppinsUiOrchestrator.revise({
        category: '',
        selectedChipId: undefined,
        title: '',
        libraryTaskId: undefined,
      });
      return;
    }
    poppinsUiOrchestrator.revise({ due: '' });
  };

  const customTitle = Boolean((payload.title ?? title).trim()) && !payload.libraryTaskId;
  const showDue = step === 'when' || step === 'ready' || (step === 'task' && customTitle);

  return (
    <IuiStepper
      kicker={composeStepLabel(step)}
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

      {step === 'category' ? (
        <IuiDomainGrid
          domains={domains}
          selectedId={categoryId}
          accent={accent}
          narrow={Boolean(categoryId)}
          onSelect={(id) => {
            const childOnly = id === 'homework_education';
            const assignee = selectedName;
            const assigneeOk =
              !childOnly ||
              household.members.some((m) => m.name === assignee && m.role === 'child');
            poppinsUiOrchestrator.chooseFromTap(
              {
                selectedChipId: id,
                category: id,
                title: '',
                libraryTaskId: undefined,
                assignee: assigneeOk ? assignee : '',
              },
              domains.find((domain) => domain.id === id)?.label ?? id,
              'category'
            );
          }}
        />
      ) : null}

      {step === 'task' ? (
        <>
          <IuiChips
            chips={(() => {
              const pool = (libraryTasks.length
                ? libraryTasks
                : allLibraryTasks().filter((t) => t.domainId === categoryId)
              ).map(
                (task): IuiChip => ({
                  id: task.id,
                  label: task.name,
                  kind: 'library',
                })
              );
              const custom = (payload.title ?? title).trim();
              const already = pool.some(
                (chip) => chip.label.toLowerCase() === custom.toLowerCase()
              );
              if (custom && !already) {
                return [
                  {
                    id: IUI_CREATED_CHIP_ID,
                    label: custom,
                    kind: 'created',
                  },
                  ...pool,
                ];
              }
              return pool;
            })()}
            selectedId={
              payload.selectedChipId === IUI_CREATED_CHIP_ID ||
              (Boolean(payload.title) && !payload.libraryTaskId)
                ? IUI_CREATED_CHIP_ID
                : payload.libraryTaskId
            }
            accent={accent}
            showEmoji={showEmoji}
            onSelect={(id) => {
              if (id === IUI_CREATED_CHIP_ID) {
                poppinsUiOrchestrator.chooseFromTap(
                  {
                    libraryTaskId: undefined,
                    selectedChipId: IUI_CREATED_CHIP_ID,
                    title: (payload.title ?? title).trim(),
                    category: categoryId,
                  },
                  (payload.title ?? title).trim() || 'this task',
                  'chip'
                );
                return;
              }
              const pool = allLibraryTasks().filter((item) => item.domainId === categoryId);
              const task = pool.find((item) => item.id === id);
              poppinsUiOrchestrator.chooseFromTap(
                {
                  libraryTaskId: id,
                  selectedChipId: id,
                  title: task?.name ?? id,
                  category: task?.domainId ?? categoryId,
                  taskQuery: undefined,
                },
                task?.name ?? id,
                'chip'
              );
            }}
          />
        </>
      ) : null}

      {showDue ? (
        <>
          {step !== 'task' ? (
            <IuiGhostField text={title} accent={accent} catchUp={titleHeard} />
          ) : null}
          <IuiChips
            chips={IUI_DUE_CHIPS.map((chip) => ({ id: chip.id, label: chip.label }))}
            selectedId={payload.repeat === 'Daily' ? 'Daily' : payload.due}
            accent={accent}
            onSelect={(id) => {
              if (id === 'Daily') {
                poppinsUiOrchestrator.chooseFromTap(
                  { due: payload.due && payload.due !== 'Daily' ? payload.due : 'Today', repeat: 'Daily' },
                  'Daily',
                  'when'
                );
                return;
              }
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
  const { c, glassBorder } = useOrbitColors();
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
    accentTheme,
  } = useOrbit();
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
    completeTask,
    updateTask,
    claimReward,
    advanceItineraryStop,
    onVoiceTaskCreated,
  });
  writesRef.current = {
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
      } = writesRef.current;
      const p = beat.payload;
      const write = p.write ?? 'none';
      if (write === 'create_task' && (p.title || p.libraryTaskId)) {
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
          const dueLabel = p.due ?? 'Today';
          const occurrenceDate = occurrenceDateForDueLabel(dueLabel);
          const title = resolved.title || p.title;
          let created = null;
          if (library) {
            const [y, m, d] = occurrenceDate.split('-').map(Number);
            const occurrence = new Date(y, (m ?? 1) - 1, d ?? 1);
            created = await createTask({
              ...buildLibraryAssignInput(
                library,
                assignee,
                library.defaultFrequency,
                occurrence
              ),
              due: dueLabel,
              occurrenceDate,
            });
          } else if (title) {
            created = await createTask({
              title,
              category: p.category ?? p.selectedChipId ?? resolved.category ?? 'home_maintenance',
              assignee,
              due: dueLabel,
              xp: 10,
              repeat: p.repeat === 'Daily' ? 'Daily' : 'None',
              difficulty: 'medium',
              weight: 1,
              occurrenceDate,
            });
          }
          if (created) onVoiceTaskCreated?.(created);
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
      }
      if (write === 'add_grocery' && p.groceryName) {
        await addMissingGrocery({
          name: p.groceryName,
          category: p.aisle || (p.shoppingLane === 'clothing' ? 'Clothing' : undefined),
          categoryId: p.shoppingLane === 'clothing' ? 'clothing' : undefined,
        });
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
        if (id) await completeTask(id);
      }
      if (write === 'update_task' && p.taskId) {
        const task = household.tasks.find((item) => item.id === p.taskId);
        if (task) {
          await updateTask({
            ...task,
            title: p.title || task.title,
            assignee: p.assignee || task.assignee,
          });
        }
      }
      if (write === 'claim_reward' && p.rewardName) {
        const reward = household.rewards?.find(
          (item) => item.title.toLowerCase() === p.rewardName!.toLowerCase()
        );
        if (reward) await claimReward(reward.id);
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
      }
      if (write === 'advance_itinerary' && p.itineraryId) {
        const trip = household.itineraries?.find((item) => item.id === p.itineraryId);
        const next = trip?.stops.find((s) => s.status === 'active') ?? trip?.stops[0];
        if (next) await advanceItineraryStop(p.itineraryId, next.id);
      }
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
        <TaskComposeSteps
          payload={payload}
          faces={sceneFaces}
          selectedName={selectedName}
          accent={accent}
          domains={composeDomains}
          hold={payload.composeReady === true}
          holdProgress={holdProgress}
          holding={drive.holding}
          frozen={drive.frozen}
          titleHeard={titleHeard}
          title={title}
        />
      ) : null}

      {beat.scene === 'calendar_zoom' ? (
        <IuiStepper
          kicker={payload.date ? 'When' : 'When'}
          accent={accent}
          hold={Boolean(payload.title)}
          holdProgress={holdProgress}
          holding={drive.holding}
          frozen={drive.frozen}>
          {!unfolded ? (
            <IuiLattice
              monthLabel={payload.monthLabel ?? monthLabel(payload.date)}
              dayNumber={payload.dayNumber ?? dayNumber(payload.date)}
              accent={accent}
            />
          ) : (
            <>
              <IuiDay
                dayNumber={payload.dayNumber ?? dayNumber(payload.date)}
                weekday={weekdayLabel(payload.date, payload.due)}
                monthLabel={payload.monthLabel ?? monthLabel(payload.date)}
                accent={accent}
              />
              <IuiObjectCard
                title={payload.title ?? 'Event'}
                detail={[payload.time, payload.location].filter(Boolean).join(' · ')}
                emoji="📅"
                accent={accent}
              />
            </>
          )}
        </IuiStepper>
      ) : null}

      {beat.scene === 'itinerary_stage' ? (
        <IuiStepper
          kicker="Where"
          accent={accent}
          hold
          holdProgress={holdProgress}
          holding={drive.holding}
          frozen={drive.frozen}>
          <Text style={[styles.lead, { color: c.text }]}>{payload.itineraryTitle ?? 'Trip'}</Text>
          <IuiRoad
            accent={accent}
            drawRoad={unfolded}
            stop={
              payload.stops?.[0] ?? {
                id: 'stop-1',
                label: payload.itineraryTitle ?? 'Stop',
                emoji: '📍',
              }
            }
          />
        </IuiStepper>
      ) : null}

      {beat.scene === 'grocery_add' ? (
        <IuiStepper
          kicker={payload.shoppingLane === 'clothing' ? 'Shopping' : 'What'}
          accent={accent}
          hold
          holdProgress={holdProgress}
          holding={drive.holding}
          frozen={drive.frozen}>
          <IuiObjectCard
            title={payload.groceryName ?? payload.title ?? 'Item'}
            detail={payload.aisle}
            emoji={payload.shoppingLane === 'clothing' ? '👟' : '🛒'}
            accent={accent}
          />
        </IuiStepper>
      ) : null}

      {beat.scene === 'task_done' ? (
        <IuiResultMark kind="done" title={payload.title} />
      ) : null}

      {beat.scene === 'result_mark' ? (
        <IuiResultMark kind={payload.markKind ?? 'added'} title={payload.title ?? payload.groceryName} />
      ) : null}

      {beat.scene === 'reward_mint' ? (
        <View style={styles.stack}>
          <IuiObjectCard title={payload.rewardName ?? payload.title ?? 'Reward'} emoji="✨" accent={accent} />
          <Text style={[styles.hint, { color: c.textMuted }]}>
            {payload.confirmSummary ?? 'Say yes to mint.'}
          </Text>
        </View>
      ) : null}

      {beat.scene === 'list_peek' ? (
        <IuiPeek
          rows={payload.peek ?? []}
          accent={accent}
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 16,
  },
  think: {
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontWeight: '600',
    textAlign: 'center',
  },
  spoken: {
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.2,
    textAlign: 'center',
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

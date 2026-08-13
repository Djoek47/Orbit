/**
 * IUI stage — one idea at a time inside the Activity window.
 */

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { RouteSteps } from '@/components/orbit/route-steps';
import { IuiChips } from '@/components/orbit/poppins-stage/iui-chips';
import { IuiFaces } from '@/components/orbit/poppins-stage/iui-faces';
import { IuiGhostField } from '@/components/orbit/poppins-stage/iui-ghost-field';
import { IuiHoldRing } from '@/components/orbit/poppins-stage/iui-hold-ring';
import { IuiLattice } from '@/components/orbit/poppins-stage/iui-lattice';
import { IuiObjectCard } from '@/components/orbit/poppins-stage/iui-object-card';
import { IuiPeek } from '@/components/orbit/poppins-stage/iui-peek';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { poppinsUiOrchestrator, usePoppinsUiDrive } from '@/lib/poppins/ui-orchestrator';
import type { IuiBeat, IuiFace } from '@/lib/poppins/ui-scenes';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

const TASK_CHIPS = [
  { id: 'kitchen', label: 'Kitchen', emoji: '🍽️' },
  { id: 'home', label: 'Home', emoji: '🏠' },
  { id: 'errand', label: 'Errand', emoji: '🛒' },
];

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

export function PoppinsStage() {
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
    advanceItineraryStop,
    accentTheme,
  } = useOrbit();
  const accent = accentTheme.primary;
  const [holdProgress, setHoldProgress] = useState(0);
  const lastPhase = useRef(drive.phase);

  useEffect(() => {
    if (lastPhase.current === drive.phase) return;
    lastPhase.current = drive.phase;
    if (drive.phase === 'show') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } else if (drive.phase === 'settle') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
  }, [drive.phase]);

  const faces: IuiFace[] = useMemo(
    () =>
      household.members
        .filter((m) => m.status === 'active' && m.role !== 'guest' && m.role !== 'shared-device')
        .slice(0, 3)
        .map((m) => ({
          id: m.id,
          name: m.name,
          emoji: memberDisplayEmoji(m),
          imageUri: isAvatarImageUri(m.avatar) ? m.avatar : undefined,
        })),
    [household.members]
  );

  useEffect(() => {
    poppinsUiOrchestrator.setCoachHandler((route) => {
      try {
        router.push(route as never);
      } catch {
        /* ignore */
      }
    });
    poppinsUiOrchestrator.setCommitHandler(async (beat: IuiBeat) => {
      const p = beat.payload;
      const write = p.write ?? 'none';
      if (write === 'create_task' && p.title) {
        await createTask({
          title: p.title,
          category: p.category ?? p.selectedChipId ?? 'Home',
          assignee: p.assignee || currentMember?.name || household.members[0]?.name || 'Me',
          due: p.due ?? 'Today',
          xp: 10,
          repeat: 'None',
        });
      }
      if (write === 'create_event' && p.title) {
        await createEvent({
          title: p.title,
          date: p.date || new Date().toISOString().slice(0, 10),
          time: p.time || '09:00',
          location: p.location || '',
          responsible: p.assignee || currentMember?.name || '',
          category: 'Appointment',
        });
      }
      if (write === 'add_grocery' && p.groceryName) {
        await addMissingGrocery({ name: p.groceryName, category: p.aisle });
      }
      if (write === 'complete_task' && p.taskId) {
        await completeTask(p.taskId);
      }
      if (write === 'create_itinerary_stop') {
        const stopLabel = p.stops?.[0]?.label ?? p.itineraryTitle ?? 'Stop';
        await createItinerary({
          title: p.itineraryTitle ?? stopLabel,
          date: new Date().toISOString().slice(0, 10),
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
    };
  }, [
    addMissingGrocery,
    advanceItineraryStop,
    completeTask,
    createEvent,
    createItinerary,
    createTask,
    currentMember?.name,
    household.itineraries,
    household.members,
  ]);

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

  return (
    <Animated.View
      key={beat.id}
      entering={FadeIn.duration(280)}
      exiting={FadeOut.duration(180)}
      style={styles.root}>
      {payload.thinkingLine || drive.thinkingLine ? (
        <Text style={[styles.think, { color: c.textSubtle }]}>
          {payload.thinkingLine || drive.thinkingLine}
        </Text>
      ) : null}

      {beat.scene === 'thinking' ? (
        <Text style={[styles.lead, { color: c.text }]}>{payload.thinkingLine || 'Working.'}</Text>
      ) : null}

      {beat.scene === 'task_compose' || beat.scene === 'member_pick' ? (
        <View style={styles.stack}>
          <IuiFaces
            faces={sceneFaces}
            selectedName={selectedName}
            accent={accent}
            onSelect={(name) => poppinsUiOrchestrator.revise({ assignee: name })}
          />
          {beat.scene === 'task_compose' ? (
            <>
              <IuiChips
                chips={payload.chips?.length ? payload.chips : TASK_CHIPS}
                selectedId={payload.selectedChipId}
                accent={accent}
                onSelect={(id) => poppinsUiOrchestrator.revise({ selectedChipId: id, category: id })}
              />
              <IuiGhostField text={payload.title ?? ''} accent={accent} />
            </>
          ) : null}
        </View>
      ) : null}

      {beat.scene === 'calendar_zoom' ? (
        <View style={styles.stack}>
          <IuiLattice
            monthLabel={payload.monthLabel ?? monthLabel(payload.date)}
            dayNumber={payload.dayNumber ?? dayNumber(payload.date)}
            accent={accent}
          />
          <IuiObjectCard
            title={payload.title ?? 'Event'}
            detail={[payload.time, payload.location].filter(Boolean).join(' · ')}
            emoji="📅"
            accent={accent}
          />
        </View>
      ) : null}

      {beat.scene === 'itinerary_stage' ? (
        <View style={styles.stack}>
          <Text style={[styles.lead, { color: c.text }]}>{payload.itineraryTitle ?? 'Trip'}</Text>
          <RouteSteps
            accentColor={accent}
            steps={(payload.stops ?? []).map((stop) => ({
              id: stop.id,
              emoji: stop.emoji ?? '📍',
              title: stop.label,
              category: stop.category,
              active: true,
            }))}
          />
        </View>
      ) : null}

      {beat.scene === 'grocery_add' ? (
        <IuiObjectCard
          title={payload.groceryName ?? payload.title ?? 'Item'}
          detail={payload.aisle}
          emoji="🛒"
          accent={accent}
        />
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
        <IuiPeek rows={payload.peek ?? []} accent={accent} highlightIndex={2} />
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

      {beat.commit === 'hold' ? (
        <>
          <IuiHoldRing progress={holdProgress} accent={accent} frozen={drive.frozen} />
          <Pressable onPress={() => poppinsUiOrchestrator.confirm()} hitSlop={12}>
            <Text style={[styles.fallback, { color: c.textSubtle }]}>or tap to confirm</Text>
          </Pressable>
        </>
      ) : null}

      {beat.commit === 'confirm' ? (
        <View style={styles.confirmRow}>
          <Pressable
            onPress={() => poppinsUiOrchestrator.veto()}
            style={[styles.quietBtn, { borderColor: glassBorder(0.12) }]}>
            <Text style={{ color: c.text }}>No</Text>
          </Pressable>
          <Pressable
            onPress={() => poppinsUiOrchestrator.confirm()}
            style={[styles.quietBtn, { borderColor: `${accent}66` }]}>
            <Text style={{ color: c.text }}>Yes</Text>
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
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

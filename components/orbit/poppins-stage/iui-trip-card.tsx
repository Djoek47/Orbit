/**
 * The trip card (design: "IUI — a trip, six stops").
 *
 *   Wednesday run                         6 stops · 5h 40m
 *   ●  4:00 PM  Soccer practice   Parc Jarry · saved place
 *   │  5:15 PM  Work              1250 René-Lévesque O
 *   │  7:00 PM  Shopping          Your list comes along · 6 items      ← teal
 *   │  …
 *   ○ 10:15 PM  Pick up the kids  Which address? tap to set             ← amber
 *   (Reorder) (Add a stop) (Tomorrow)
 *   ──────────── One hold saves the whole run · an address can come later
 *
 * Any number of stops. Every edit re-lays the times. Editing (an address, a new stop)
 * pauses the hold so nothing saves under the person's fingers.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { IuiCard } from '@/components/orbit/poppins-stage/iui-card';
import { IuiEditableTitle } from '@/components/orbit/poppins-stage/iui-editable-title';
import { STAGE, stageBorder, stageMuted } from '@/constants/iui-stage';
import { intentPlaces } from '@/lib/poppins/ui-intent';
import { kindOfStop, resolveStopPlace, scheduleStops, tripSpan } from '@/lib/poppins/trip-parse';
import type { IuiPayload, IuiStop } from '@/lib/poppins/ui-scenes';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import { dateKey, formatTime12 } from '@/lib/poppins/when-parse';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

/** Six stops fit the stage (the design board); longer runs scroll inside the card. */
const MAX_VISIBLE_STOPS = 6;
/** One stop row plus its gap, in points. */
const STOP_ROW_PITCH = 62;

type Props = {
  payload: IuiPayload;
  accent: string;
  fillAccent?: string;
  hold: boolean;
  holdProgress: number;
  holding: boolean;
  frozen: boolean;
  groceryCount?: number;
};

const AMBER = '#F59E0B';

function isShop(stop: IuiStop) {
  const k = String(stop.kind ?? stop.category ?? '').toLowerCase();
  return k === 'shop' || k === 'grocery';
}

export function stopDetail(stop: IuiStop, groceryCount: number): { text: string; tone: 'shop' | 'ask' | 'plain' } {
  if (isShop(stop) && groceryCount > 0 && !stop.address) {
    return { text: `Your list comes along · ${groceryCount} item${groceryCount === 1 ? '' : 's'}`, tone: 'shop' };
  }
  if (stop.needsAddress && !stop.address) return { text: 'Which address? tap to set', tone: 'ask' };
  if (stop.note && stop.note.includes('saved place')) return { text: stop.note, tone: 'plain' };
  const place = stop.address?.trim() || '';
  const text = [place && place.toLowerCase() !== stop.label.toLowerCase() ? place : '', stop.note && !stop.note.includes('saved') ? stop.note : '']
    .filter(Boolean)
    .join(' · ');
  return { text, tone: 'plain' };
}

function titleFor(date: string | undefined): string {
  const d = date ? new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) : new Date();
  return `${d.toLocaleString('en', { weekday: 'long' })} run`;
}

export function IuiTripCard({
  payload,
  accent,
  fillAccent,
  hold,
  holdProgress,
  holding,
  frozen,
  groceryCount = 0,
}: Props) {
  const { c, isDark } = useOrbitColors();
  const muted = stageMuted(isDark);
  const fill = fillAccent ?? accent;
  const stops = payload.stops ?? [];
  const [reordering, setReordering] = useState(false);
  const [editing, setEditing] = useState<{ kind: 'address'; stopId: string } | { kind: 'add' } | null>(null);
  const [draft, setDraft] = useState('');

  const start = payload.time ?? stops[0]?.time ?? '16:00';
  const span = tripSpan(stops);
  const today = dateKey(new Date());
  const tomorrow = dateKey(new Date(Date.now() + 86_400_000));
  const isTomorrow = payload.date === tomorrow;

  const apply = (next: IuiStop[], extra: Partial<IuiPayload> = {}, text = 'trip edit') => {
    const rescheduled = scheduleStops(next, start);
    poppinsUiOrchestrator.chooseFromTap({ stops: rescheduled, ...extra }, text, 'trip-edit');
  };

  const openEditor = (next: typeof editing) => {
    setDraft('');
    setEditing(next);
    if (next) poppinsUiOrchestrator.freeze();
  };
  const closeEditor = () => {
    setEditing(null);
    setDraft('');
    poppinsUiOrchestrator.unfreeze();
  };

  const submit = () => {
    const value = draft.trim();
    if (!editing || !value) {
      closeEditor();
      return;
    }
    if (editing.kind === 'address') {
      apply(
        stops.map((s) => (s.id === editing.stopId ? { ...s, address: value, placeQuery: value, needsAddress: false } : s)),
        {},
        `address ${value}`
      );
    } else {
      const label = value[0]!.toUpperCase() + value.slice(1);
      const kind = kindOfStop(label);
      const place = resolveStopPlace(label, kind, intentPlaces(), stops);
      apply([...stops, { id: `stop-${Date.now()}`, label, kind, category: kind, ...place }], {}, `add ${label}`);
    }
    closeEditor();
  };

  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= stops.length) return;
    const next = [...stops];
    const [row] = next.splice(index, 1);
    next.splice(to, 0, row!);
    apply(next, {}, 'reorder');
  };
  const remove = (index: number) => {
    if (stops.length <= 1) return;
    apply(stops.filter((_, i) => i !== index), {}, 'remove stop');
  };

  const editorLabel =
    editing?.kind === 'address'
      ? `Address for ${stops.find((s) => s.id === editing.stopId)?.label ?? 'this stop'}`
      : 'Where to?';

  return (
    <IuiCard
      accent={accent}
      fillAccent={fill}
      kicker="Trip"
      hold={hold && !editing && stops.length > 0}
      holding={holding}
      holdProgress={holdProgress}
      frozen={frozen}
      leftFooter={holding ? 'Saving the whole run…' : 'One hold saves the whole run · an address can come later'}
      accessibilityLabel={`${payload.itineraryTitle ?? 'Trip'}, ${stops.length} stops`}>
      <View style={styles.titleRow}>
        <View style={{ flexShrink: 1 }}>
          <IuiEditableTitle
            title={payload.itineraryTitle ?? 'Trip'}
            style={[styles.title, { color: c.text }]}
            numberOfLines={1}
            toPatch={(name) => ({ itineraryTitle: name })}
          />
        </View>
        <Text style={[styles.count, { color: muted }]}>
          {stops.length} stop{stops.length === 1 ? '' : 's'}
          {span ? ` · ${span}` : ''}
        </Text>
      </View>

      {/* A long run scrolls inside the card so the stage stays bounded; six stops fit. */}
      <ScrollView
        style={stops.length > MAX_VISIBLE_STOPS ? { maxHeight: MAX_VISIBLE_STOPS * STOP_ROW_PITCH } : undefined}
        scrollEnabled={stops.length > MAX_VISIBLE_STOPS}
        nestedScrollEnabled
        showsVerticalScrollIndicator={stops.length > MAX_VISIBLE_STOPS}>
      <View style={styles.railWrap}>
        <View style={styles.rail}>
          <View style={[styles.railDot, { backgroundColor: fill }]} />
          <View style={[styles.railLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,28,42,0.14)' }]} />
          <View style={[styles.railDotEnd, { borderColor: fill }]} />
        </View>
        <View style={styles.stopList}>
          {stops.map((stop, index) => {
            const detail = stopDetail(stop, groceryCount);
            const tone =
              detail.tone === 'shop'
                ? { bg: `${STAGE.domain.chores}14`, border: `${STAGE.domain.chores}66`, text: STAGE.domain.chores }
                : detail.tone === 'ask'
                  ? { bg: `${AMBER}14`, border: `${AMBER}66`, text: AMBER }
                  : {
                      bg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,28,42,0.035)',
                      border: 'transparent',
                      text: muted,
                    };
            const [clock, mer] = formatTime12(stop.time).split(' ');
            return (
              <Pressable
                key={stop.id}
                disabled={reordering}
                onPress={() => {
                  if (detail.tone === 'ask' || !stop.address) openEditor({ kind: 'address', stopId: stop.id });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${formatTime12(stop.time)}, ${stop.label}. ${detail.text}`}
                style={[styles.stopRow, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                <View style={styles.clock}>
                  <Text style={[styles.clockText, { color: c.text }]}>{clock ?? ''}</Text>
                  {mer ? <Text style={[styles.clockMer, { color: c.text }]}>{mer}</Text> : null}
                </View>
                <View style={styles.stopBody}>
                  <Text style={[styles.stopLabel, { color: c.text }]} numberOfLines={1}>
                    {stop.label}
                  </Text>
                  {detail.text ? (
                    <Text style={[styles.stopDetail, { color: tone.text }]} numberOfLines={1}>
                      {detail.text}
                    </Text>
                  ) : null}
                </View>
                {reordering ? (
                  <View style={styles.moveBtns}>
                    <Pressable onPress={() => move(index, -1)} hitSlop={6} accessibilityLabel={`Move ${stop.label} up`}>
                      <MaterialIcons name="keyboard-arrow-up" size={22} color={index === 0 ? stageBorder(isDark) : c.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => move(index, 1)}
                      hitSlop={6}
                      accessibilityLabel={`Move ${stop.label} down`}>
                      <MaterialIcons
                        name="keyboard-arrow-down"
                        size={22}
                        color={index === stops.length - 1 ? stageBorder(isDark) : c.text}
                      />
                    </Pressable>
                    <Pressable onPress={() => remove(index)} hitSlop={6} accessibilityLabel={`Remove ${stop.label}`}>
                      <MaterialIcons name="close" size={18} color={muted} />
                    </Pressable>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
      </ScrollView>
      {stops.length > MAX_VISIBLE_STOPS ? (
        <Text style={[styles.moreHint, { color: muted }]}>
          Scroll for {stops.length - MAX_VISIBLE_STOPS} more
        </Text>
      ) : null}

      {editing ? (
        <View style={[styles.editor, { borderColor: stageBorder(isDark, true) }]}>
          <Text style={[styles.editorLabel, { color: muted }]}>{editorLabel}</Text>
          <View style={styles.editorRow}>
            <TextInput
              autoFocus
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              returnKeyType="done"
              placeholder={editing.kind === 'address' ? 'e.g. 4200 Rue Beaubien' : 'e.g. the bank'}
              placeholderTextColor={muted}
              style={[styles.input, { color: c.text, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,28,42,0.04)' }]}
            />
            <Pressable onPress={submit} style={[styles.editorBtn, { backgroundColor: fill }]} accessibilityRole="button">
              <Text style={[styles.editorBtnText, { color: STAGE.ink.onAccent }]}>{editing.kind === 'add' ? 'Add' : 'Set'}</Text>
            </Pressable>
            <Pressable onPress={closeEditor} hitSlop={8} accessibilityLabel="Cancel">
              <MaterialIcons name="close" size={20} color={muted} />
            </Pressable>
          </View>
          <Text style={[styles.editorHint, { color: muted }]}>Or just say it.</Text>
        </View>
      ) : null}

      <View style={styles.chips}>
        {[
          { id: 'reorder', label: reordering ? 'Done' : 'Reorder', on: reordering },
          { id: 'add', label: 'Add a stop', on: editing?.kind === 'add' },
          { id: 'tomorrow', label: 'Tomorrow', on: isTomorrow },
        ].map((chip) => (
          <Pressable
            key={chip.id}
            onPress={() => {
              if (chip.id === 'reorder') setReordering((on) => !on);
              if (chip.id === 'add') (editing?.kind === 'add' ? closeEditor() : openEditor({ kind: 'add' }));
              if (chip.id === 'tomorrow') {
                const date = isTomorrow ? today : tomorrow;
                poppinsUiOrchestrator.chooseFromTap(
                  { date, itineraryTitle: titleFor(date) },
                  isTomorrow ? 'today' : 'tomorrow',
                  'trip-chip'
                );
              }
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: chip.on }}
            style={[
              styles.chip,
              chip.on
                ? { backgroundColor: fill, borderColor: fill }
                : {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,28,42,0.04)',
                    borderColor: stageBorder(isDark),
                  },
            ]}>
            <Text style={[styles.chipText, { color: chip.on ? STAGE.ink.onAccent : c.text }]}>{chip.label}</Text>
          </Pressable>
        ))}
      </View>
      {!stops.length ? <Text style={[styles.empty, { color: muted }]}>Say the stops in order.</Text> : null}
    </IuiCard>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '600', flexShrink: 1 },
  count: { fontSize: 12 },
  railWrap: { flexDirection: 'row', gap: 8 },
  rail: { width: 14, alignItems: 'center', paddingTop: 12, paddingBottom: 12 },
  railDot: { width: 9, height: 9, borderRadius: 5 },
  railDotEnd: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, backgroundColor: 'transparent' },
  railLine: { flex: 1, width: 2, marginVertical: 4, borderRadius: 1 },
  stopList: { flex: 1, gap: 6 },
  moreHint: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  clock: { width: 48 },
  clockText: { fontSize: 12, fontWeight: '600' },
  clockMer: { fontSize: 11, fontWeight: '600' },
  stopBody: { flex: 1, gap: 2 },
  stopLabel: { fontSize: 15, fontWeight: '600' },
  stopDetail: { fontSize: 12 },
  moveBtns: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  editor: { marginTop: 10, marginHorizontal: 4, padding: 10, borderRadius: 12, borderWidth: 1, gap: 8 },
  editorLabel: { fontSize: 12, fontWeight: '600' },
  editorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  editorBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  editorBtnText: { fontSize: 14, fontWeight: '700' },
  editorHint: { fontSize: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4, paddingTop: 12 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: '600' },
  empty: { fontSize: 13, paddingHorizontal: 8, paddingTop: 4 },
});

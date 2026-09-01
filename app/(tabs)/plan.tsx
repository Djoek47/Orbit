import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { PoppinsCard } from '@/components/orbit/poppins-card';
import { PlanAddSheet } from '@/components/orbit/plan/plan-add-sheet';
import { PlanTripsPanel } from '@/components/orbit/plan-trips-panel';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { RefreshIconButton } from '@/components/orbit/refresh-icon-button';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { radius } from '@/constants/orbit-theme';
import {
  TYPE_CONFIG,
  addMonths,
  eventColor,
  eventTypeConfig,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  monthGridDays,
  subMonths,
  weekStripDays,
} from '@/lib/calendar/make-calendar';
import {
  buildPlanItems,
  groupPlanItemsByDate,
  planItemTypeLabel,
  type PlanItem,
} from '@/lib/calendar/plan-items';
import { pendingEventsForAdmin } from '@/lib/calendar/event-approval';
import { planAddOptionsForActor } from '@/lib/calendar/sidekick-plan-add';
import {
  usesFocusedCalendar,
  visibleEventsForMember,
  visibleTasksForMember,
} from '@/lib/calendar/plan-visibility';
import { homeworkSubjectMeta } from '@/lib/tasks/homework-subject';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import { isSharedDeviceAccount } from '@/lib/household/shared-device';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import { useHouseholdRefresh } from '@/lib/refresh/use-household-refresh';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

type PlanSubTab = 'calendar' | 'itinerary';
type CalView = 'month' | 'week';
type PlanLayerFilter = 'all' | 'homework' | 'events';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatEndTime(event: { endsAt?: string; time: string }): string | null {
  if (event.endsAt) {
    const d = new Date(event.endsAt);
    if (!Number.isNaN(d.getTime())) {
      return format(d, 'h:mm a');
    }
  }
  return null;
}

function planItemColor(item: PlanItem): string {
  if (item.kind === 'homework') return TYPE_CONFIG.homework.color;
  if (item.category) return eventColor(item.category);
  return TYPE_CONFIG.event.color;
}

function planItemConfig(item: PlanItem) {
  if (item.kind === 'homework') return TYPE_CONFIG.homework;
  if (item.category) return eventTypeConfig(item.category);
  return TYPE_CONFIG.event;
}

function locationShort(location: string): string | null {
  if (!location) return null;
  const parts = location.split(',');
  return parts[0]?.trim() || location;
}

export default function PlanScreen() {
  const chromePad = useTabChromePaddingTop();
  const { household, suggestPoppinsItinerary, currentMember, permissions, accentTheme, orbitPalette } = useOrbit();
  const { refreshing, onRefresh } = useHouseholdRefresh();
  const { c, glass, glassBorder } = useOrbitColors();
  const [buildingTrip, setBuildingTrip] = useState(false);
  const [subTab, setSubTab] = useState<PlanSubTab>('calendar');
  const [view, setView] = useState<CalView>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [layerFilter, setLayerFilter] = useState<PlanLayerFilter>('all');
  const [planAddOpen, setPlanAddOpen] = useState(false);

  const focusedCalendar = usesFocusedCalendar(currentMember?.role);

  const visibleEvents = useMemo(
    () => visibleEventsForMember(household.events, currentMember ?? null),
    [currentMember, household.events]
  );

  const visibleTasks = useMemo(
    () => visibleTasksForMember(household.tasks, currentMember ?? null),
    [currentMember, household.tasks]
  );

  const planItems = useMemo(() => {
    const items = buildPlanItems(visibleEvents, visibleTasks);
    if (layerFilter === 'homework') return items.filter((item) => item.kind === 'homework');
    if (layerFilter === 'events') return items.filter((item) => item.kind !== 'homework');
    return items;
  }, [layerFilter, visibleEvents, visibleTasks]);
  const itemsByDate = useMemo(() => groupPlanItemsByDate(planItems), [planItems]);

  const sharedKidMode =
    isSharedDeviceAccount(currentMember, household.members) || currentMember?.role === 'child';
  const caps = resolveMemberCapabilities(household);
  const isAdmin = permissions.canManageHousehold;
  const isSidekick = isSidekickRole(currentMember?.role);
  const planAddOptions = planAddOptionsForActor({ isAdmin, isSidekick, caps });
  const canOpenPlanAdd = planAddOptions.length > 0;
  const pendingEvents = useMemo(
    () => (isAdmin ? pendingEventsForAdmin(household.events) : []),
    [household.events, isAdmin]
  );
  const calendarDays = useMemo(() => monthGridDays(currentMonth), [currentMonth]);
  const weekDays = useMemo(() => weekStripDays(), []);
  const selectedKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedItems = itemsByDate[selectedKey] ?? [];
  const selectedEvents = visibleEvents.filter(
    (event) =>
      event.startsAt?.startsWith(selectedKey) ||
      (event.date.includes('Today') && isToday(selectedDate)) ||
      (event.date.includes('Tomorrow') &&
        isSameDay(selectedDate, new Date(Date.now() + 86400000)))
  );
  const missingGroceries = household.groceries.filter(
    (g) => g.status === 'Missing' || g.status === 'Low'
  ).length;
  const locationEvents = selectedEvents.filter((e) => Boolean(e.location?.trim()));
  const canBuildTrip =
    locationEvents.length >= 2 ||
    (locationEvents.length >= 1 && missingGroceries > 0) ||
    selectedItems.filter((item) => item.kind === 'homework' || item.category === 'School' || item.category === 'Activity').length >= 1;

  const handleBuildTrip = async () => {
    if (buildingTrip) return;
    setBuildingTrip(true);
    try {
      const created = await suggestPoppinsItinerary({
        date: selectedKey,
        mode: 'efficient',
        eventIds: selectedEvents.map((e) => e.id),
      });
      if (created) {
        router.push(`/itinerary/${created.id}` as never);
      }
    } finally {
      setBuildingTrip(false);
    }
  };

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: orbitPalette.background }]}
      contentContainerStyle={[styles.content, { paddingTop: chromePad }]}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={accentTheme.primary} />
      }>
      <View style={[styles.subNav, { backgroundColor: glass(0.06) }]}>
        {(
          [
            { id: 'calendar' as const, label: 'Calendar', icon: 'calendar-today' as const },
            { id: 'itinerary' as const, label: 'Itineraries', icon: 'map' as const },
          ] as const
        ).map((item) => {
          const active = subTab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setSubTab(item.id)}
              style={[styles.subChip, active && styles.subChipActive]}>
              <MaterialIcons name={item.icon} size={14} color={active ? '#A78BFA' : c.textMuted} />
              <Text
                style={[
                  styles.subLabel,
                  { color: c.textMuted },
                  active && styles.subLabelActive,
                ]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {subTab === 'calendar' ? (
        <>
          <View style={[styles.calHeader, { paddingRight: canOpenPlanAdd ? 0 : undefined }]}>
            <View style={{ flex: 1 }}>
              <PageEyebrow>
                {focusedCalendar ? 'My calendar' : 'Household Calendar'}
              </PageEyebrow>
              <Text style={[styles.h1, { color: c.text }]}>{format(currentMonth, 'MMMM yyyy')}</Text>
            </View>
            <View
              style={[
                styles.viewToggle,
                { backgroundColor: glass(0.06), borderColor: glassBorder(0.08) },
              ]}>
              {(['month', 'week'] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setView(v)}
                  style={[styles.viewChip, view === v && styles.viewChipActive]}>
                  <Text
                    style={[
                      styles.viewLabel,
                      { color: c.textSubtle },
                      view === v && styles.viewLabelActive,
                    ]}>
                    {v}
                  </Text>
                </Pressable>
              ))}
            </View>
            {canOpenPlanAdd ? (
              <Pressable
                style={[styles.plusBtn, { backgroundColor: `${accentTheme.primary}22`, borderColor: `${accentTheme.primary}44` }]}
                onPress={() => setPlanAddOpen(true)}>
                <MaterialIcons name="add" size={18} color={accentTheme.primary} />
              </Pressable>
            ) : null}
            <RefreshIconButton size={20} />
          </View>

          <View style={styles.legend}>
            {(['homework', 'event'] as const).map((key) => {
              const cfg = TYPE_CONFIG[key];
              return (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: cfg.color }]} />
                <Text style={[styles.legendLabel, { color: c.textSubtle }]}>{cfg.label}</Text>
              </View>
              );
            })}
          </View>

          {view === 'month' ? (
            <View>
              <View style={styles.monthNav}>
                <Pressable
                  style={[styles.navBtn, { backgroundColor: glass(0.06) }]}
                  onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <MaterialIcons name="chevron-left" size={16} color={c.textMuted} />
                </Pressable>
                <Text style={[styles.monthTitle, { color: c.text }]}>
                  {format(currentMonth, 'MMMM yyyy')}
                </Text>
                <Pressable
                  style={[styles.navBtn, { backgroundColor: glass(0.06) }]}
                  onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <MaterialIcons name="chevron-right" size={16} color={c.textMuted} />
                </Pressable>
              </View>
              <View style={styles.weekHead}>
                {WEEKDAYS.map((d) => (
                  <Text key={d} style={[styles.weekHeadCell, { color: c.textSubtle }]}>
                    {d}
                  </Text>
                ))}
              </View>
              <View style={styles.monthGrid}>
                {calendarDays.map((day) => {
                  const ds = format(day, 'yyyy-MM-dd');
                  const items = itemsByDate[ds] ?? [];
                  const selected = isSameDay(day, selectedDate);
                  const inMonth = isSameMonth(day, currentMonth);
                  const today = isToday(day);
                  const dots = [...new Set(items.slice(0, 4).map((item) => planItemColor(item)))].slice(0, 3);
                  return (
                    <Pressable key={ds} onPress={() => setSelectedDate(day)} style={styles.dayCell}>
                      <View
                        style={[
                          styles.dayCircle,
                          selected && { backgroundColor: accentTheme.primary },
                          !selected && today && { borderWidth: 1.5, borderColor: accentTheme.primary },
                        ]}>
                        <Text
                          style={[
                            styles.dayNum,
                            { color: c.textSoft },
                            !inMonth && { color: c.textFaint },
                            selected && { color: c.ink, fontWeight: '700' },
                            !selected && today && { color: accentTheme.primary, fontWeight: '700' },
                          ]}>
                          {format(day, 'd')}
                        </Text>
                      </View>
                      {inMonth && dots.length > 0 ? (
                        <View style={styles.dots}>
                          {dots.map((c, i) => (
                            <View key={i} style={[styles.dot, { backgroundColor: c }]} />
                          ))}
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.weekRow}>
              {weekDays.map((day) => {
                const ds = format(day, 'yyyy-MM-dd');
                const items = itemsByDate[ds] ?? [];
                const selected = isSameDay(day, selectedDate);
                const today = isToday(day);
                return (
                  <Pressable
                    key={ds}
                    onPress={() => setSelectedDate(day)}
                    style={[
                      styles.weekCell,
                      { backgroundColor: glass(0.04), borderColor: glassBorder(0.06) },
                    ]}>
                    <Text style={[styles.eyebrow, { color: c.textSubtle }]}>{format(day, 'EEE')}</Text>
                    <View
                      style={[
                        styles.weekDayCircle,
                        selected && { backgroundColor: accentTheme.primary },
                        !selected && today && { borderWidth: 1.5, borderColor: accentTheme.primary },
                      ]}>
                      <Text
                        style={[
                          styles.weekNum,
                          { color: c.text },
                          selected && { color: c.ink, fontWeight: '700' },
                          !selected && today && { color: accentTheme.primary },
                        ]}>
                        {format(day, 'd')}
                      </Text>
                    </View>
                    {items.length > 0 ? (
                      <View style={styles.dots}>
                        {[...new Set(items.slice(0, 3).map((item) => planItemColor(item)))].map((color, i) => (
                          <View key={i} style={[styles.dotLg, { backgroundColor: color }]} />
                        ))}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.selectedHead}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEE, MMMM d')}
            </Text>
            <Text style={[styles.eyebrow, { color: c.textSubtle }]}>
              {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'}
            </Text>
          </View>

          {canBuildTrip ? (
            <PoppinsCard
              kind="recommendation"
              message={
                missingGroceries > 0 && locationEvents.length >= 1
                  ? `A trip today could cover ${locationEvents.length === 1 ? 'this stop' : `these ${locationEvents.length} stops`} and pick up ${missingGroceries} missing item${missingGroceries === 1 ? '' : 's'} on the way.`
                  : `${locationEvents.length >= 2 ? 'These stops line up' : 'This looks like a good day'} for one efficient trip.`
              }
              actions={[
                { label: buildingTrip ? 'Building…' : 'Build trip', onPress: () => void handleBuildTrip() },
              ]}
            />
          ) : null}

          {pendingEvents.length > 0 ? (
            <Pressable
              onPress={() => router.push(`/event/${pendingEvents[0]!.id}` as never)}
              style={[styles.pendingBanner, { backgroundColor: `${accentTheme.primary}14`, borderColor: `${accentTheme.primary}33` }]}>
              <MaterialIcons name="hourglass-top" size={16} color={accentTheme.primary} />
              <Text style={[styles.pendingBannerText, { color: c.text }]}>
                {pendingEvents.length === 1
                  ? '1 event waiting for your approval'
                  : `${pendingEvents.length} events waiting for approval`}
              </Text>
            </Pressable>
          ) : null}

          {selectedItems.length === 0 ? (
            <View
              style={[
                styles.emptyDay,
                { backgroundColor: glass(0.03), borderColor: glassBorder(0.06) },
              ]}>
              <Text style={{ fontSize: 32 }}>✨</Text>
              <Text style={[styles.eyebrow, { color: c.textSubtle }]}>
                Nothing scheduled — a free day!
              </Text>
            </View>
          ) : (
            selectedItems.map((item) => {
              const cfg = planItemConfig(item);
              const color = cfg.color;
              const linkedEvent =
                item.kind !== 'homework'
                  ? visibleEvents.find((event) => event.id === item.id)
                  : null;
              const endTime = linkedEvent ? formatEndTime(linkedEvent) : null;
              const shortLoc = linkedEvent?.location ? locationShort(linkedEvent.location) : null;
              return (
                <Pressable key={`${item.kind}-${item.id}`} onPress={() => router.push(item.href as never)}>
                  <View style={[styles.eventCard, { backgroundColor: cfg.bg, borderColor: `${color}33` }]}>
                    <View style={[styles.eventBar, { backgroundColor: color }]} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.eventBadgeRow}>
                        <View style={[styles.typePill, { backgroundColor: `${color}22` }]}>
                          <Text style={[styles.typePillText, { color }]}>
                            {cfg.emoji} {planItemTypeLabel(item)}
                          </Text>
                        </View>
                        {item.homeworkSubject ? (
                          <View style={[styles.typePill, { backgroundColor: `${homeworkSubjectMeta(item.homeworkSubject).color}22` }]}>
                            <Text style={[styles.typePillText, { color: homeworkSubjectMeta(item.homeworkSubject).color }]}>
                              {homeworkSubjectMeta(item.homeworkSubject).emoji} {item.homeworkSubject}
                            </Text>
                          </View>
                        ) : null}
                        {item.approvalStatus === 'pending' ? (
                          <View style={[styles.typePill, { backgroundColor: 'rgba(251,191,36,0.18)' }]}>
                            <Text style={[styles.typePillText, { color: '#FBBF24' }]}>Pending</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.eventTitle, { color: c.text }]}>{item.title}</Text>
                      <View style={styles.eventMetaRow}>
                        {item.time ? (
                          <View style={styles.eventMetaItem}>
                            <MaterialIcons name="schedule" size={11} color={c.textSubtle} />
                            <Text style={[styles.meta, { color: c.textMuted }]}>
                              {item.time}
                              {endTime ? ` – ${endTime}` : ''}
                            </Text>
                          </View>
                        ) : null}
                        {shortLoc ? (
                          <View style={styles.eventMetaItem}>
                            <MaterialIcons name="place" size={11} color={color} />
                            <Text style={[styles.meta, { color, fontWeight: '500' }]}>{shortLoc}</Text>
                          </View>
                        ) : null}
                        {item.responsible ? (
                          <View style={styles.eventMetaItem}>
                            <MaterialIcons name="person" size={11} color={c.textSubtle} />
                            <Text style={[styles.meta, { color: c.textMuted }]}>{item.responsible}</Text>
                          </View>
                        ) : null}
                      </View>
                      {linkedEvent?.location ? (
                        <View style={styles.eventLocationBox}>
                          <MaterialIcons name="place" size={11} color={c.textSubtle} />
                          <Text style={[styles.eventLocationText, { color: c.textSubtle }]}>
                            {linkedEvent.location}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}

          <View
            style={[
              styles.next7Card,
              { backgroundColor: glass(0.05), borderColor: glassBorder(0.08) },
            ]}>
            <Text style={[styles.next7Title, { color: c.text }]}>Next 7 Days</Text>
            <View style={{ gap: 8 }}>
              {weekDays.slice(0, 5).map((day) => {
                const ds = format(day, 'yyyy-MM-dd');
                const items = itemsByDate[ds] ?? [];
                if (items.length === 0) return null;
                return (
                  <Pressable
                    key={ds}
                    style={styles.next7Row}
                    onPress={() => {
                      setSelectedDate(day);
                      setView('month');
                    }}>
                    <View style={styles.next7DayCol}>
                      <Text
                        style={[
                          styles.next7DayLabel,
                          { color: c.textMuted },
                          isToday(day) && { color: '#38BDF8', fontWeight: '700' },
                        ]}>
                        {isToday(day) ? 'Today' : format(day, 'EEE')}
                      </Text>
                    </View>
                    <View style={styles.next7Pills}>
                      {items.slice(0, 3).map((item) => {
                        const pillColor = planItemColor(item);
                        return (
                          <View
                            key={`${item.kind}-${item.id}`}
                            style={[styles.next7Pill, { backgroundColor: `${pillColor}15`, borderColor: `${pillColor}22` }]}>
                            <View style={[styles.next7Dot, { backgroundColor: pillColor }]} />
                            <Text style={[styles.next7PillText, { color: pillColor }]} numberOfLines={1}>
                              {item.title.length > 18 ? `${item.title.slice(0, 17)}…` : item.title}
                            </Text>
                          </View>
                        );
                      })}
                      {items.length > 3 ? (
                        <Text style={[styles.next7More, { color: c.textSubtle }]}>
                          +{items.length - 3} more
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.layerFilterRow, { backgroundColor: glass(0.06), borderColor: glassBorder(0.08) }]}>
            {(
              [
                { id: 'all' as const, label: 'All' },
                { id: 'homework' as const, label: 'Homework' },
                { id: 'events' as const, label: 'Events' },
              ] as const
            ).map((chip) => {
              const active = layerFilter === chip.id;
              return (
                <Pressable
                  key={chip.id}
                  onPress={() => setLayerFilter(chip.id)}
                  style={[styles.layerChip, active && styles.layerChipActive]}>
                  <Text style={[styles.layerChipText, { color: active ? '#A78BFA' : c.textMuted }]}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <PlanTripsPanel selectedDateKey={selectedKey} />
      )}
    </ScrollView>
    <PlanAddSheet visible={planAddOpen} onDismiss={() => setPlanAddOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 16, paddingBottom: 24, paddingHorizontal: 16, paddingTop: 16 },
  calHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  dayCell: {
    alignItems: 'center',
    gap: 2,
    paddingBottom: 6,
    paddingTop: 4,
    width: `${100 / 7}%`,
  },
  dayCircle: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  dayNum: { fontSize: 14 },
  dot: { borderRadius: 2, height: 4, width: 4 },
  dotLg: { borderRadius: 3, height: 6, width: 6 },
  dots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  emptyDay: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 32,
  },
  eventBadgeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  eventBar: { alignSelf: 'stretch', borderRadius: 999, width: 4 },
  eventCard: {
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
    padding: 16,
  },
  eventLocationBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  eventLocationText: { flex: 1, fontSize: 12 },
  eventMetaItem: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  eventMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  eventTitle: { fontSize: 14, fontWeight: '600' },
  eyebrow: { fontSize: 12 },
  h1: { fontSize: 24, fontWeight: '700', lineHeight: 29 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendLabel: { fontSize: 12 },
  meta: { fontSize: 12 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthNav: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: { fontSize: 14, fontWeight: '600' },
  navBtn: {
    alignItems: 'center',
    borderRadius: 12,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  next7Card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  next7DayCol: { flexShrink: 0, width: 48 },
  next7DayLabel: { fontSize: 12, textAlign: 'right' },
  next7Dot: { borderRadius: 3, height: 6, width: 6 },
  next7More: { fontSize: 12 },
  next7Pill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    maxWidth: 120,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  next7Pills: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  next7PillText: { fontSize: 10, maxWidth: 80 },
  next7Row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  next7Title: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  plusBtn: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  pendingBanner: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pendingBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: { fontSize: 14, fontWeight: '600' },
  selectedHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subChip: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  subChipActive: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderColor: 'rgba(167,139,250,0.3)',
  },
  subLabel: { fontSize: 14 },
  subLabelActive: { color: '#A78BFA', fontWeight: '600' },
  subNav: {
    borderRadius: 16,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  typePill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  typePillText: { fontSize: 10, fontWeight: '700' },
  viewChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  viewChipActive: { backgroundColor: 'rgba(56,189,248,0.2)' },
  viewLabel: { fontSize: 12, textTransform: 'capitalize' },
  viewLabelActive: { color: '#38BDF8', fontWeight: '600' },
  viewToggle: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 2,
  },
  layerFilterRow: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
    padding: 4,
  },
  layerChip: { borderRadius: 8, flex: 1, paddingVertical: 8 },
  layerChipActive: { backgroundColor: 'rgba(167,139,250,0.18)' },
  layerChipText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  weekCell: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    paddingVertical: 12,
  },
  weekDayCircle: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  weekHead: { flexDirection: 'row', marginBottom: 4 },
  weekHeadCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  weekNum: { fontSize: 16, fontWeight: '700' },
  weekRow: { flexDirection: 'row', gap: 6 },
});


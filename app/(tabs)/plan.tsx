import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PlanTripsPanel } from '@/components/orbit/plan-trips-panel';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import {
  TYPE_CONFIG,
  addMonths,
  eventColor,
  eventTypeConfig,
  format,
  groupEventsByDate,
  isSameDay,
  isSameMonth,
  isToday,
  monthGridDays,
  subMonths,
  weekStripDays,
} from '@/lib/calendar/make-calendar';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import { isSharedDeviceAccount } from '@/lib/household/shared-device';
import { useOrbit } from '@/store/orbit-store';

type PlanSubTab = 'calendar' | 'itinerary';
type CalView = 'month' | 'week';

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

function locationShort(location: string): string | null {
  if (!location) return null;
  const parts = location.split(',');
  return parts[0]?.trim() || location;
}

export default function PlanScreen() {
  const chromePad = useTabChromePaddingTop(8);
  const { household, suggestNovaItinerary, currentMember, permissions, accentTheme } = useOrbit();
  const [buildingTrip, setBuildingTrip] = useState(false);
  const [subTab, setSubTab] = useState<PlanSubTab>('calendar');
  const [view, setView] = useState<CalView>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const sharedKidMode =
    isSharedDeviceAccount(currentMember, household.members) || currentMember?.role === 'child';
  const caps = resolveMemberCapabilities(household);
  const canCreateEvent = permissions.canManageHousehold || caps.allowCalendarCreate;

  const visibleEvents = useMemo(() => {
    if (!sharedKidMode || !currentMember) return household.events;
    const name = currentMember.name;
    return household.events.filter(
      (event) => event.responsible === name || event.responsible.includes(name),
    );
  }, [sharedKidMode, currentMember, household.events]);

  const eventsByDate = useMemo(() => groupEventsByDate(visibleEvents), [visibleEvents]);
  const calendarDays = useMemo(() => monthGridDays(currentMonth), [currentMonth]);
  const weekDays = useMemo(() => weekStripDays(), []);
  const selectedKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedEvents = eventsByDate[selectedKey] ?? [];
  const missingGroceries = household.groceries.filter(
    (g) => g.status === 'Missing' || g.status === 'Low'
  ).length;
  const locationEvents = selectedEvents.filter((e) => Boolean(e.location?.trim()));
  const canBuildTrip =
    locationEvents.length >= 2 ||
    (locationEvents.length >= 1 && missingGroceries > 0) ||
    selectedEvents.filter((e) => e.category === 'School' || e.category === 'Activity').length >= 1;

  const handleBuildTrip = async () => {
    setBuildingTrip(true);
    try {
      const created = await suggestNovaItinerary({
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: chromePad }]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      <View style={styles.subNav}>
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
              <MaterialIcons name={item.icon} size={14} color={active ? '#A78BFA' : '#4B6080'} />
              <Text style={[styles.subLabel, active && styles.subLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>


      {subTab === 'calendar' ? (
        <>
          <View style={[styles.calHeader, { paddingRight: canCreateEvent ? 0 : undefined }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>
                {sharedKidMode ? 'My calendar' : 'Household Calendar'}
              </Text>
              <Text style={styles.h1}>{format(currentMonth, 'MMMM yyyy')}</Text>
            </View>
            <View style={styles.viewToggle}>
              {(['month', 'week'] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setView(v)}
                  style={[styles.viewChip, view === v && styles.viewChipActive]}>
                  <Text style={[styles.viewLabel, view === v && styles.viewLabelActive]}>{v}</Text>
                </Pressable>
              ))}
            </View>
            {canCreateEvent ? (
              <Pressable style={styles.plusBtn} onPress={() => router.push('/create-event' as never)}>
                <MaterialIcons name="add" size={16} color="#38BDF8" />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.legend}>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: cfg.color }]} />
                <Text style={styles.legendLabel}>{cfg.label}</Text>
              </View>
            ))}
          </View>

          {view === 'month' ? (
            <View>
              <View style={styles.monthNav}>
                <Pressable style={styles.navBtn} onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <MaterialIcons name="chevron-left" size={16} color="#7C9CC0" />
                </Pressable>
                <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
                <Pressable style={styles.navBtn} onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <MaterialIcons name="chevron-right" size={16} color="#7C9CC0" />
                </Pressable>
              </View>
              <View style={styles.weekHead}>
                {WEEKDAYS.map((d) => (
                  <Text key={d} style={styles.weekHeadCell}>
                    {d}
                  </Text>
                ))}
              </View>
              <View style={styles.monthGrid}>
                {calendarDays.map((day) => {
                  const ds = format(day, 'yyyy-MM-dd');
                  const events = eventsByDate[ds] ?? [];
                  const selected = isSameDay(day, selectedDate);
                  const inMonth = isSameMonth(day, currentMonth);
                  const today = isToday(day);
                  const dots = [...new Set(events.slice(0, 4).map((e) => eventColor(e.category)))].slice(0, 3);
                  return (
                    <Pressable
                      key={ds}
                      onPress={() => setSelectedDate(day)}
                      style={[
                        styles.dayCell,
                        today && styles.dayToday,
                        selected && styles.daySelected,
                      ]}>
                      <Text
                        style={[
                          styles.dayNum,
                          !inMonth && styles.dayOut,
                          (selected || today) && styles.dayNumActive,
                        ]}>
                        {format(day, 'd')}
                      </Text>
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
                const events = eventsByDate[ds] ?? [];
                const selected = isSameDay(day, selectedDate);
                const today = isToday(day);
                return (
                  <Pressable
                    key={ds}
                    onPress={() => setSelectedDate(day)}
                    style={[styles.weekCell, today && styles.dayToday, selected && styles.daySelected]}>
                    <Text style={styles.eyebrow}>{format(day, 'EEE')}</Text>
                    <Text style={[styles.weekNum, (selected || today) && styles.dayNumActive]}>
                      {format(day, 'd')}
                    </Text>
                    {events.length > 0 ? (
                      <View style={styles.dots}>
                        {[...new Set(events.slice(0, 3).map((e) => eventColor(e.category)))].map((c, i) => (
                          <View key={i} style={[styles.dotLg, { backgroundColor: c }]} />
                        ))}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.selectedHead}>
            <Text style={styles.sectionTitle}>
              {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEE, MMMM d')}
            </Text>
            <Text style={styles.eyebrow}>
              {selectedEvents.length} {selectedEvents.length === 1 ? 'item' : 'items'}
            </Text>
          </View>

          {canBuildTrip ? (
            <Pressable
              onPress={() => void handleBuildTrip()}
              disabled={buildingTrip}
              style={[styles.buildTripRow, { borderColor: `${accentTheme.primary}44` }]}>
              <MaterialIcons name="route" size={18} color={accentTheme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.buildTripTitle, { color: accentTheme.primary }]}>
                  {buildingTrip ? 'Building trip…' : 'Build trip for this day'}
                </Text>
                <Text style={styles.buildTripSub}>Nova orders stops · grocery only if it fits</Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={accentTheme.primary} />
            </Pressable>
          ) : null}

          {selectedEvents.length === 0 ? (
            <View style={styles.emptyDay}>
              <Text style={{ fontSize: 32 }}>✨</Text>
              <Text style={styles.eyebrow}>Nothing scheduled — a free day!</Text>
            </View>
          ) : (
            selectedEvents.map((ev) => {
              const cfg = eventTypeConfig(ev.category);
              const color = cfg.color;
              const endTime = formatEndTime(ev);
              const shortLoc = locationShort(ev.location);
              return (
                <Pressable key={ev.id} onPress={() => router.push(`/event/${ev.id}` as never)}>
                  <View style={[styles.eventCard, { backgroundColor: cfg.bg, borderColor: `${color}33` }]}>
                    <View style={[styles.eventBar, { backgroundColor: color }]} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.eventBadgeRow}>
                        <View style={[styles.typePill, { backgroundColor: `${color}22` }]}>
                          <Text style={[styles.typePillText, { color }]}>
                            {cfg.emoji} {cfg.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.eventTitle}>{ev.title}</Text>
                      <View style={styles.eventMetaRow}>
                        {ev.time ? (
                          <View style={styles.eventMetaItem}>
                            <MaterialIcons name="schedule" size={11} color="#4B6080" />
                            <Text style={styles.meta}>
                              {ev.time}
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
                        {ev.responsible ? (
                          <View style={styles.eventMetaItem}>
                            <MaterialIcons name="person" size={11} color="#4B6080" />
                            <Text style={styles.meta}>{ev.responsible}</Text>
                          </View>
                        ) : null}
                      </View>
                      {ev.location ? (
                        <View style={styles.eventLocationBox}>
                          <MaterialIcons name="place" size={11} color="#4B6080" />
                          <Text style={styles.eventLocationText}>{ev.location}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}

          <View style={styles.next7Card}>
            <Text style={styles.next7Title}>Next 7 Days</Text>
            <View style={{ gap: 8 }}>
              {weekDays.slice(0, 5).map((day) => {
                const ds = format(day, 'yyyy-MM-dd');
                const events = eventsByDate[ds] ?? [];
                if (events.length === 0) return null;
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
                          isToday(day) && { color: '#38BDF8', fontWeight: '700' },
                        ]}>
                        {isToday(day) ? 'Today' : format(day, 'EEE')}
                      </Text>
                    </View>
                    <View style={styles.next7Pills}>
                      {events.slice(0, 3).map((ev) => {
                        const c = eventColor(ev.category);
                        return (
                          <View
                            key={ev.id}
                            style={[styles.next7Pill, { backgroundColor: `${c}15`, borderColor: `${c}22` }]}>
                            <View style={[styles.next7Dot, { backgroundColor: c }]} />
                            <Text style={[styles.next7PillText, { color: c }]} numberOfLines={1}>
                              {ev.title.length > 18 ? `${ev.title.slice(0, 17)}…` : ev.title}
                            </Text>
                          </View>
                        );
                      })}
                      {events.length > 3 ? (
                        <Text style={styles.next7More}>+{events.length - 3} more</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      ) : (
        <PlanTripsPanel selectedDateKey={selectedKey} />
      )}
    </ScrollView>
  );
}



const styles = StyleSheet.create({
  container: { backgroundColor: '#070D1C', flex: 1 },
  content: { gap: 16, paddingBottom: 24, paddingHorizontal: 16, paddingTop: 16 },
  calHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  dayCell: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 16,
    borderWidth: 1,
    paddingBottom: 6,
    paddingTop: 4,
    width: `${100 / 7}%`,
  },
  dayNum: { color: '#C8D8F0', fontSize: 14 },
  dayNumActive: { color: '#38BDF8', fontWeight: '700' },
  dayOut: { color: '#2A3A54' },
  daySelected: {
    backgroundColor: 'rgba(56,189,248,0.2)',
    borderColor: 'rgba(56,189,248,0.4)',
  },
  dayToday: { backgroundColor: 'rgba(56,189,248,0.08)' },
  dot: { borderRadius: 2, height: 4, width: 4 },
  dotLg: { borderRadius: 3, height: 6, width: 6 },
  dots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  emptyDay: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
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
  eventLocationText: { color: '#4B6080', flex: 1, fontSize: 12 },
  eventMetaItem: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  eventMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  eventTitle: { color: '#EEF2FF', fontSize: 14, fontWeight: '600' },
  eyebrow: { color: '#4B6080', fontSize: 12 },
  h1: { color: '#EEF2FF', fontSize: 24, fontWeight: '700', lineHeight: 29 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendLabel: { color: '#4B6080', fontSize: 12 },
  meta: { color: '#7C9CC0', fontSize: 12 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthNav: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: { color: '#EEF2FF', fontSize: 14, fontWeight: '600' },
  navBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  next7Card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  next7DayCol: { flexShrink: 0, width: 48 },
  next7DayLabel: { color: '#7C9CC0', fontSize: 12, textAlign: 'right' },
  next7Dot: { borderRadius: 3, height: 6, width: 6 },
  next7More: { color: '#4B6080', fontSize: 12 },
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
  next7Title: { color: '#EEF2FF', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  plusBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderColor: 'rgba(56,189,248,0.2)',
    borderRadius: 12,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  sectionTitle: { color: '#EEF2FF', fontSize: 14, fontWeight: '600' },
  selectedHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buildTripRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  buildTripTitle: { fontSize: 14, fontWeight: '700' },
  buildTripSub: { color: '#4B6080', fontSize: 12, marginTop: 2 },
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
  subLabel: { color: '#4B6080', fontSize: 14 },
  subLabelActive: { color: '#A78BFA', fontWeight: '600' },
  subNav: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  typePill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  typePillText: { fontSize: 10, fontWeight: '700' },
  viewChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  viewChipActive: { backgroundColor: 'rgba(56,189,248,0.2)' },
  viewLabel: { color: '#4B6080', fontSize: 12, textTransform: 'capitalize' },
  viewLabelActive: { color: '#38BDF8', fontWeight: '600' },
  viewToggle: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 2,
  },
  weekCell: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    paddingVertical: 12,
  },
  weekHead: { flexDirection: 'row', marginBottom: 4 },
  weekHeadCell: {
    color: '#4B6080',
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  weekNum: { color: '#EEF2FF', fontSize: 16, fontWeight: '700' },
  weekRow: { flexDirection: 'row', gap: 6 },
});


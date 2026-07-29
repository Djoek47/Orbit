import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from 'react-native';

import { NovaOrb } from '@/components/orbit/nova-orb';
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
import type { Itinerary, ItineraryStop, ItineraryStopKind } from '@/types/orbit';
import { useOrbit } from '@/store/orbit-store';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type PlanSubTab = 'calendar' | 'itinerary';
type CalView = 'month' | 'week';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const TRIP_COLORS = ['#38BDF8', '#FB923C', '#34D399'] as const;

const STOP_EMOJI: Record<ItineraryStopKind, string> = {
  school: '🏫',
  work: '💼',
  grocery: '🛒',
  pickup: '⚽',
  custom: '📍',
};

const STOP_CATEGORY: Record<ItineraryStopKind, string> = {
  school: 'School',
  work: 'Work',
  grocery: 'Grocery',
  pickup: 'Pickup',
  custom: 'Errand',
};

function formatDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  if (isToday(d)) return 'Today';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(d, tomorrow)) return 'Tomorrow';
  return format(d, 'EEEE');
}

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

function totalTimeFromStops(stops: ItineraryStop[]): string {
  const mins = stops.reduce((n, s) => n + (s.etaMinutes ?? 15), 0);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

function estimateDistance(stops: ItineraryStop[]): string {
  const mi = (stops.length * 2.1 + 1.5).toFixed(1);
  return `${mi} mi`;
}

function estimateSavedTime(stops: ItineraryStop[]): string {
  const mins = Math.max(15, Math.round(stops.length * 14));
  return `${mins} min`;
}

function estimateTimeSavedAll(trips: Itinerary[]): string {
  const mins = trips.reduce((n, t) => n + Math.max(15, t.stops.length * 14), 0);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

function driveMinutesBetween(stops: ItineraryStop[], index: number): number {
  if (index === 0) return 0;
  const prev = stops[index - 1]?.etaMinutes ?? 10;
  const curr = stops[index]?.etaMinutes ?? 10;
  return Math.max(2, Math.min(12, Math.round((curr - prev) * 0.25) || 3));
}

function novaReasonForTrip(trip: Itinerary): string {
  if (trip.summary && trip.summary.length > 20) {
    return trip.summary;
  }
  const names = [...trip.stops]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => s.label)
    .join(', ');
  return `Bundled ${trip.stops.length} stops (${names}) into one efficient route. Combining saves time vs. separate trips.`;
}

function RouteVisualization({
  trip,
  color,
  active,
}: {
  trip: Itinerary;
  color: string;
  active: boolean;
}) {
  const stops = [...trip.stops].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <View style={styles.routeViz}>
      <View
        style={[
          StyleSheet.absoluteFillObject,
          styles.routeVizBg,
          { backgroundColor: `${color}08` },
        ]}
      />
      {stops.map((stop, i) => {
        const isLast = i === stops.length - 1;
        const driveMin = driveMinutesBetween(stops, i);
        return (
          <View key={stop.id} style={styles.routeRow}>
            <View style={styles.routeTimeline}>
              <View
                style={[
                  styles.routeNode,
                  {
                    backgroundColor: active ? `${color}33` : 'rgba(255,255,255,0.06)',
                    borderColor: active ? `${color}66` : 'rgba(255,255,255,0.1)',
                  },
                  active && i === 0 && { shadowColor: color, shadowOpacity: 0.27, shadowRadius: 8 },
                ]}>
                <Text style={styles.routeEmoji}>{STOP_EMOJI[stop.kind]}</Text>
              </View>
              {!isLast ? (
                <View style={styles.routeConnector}>
                  {[0, 1, 2].map((d) => (
                    <View
                      key={`u-${d}`}
                      style={[
                        styles.routeDot,
                        { backgroundColor: active ? color : 'rgba(255,255,255,0.12)' },
                      ]}
                    />
                  ))}
                  <View style={styles.driveBadge}>
                    <Text style={styles.driveBadgeText}>{driveMin}m drive</Text>
                  </View>
                  {[0, 1, 2].map((d) => (
                    <View
                      key={`l-${d}`}
                      style={[
                        styles.routeDot,
                        { backgroundColor: active ? color : 'rgba(255,255,255,0.12)' },
                      ]}
                    />
                  ))}
                </View>
              ) : null}
            </View>
            <View style={styles.routeDetail}>
              <View style={styles.routeDetailHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeStopName}>{stop.label}</Text>
                  <View style={styles.routeAddrRow}>
                    <MaterialIcons name="place" size={10} color="#4B6080" />
                    <Text style={styles.routeAddr}>{stop.address || stop.placeQuery || 'No address'}</Text>
                  </View>
                </View>
                <View style={styles.routeMetaCol}>
                  <View style={[styles.routeCatPill, { backgroundColor: `${color}18` }]}>
                    <Text style={[styles.routeCatText, { color }]}>{STOP_CATEGORY[stop.kind]}</Text>
                  </View>
                  <View style={styles.routeTimeRow}>
                    <MaterialIcons name="schedule" size={10} color="#4B6080" />
                    <Text style={styles.routeTimeText}>~{stop.etaMinutes ?? 15}m</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function TripCard({
  trip,
  index,
  onStartTrip,
}: {
  trip: Itinerary;
  index: number;
  onStartTrip: (trip: Itinerary) => void;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const [activated, setActivated] = useState(false);
  const color = TRIP_COLORS[index % TRIP_COLORS.length];
  const stops = [...trip.stops].sort((a, b) => a.sortOrder - b.sortOrder);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  const handleStart = () => {
    setActivated(true);
    onStartTrip(trip);
  };

  const handleCopy = async () => {
    const lines = stops.map((s, i) => `${i + 1}. ${s.label} — ${s.address || s.placeQuery || ''}`);
    await Clipboard.setStringAsync(`${trip.title}\n${lines.join('\n')}`);
  };

  return (
    <View
      style={[
        styles.tripCard,
        {
          backgroundColor: expanded ? `${color}12` : 'rgba(255,255,255,0.05)',
          borderColor: expanded ? `${color}28` : 'rgba(255,255,255,0.08)',
        },
      ]}>
      <Pressable onPress={toggleExpanded} style={styles.tripCardHead}>
        <View style={styles.tripHeadRow}>
          <View style={[styles.routeIcon, { backgroundColor: `${color}22`, borderColor: `${color}33` }]}>
            <MaterialIcons name="route" size={18} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tripTitle}>{trip.title}</Text>
            <Text style={[styles.tripDayLabel, { color }]}>{formatDayLabel(trip.date)}</Text>
          </View>
          <MaterialIcons
            name="chevron-right"
            size={16}
            color="#4B6080"
            style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
          />
        </View>
        <View style={styles.tripStatsRow}>
          {[
            { icon: 'schedule' as const, val: totalTimeFromStops(stops), label: 'Total', accent: false },
            { icon: 'navigation' as const, val: estimateDistance(stops), label: 'Distance', accent: false },
            {
              icon: 'bolt' as const,
              val: `Save ${estimateSavedTime(stops)}`,
              label: 'vs. separate',
              accent: true,
            },
          ].map((s) => (
            <View key={s.label} style={styles.tripStat}>
              <MaterialIcons name={s.icon} size={12} color={s.accent ? '#34D399' : '#4B6080'} />
              <View>
                <Text style={[styles.tripStatVal, s.accent && { color: '#34D399' }]}>{s.val}</Text>
                <Text style={styles.tripStatLabel}>{s.label}</Text>
              </View>
            </View>
          ))}
          <View style={styles.stopCountPill}>
            <Text style={styles.stopCountText}>{stops.length} stops</Text>
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.tripExpanded}>
          <View style={styles.novaReason}>
            <MaterialIcons name="auto-awesome" size={13} color="#06B6D4" />
            <Text style={styles.heroBody}>
              <Text style={{ color: '#06B6D4', fontWeight: '700' }}>Nova: </Text>
              {novaReasonForTrip(trip)}
            </Text>
          </View>
          <RouteVisualization trip={trip} color={color} active={!activated} />
          <View style={styles.tripCtaRow}>
            <Pressable onPress={handleStart} style={{ flex: 1 }}>
              {activated ? (
                <View style={styles.tripActivatedBtn}>
                  <Text style={{ fontSize: 16 }}>✅</Text>
                  <Text style={styles.tripActivatedText}>Trip Activated</Text>
                </View>
              ) : (
                <LinearGradient
                  colors={[color, `${color}CC`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tripStartBtn}>
                  <MaterialIcons name="navigation" size={16} color="#070D1C" />
                  <Text style={styles.tripStartText}>Start Trip in Maps</Text>
                </LinearGradient>
              )}
            </Pressable>
            <Pressable onPress={handleCopy} style={styles.clipboardBtn}>
              <Text style={{ fontSize: 16 }}>📋</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function PlanScreen() {
  const { household, openStopInMaps } = useOrbit();
  const [subTab, setSubTab] = useState<PlanSubTab>('calendar');
  const [view, setView] = useState<CalView>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const eventsByDate = useMemo(() => groupEventsByDate(household.events), [household.events]);
  const calendarDays = useMemo(() => monthGridDays(currentMonth), [currentMonth]);
  const weekDays = useMemo(() => weekStripDays(), []);
  const selectedKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedEvents = eventsByDate[selectedKey] ?? [];
  const itineraries = household.itineraries ?? [];
  const activeTrips = itineraries.filter((t) => t.status !== 'completed');
  const completedTrips = itineraries.filter((t) => t.status === 'completed');
  const totalStopsBundled = activeTrips.reduce((n, t) => n + t.stops.length, 0);

  const handleStartTrip = async (trip: Itinerary) => {
    const ordered = [...trip.stops].sort((a, b) => a.sortOrder - b.sortOrder);
    const activeStop = ordered.find((s) => s.status === 'active') ?? ordered[0];
    if (activeStop) {
      await openStopInMaps(trip.id, activeStop.id);
    }
    router.push(`/itinerary/${trip.id}` as never);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
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
          <View style={styles.calHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Household Calendar</Text>
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
            <Pressable style={styles.plusBtn} onPress={() => router.push('/create-event' as never)}>
              <MaterialIcons name="add" size={16} color="#38BDF8" />
            </Pressable>
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
        <>
          <View style={styles.itinHeader}>
            <Text style={styles.eyebrow}>Nova Smart Trips</Text>
            <Text style={styles.h1}>Itineraries</Text>
          </View>

          <LinearGradient
            colors={[
              'rgba(6,182,212,0.15)',
              'rgba(56,189,248,0.08)',
              'rgba(129,140,248,0.08)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.novaHero}>
            <View style={styles.novaHeroGlow} />
            <View style={styles.novaHeroRow}>
              <NovaOrb size={56} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.novaLive}>
                  <View style={styles.liveDot} />
                  <Text style={styles.novaLiveText}>NOVA SMART ROUTING</Text>
                </View>
                <Text style={styles.heroBodyLg}>
                  I&apos;ve analysed your upcoming tasks and errands. I&apos;ve bundled{' '}
                  <Text style={{ color: '#38BDF8', fontWeight: '700' }}>
                    {activeTrips.length || 3} optimised trip{activeTrips.length === 1 ? '' : 's'}
                  </Text>{' '}
                  that save you{' '}
                  <Text style={{ color: '#34D399', fontWeight: '700' }}>
                    {estimateTimeSavedAll(activeTrips)}
                  </Text>{' '}
                  this week.
                </Text>
              </View>
            </View>
            <View style={styles.statRow}>
              {[
                { val: String(activeTrips.length || 3), label: 'Smart trips', color: '#38BDF8' },
                { val: estimateTimeSavedAll(activeTrips), label: 'Time saved', color: '#34D399' },
                { val: String(totalStopsBundled || 10), label: 'Stops bundled', color: '#A78BFA' },
              ].map((s) => (
                <View key={s.label} style={styles.stat}>
                  <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          <View style={{ gap: 12 }}>
            {activeTrips.map((trip, index) => (
              <TripCard key={trip.id} trip={trip} index={index} onStartTrip={handleStartTrip} />
            ))}
          </View>

          <View style={styles.completedArchive}>
            <Text style={styles.completedTitle}>Completed Trips</Text>
            {completedTrips.length === 0 ? (
              <Text style={styles.completedEmpty}>No completed trips yet</Text>
            ) : (
              completedTrips.map((t, i) => (
                <View
                  key={t.id}
                  style={[styles.completedRow, i > 0 && styles.completedRowBorder]}>
                  <Text style={{ fontSize: 16 }}>✅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.completedTitleStrike}>{t.title}</Text>
                    <Text style={styles.completedMeta}>
                      {formatDayLabel(t.date)} · {t.stops.length} stops
                    </Text>
                  </View>
                  <Text style={styles.completedSaved}>Saved {estimateSavedTime(t.stops)}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#070D1C', flex: 1 },
  content: { gap: 16, paddingBottom: 24, paddingHorizontal: 16, paddingTop: 44 },
  calHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  clipboardBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  completedArchive: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  completedEmpty: { color: '#4B6080', fontSize: 12, marginTop: 4 },
  completedMeta: { color: '#2A3A54', fontSize: 12 },
  completedRow: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 10 },
  completedRowBorder: { borderTopColor: 'rgba(255,255,255,0.04)', borderTopWidth: 1 },
  completedSaved: { color: '#2A3A54', fontSize: 12 },
  completedTitle: { color: '#7C9CC0', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  completedTitleStrike: {
    color: '#4B6080',
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
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
  driveBadge: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  driveBadgeText: { color: '#4B6080', fontSize: 9, fontWeight: '600' },
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
  heroBody: { color: '#C8D8F0', flex: 1, fontSize: 12, lineHeight: 18 },
  heroBodyLg: { color: '#C8D8F0', fontSize: 14, lineHeight: 21 },
  itinHeader: { paddingTop: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendLabel: { color: '#4B6080', fontSize: 12 },
  liveDot: { backgroundColor: '#34D399', borderRadius: 3, height: 6, width: 6 },
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
  novaHero: {
    borderColor: 'rgba(56,189,248,0.2)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    overflow: 'hidden',
    padding: 16,
  },
  novaHeroGlow: {
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderRadius: 80,
    height: 160,
    position: 'absolute',
    right: 0,
    top: 0,
    transform: [{ translateX: 48 }, { translateY: -48 }],
    width: 160,
  },
  novaHeroRow: { flexDirection: 'row', gap: 16 },
  novaLive: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  novaLiveText: { color: '#34D399', fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  novaReason: {
    backgroundColor: 'rgba(6,182,212,0.08)',
    borderColor: 'rgba(6,182,212,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    padding: 12,
  },
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
  routeAddr: { color: '#4B6080', fontSize: 12 },
  routeAddrRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 2 },
  routeCatPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  routeCatText: { fontSize: 10, fontWeight: '700' },
  routeConnector: { alignItems: 'center', flex: 1, gap: 2, paddingVertical: 4 },
  routeDetail: { flex: 1, paddingBottom: 12 },
  routeDetailHead: { flexDirection: 'row', gap: 8 },
  routeDot: { borderRadius: 2, height: 5, width: 2 },
  routeEmoji: { fontSize: 18 },
  routeIcon: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  routeMetaCol: { alignItems: 'flex-end', gap: 4 },
  routeNode: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    height: 36,
    justifyContent: 'center',
    width: 36,
    zIndex: 1,
  },
  routeRow: { flexDirection: 'row', gap: 16 },
  routeStopName: { color: '#EEF2FF', fontSize: 14, fontWeight: '600' },
  routeTimeRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  routeTimeText: { color: '#7C9CC0', fontSize: 12 },
  routeTimeline: { alignItems: 'center', width: 36 },
  routeViz: { borderRadius: 16, overflow: 'hidden', position: 'relative' },
  routeVizBg: { borderRadius: 16 },
  sectionTitle: { color: '#EEF2FF', fontSize: 14, fontWeight: '600' },
  selectedHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  statLabel: { color: '#4B6080', fontSize: 9, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 12 },
  statVal: { fontSize: 16, fontWeight: '800', lineHeight: 16 },
  stopCountPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: 999,
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  stopCountText: { color: '#34D399', fontSize: 10, fontWeight: '700' },
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
  tripActivatedBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(52,211,153,0.15)',
    borderColor: 'rgba(52,211,153,0.3)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  tripActivatedText: { color: '#34D399', fontSize: 14, fontWeight: '700' },
  tripCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  tripCardHead: { paddingBottom: 12, paddingHorizontal: 16, paddingTop: 16 },
  tripCtaRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tripDayLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  tripExpanded: { paddingBottom: 16, paddingHorizontal: 16 },
  tripHeadRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  tripStartBtn: {
    alignItems: 'center',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  tripStartText: { color: '#070D1C', fontSize: 14, fontWeight: '700' },
  tripStat: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  tripStatLabel: { color: '#4B6080', fontSize: 9 },
  tripStatsRow: { flexDirection: 'row', gap: 16, marginTop: 12 },
  tripStatVal: { color: '#EEF2FF', fontSize: 12, fontWeight: '700', lineHeight: 12 },
  tripTitle: { color: '#EEF2FF', fontSize: 14, fontWeight: '700' },
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

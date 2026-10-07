import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { Moji } from '@/components/orbit/moji/moji';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { PlaceMap } from '@/components/orbit/place-map';
import { NearbySuggestionsRow } from '@/components/orbit/places/nearby-suggestions-row';
import { MapsAppMark } from '@/components/orbit/maps-app-mark';
import { SettingsModalChrome } from '@/components/orbit/settings/modal-chrome';
import { radius, space } from '@/constants/orbit-theme';
import { openDirections } from '@/lib/maps/directions';
import { formatUsCaAddress } from '@/lib/places/address-format';
import { searchAddresses, type AddressSuggestion } from '@/lib/places/address-search';
import { buildPickupSummary } from '@/lib/places/pickup-summary';
import { placeUsedForSubtitle } from '@/lib/places/place-used-for';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { PreferredMapsApp } from '@/lib/theme/appearance-prefs';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import {
  findNearbyStores,
  getCurrentCoords,
  getLocationPermission,
} from '@/lib/places/nearby-stores';
import { createLocalId } from '@/repositories/repository-utils';
import { useOrbit } from '@/store/orbit-store';
import type { PreferredStore, SavedPlace, SavedPlaceKind } from '@/types/orbit';

const HOME_ID = 'place-home';
const WORK_ID = 'place-work';

type KindMeta = {
  id: SavedPlaceKind;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  /** Filter chip group on Places list. */
  filter?: 'shops' | 'school' | 'activities';
};

const KIND_OPTIONS: KindMeta[] = [
  { id: 'home', label: 'Home', icon: 'home', color: '#38BDF8' },
  { id: 'work', label: 'Work', icon: 'work', color: '#7C9CC0' },
  { id: 'school', label: 'School', icon: 'school', color: '#A78BFA', filter: 'school' },
  { id: 'shop', label: 'Shops', icon: 'storefront', color: '#34D399', filter: 'shops' },
  { id: 'clothing', label: 'Clothing', icon: 'checkroom', color: '#F472B6', filter: 'shops' },
  { id: 'practice', label: 'Activities', icon: 'sports', color: '#F59E0B', filter: 'activities' },
  { id: 'family', label: 'Family', icon: 'favorite', color: '#EC4899' },
  { id: 'cafe', label: 'Café', icon: 'local-cafe', color: '#FB923C', filter: 'shops' },
  { id: 'pickup', label: 'Pickup', icon: 'local-shipping', color: '#EC4899', filter: 'activities' },
  { id: 'custom', label: 'Other', icon: 'place', color: '#7C9CC0' },
];

const MAPS_OPTS: { value: PreferredMapsApp; label: string }[] = [
  { value: 'auto', label: 'AutoNav' },
  { value: 'apple', label: 'Plans' },
  { value: 'google', label: 'Google' },
  { value: 'waze', label: 'Waze' },
];

type FilterId = 'all' | 'shops' | 'school' | 'activities';

const EMOJI_PRESETS = ['🏠', '💼', '🏫', '🛒', '⚽', '☕', '📦', '🎯', '👵', '📍', '🏋️', '🍕'];

type EditorState = {
  id: string;
  name: string;
  kind: SavedPlaceKind;
  address: string;
  emoji: string;
  isFavorite: boolean;
  pickupItemNames: string[];
  lat?: number;
  lng?: number;
  isNew: boolean;
};

function kindMeta(kind: SavedPlaceKind) {
  return KIND_OPTIONS.find((k) => k.id === kind) ?? KIND_OPTIONS[KIND_OPTIONS.length - 1]!;
}

function defaultEmoji(kind: SavedPlaceKind): string {
  switch (kind) {
    case 'home':
      return '🏠';
    case 'work':
      return '💼';
    case 'school':
      return '🏫';
    case 'shop':
      return '🛒';
    case 'clothing':
      return '👕';
    case 'practice':
      return '⚽';
    case 'family':
      return '👵';
    case 'cafe':
      return '☕';
    case 'pickup':
      return '📦';
    default:
      return '📍';
  }
}

function formatCoordsLabel(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

async function reverseGeocodeLabel(lat: number, lng: number): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const place = results[0];
    if (!place) return formatCoordsLabel(lat, lng);
    const formatted = formatUsCaAddress({
      countryCode: place.isoCountryCode,
      houseNumber: place.streetNumber,
      road: place.street,
      city: place.city,
      region: place.region,
      postcode: place.postalCode,
    });
    if (formatted) return formatted;
    const line = [place.streetNumber, place.street].filter(Boolean).join(' ').trim();
    const cityBit = [place.city, place.region].filter(Boolean).join(', ');
    return [line || place.name, cityBit].filter(Boolean).join(', ') || formatCoordsLabel(lat, lng);
  } catch {
    return formatCoordsLabel(lat, lng);
  }
}

function placeToEditor(place: SavedPlace, isNew = false): EditorState {
  const meta = kindMeta(place.kind);
  return {
    id: place.id,
    name: place.name,
    kind: place.kind,
    address: place.address,
    emoji: place.emoji ?? defaultEmoji(meta.id),
    isFavorite: place.isFavorite ?? false,
    pickupItemNames: [...(place.pickupItemNames ?? [])],
    lat: place.lat,
    lng: place.lng,
    isNew,
  };
}

export default function PlacesScreen() {
  const insets = useSafeAreaInsets();
  const {
    accentTheme,
    household,
    removeSavedPlace,
    suggestPoppinsItinerary,
    upsertSavedPlace,
    preferredMapsApp,
    updatePreferredMapsApp,
  } = useOrbit();
  const { glass, c, isDark, glassBorder } = useOrbitColors();
  const places = useMemo(() => household.savedPlaces ?? [], [household.savedPlaces]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [kindFilter, setKindFilter] = useState<FilterId>('all');
  const [locating, setLocating] = useState(false);
  const [itemInput, setItemInput] = useState('');
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [nearby, setNearby] = useState<PreferredStore[]>([]);
  const [nearbyBusy, setNearbyBusy] = useState(false);

  const home = places.find((p) => p.kind === 'home') ?? places.find((p) => p.id === HOME_ID);
  const work = places.find((p) => p.kind === 'work') ?? places.find((p) => p.id === WORK_ID);
  const extras = useMemo(
    () => places.filter((p) => p.id !== home?.id && p.id !== work?.id),
    [places, home?.id, work?.id]
  );

  const filteredExtras = useMemo(() => {
    if (kindFilter === 'all') return extras;
    return extras.filter((p) => kindMeta(p.kind).filter === kindFilter);
  }, [extras, kindFilter]);

  const filterChips = useMemo(() => {
    const counts: Record<FilterId, number> = {
      all: places.length,
      shops: 0,
      school: 0,
      activities: 0,
    };
    for (const p of places) {
      const f = kindMeta(p.kind).filter;
      if (f) counts[f] += 1;
    }
    const chips: { id: FilterId; label: string }[] = [
      { id: 'all', label: `All ${counts.all}` },
    ];
    if (counts.shops > 0) chips.push({ id: 'shops', label: 'Shops' });
    if (counts.school > 0) chips.push({ id: 'school', label: 'School' });
    if (counts.activities > 0) chips.push({ id: 'activities', label: 'Activities' });
    return chips;
  }, [places]);

  const summary = useMemo(
    () => buildPickupSummary(places, household.groceries, household.preferredStoreId),
    [places, household.groceries, household.preferredStoreId]
  );

  const itineraryPins = useMemo(
    () =>
      (household.itineraries ?? []).flatMap((trip) =>
        (trip.stops ?? [])
          .filter((stop) => typeof stop.lat === 'number' && typeof stop.lng === 'number')
          .map((stop) => ({
            id: `stop-${trip.id}-${stop.id}`,
            title: stop.label,
            lat: stop.lat as number,
            lng: stop.lng as number,
            color: '#A78BFA',
          }))
      ),
    [household.itineraries]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLocating(true);
      const status = await getLocationPermission();
      const coords = await getCurrentCoords({ requestIfNeeded: status !== 'denied' });
      if (cancelled) return;
      setLocating(false);
      if (!coords) {
        setPermissionDenied(true);
        return;
      }
      setGps(coords);
      setPermissionDenied(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const origin =
      home?.lat != null && home?.lng != null ? { lat: home.lat, lng: home.lng } : gps;
    if (!origin) return;
    let cancelled = false;
    setNearbyBusy(true);
    void findNearbyStores(origin)
      .then((result) => {
        if (!cancelled) setNearby(result.stores);
      })
      .finally(() => {
        if (!cancelled) setNearbyBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gps?.lat, gps?.lng, home?.lat, home?.lng]);

  useEffect(() => {
    if (!editor) {
      setSuggestions([]);
      return;
    }
    const q = editor.address.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      void searchAddresses(q)
        .then((rows) => {
          if (!cancelled) setSuggestions(rows);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [editor?.address, editor]);

  const openSlot = (kind: 'home' | 'work', existing?: SavedPlace) => {
    setEditor(
      placeToEditor(
        existing ?? {
          id: kind === 'home' ? HOME_ID : WORK_ID,
          name: kind === 'home' ? 'Home' : 'Work',
          kind,
          address: '',
          emoji: defaultEmoji(kind),
          isFavorite: true,
          pickupItemNames: [],
        },
        !existing
      )
    );
    setItemInput('');
  };

  const openExtra = (place?: SavedPlace) => {
    const kind = place?.kind ?? 'custom';
    setEditor(
      placeToEditor(
        place ?? {
          id: createLocalId('place'),
          name: '',
          kind,
          address: '',
          emoji: defaultEmoji(kind),
          isFavorite: false,
          pickupItemNames: [],
        },
        !place
      )
    );
    setItemInput('');
  };

  const fillFromCurrentLocation = async () => {
    if (!editor) return;
    setLocating(true);
    try {
      const coords = await getCurrentCoords();
      if (!coords) {
        orbitAlert('Location needed', 'Allow location access to fill this place from where you are.');
        return;
      }
      const address = await reverseGeocodeLabel(coords.lat, coords.lng);
      setEditor({ ...editor, address, lat: coords.lat, lng: coords.lng });
    } finally {
      setLocating(false);
    }
  };

  const addEditorItem = () => {
    if (!editor) return;
    const v = itemInput.trim();
    if (!v) return;
    if (editor.pickupItemNames.some((i) => i.toLowerCase() === v.toLowerCase())) {
      setItemInput('');
      return;
    }
    setEditor({ ...editor, pickupItemNames: [...editor.pickupItemNames, v] });
    setItemInput('');
  };

  const saveEditor = () => {
    if (!editor) return;
    const address = editor.address.trim();
    const name =
      editor.name.trim() ||
      (editor.kind === 'home' ? 'Home' : editor.kind === 'work' ? 'Work' : 'Place');
    if (!address) {
      orbitAlert('Add an address', 'Enter a street address or use your current location.');
      return;
    }
    upsertSavedPlace({
      id: editor.id,
      name,
      kind: editor.kind,
      address,
      placeQuery: address,
      lat: editor.lat,
      lng: editor.lng,
      emoji: editor.emoji,
      isFavorite: editor.isFavorite,
      pickupItemNames: editor.pickupItemNames,
    });
    setEditor(null);
  };

  const clearOrDelete = (place: SavedPlace | undefined, kind: 'home' | 'work' | 'extra') => {
    if (!place) return;
    const label = kind === 'extra' ? 'Remove this place?' : `Clear ${place.name}?`;
    orbitAlert(label, 'Trips and near-shop alerts will stop using it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: kind === 'extra' ? 'Remove' : 'Clear',
        style: 'destructive',
        onPress: () => removeSavedPlace(place.id),
      },
    ]);
  };

  const handlePickupCta = async () => {
    if (summary.groups.some((g) => g.groceryLinked)) {
      router.push('/shopping-mode' as never);
      return;
    }
    setSuggestBusy(true);
    try {
      const created = await suggestPoppinsItinerary();
      if (created) router.push(`/itinerary/${created.id}` as never);
      else router.push('/create-itinerary' as never);
    } finally {
      setSuggestBusy(false);
    }
  };

  const cat = editor ? kindMeta(editor.kind) : null;

  if (!editor) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SettingsModalChrome
          backLabel="Settings"
          title="Places"
          purpose={'So a trip can say “work” and mean it'}
          right={
            <Pressable
              onPress={() => openExtra()}
              accessibilityRole="button"
              accessibilityLabel="Add place"
              hitSlop={8}
              style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="add" size={22} color={accentTheme.primary} />
            </Pressable>
          }>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
            showsVerticalScrollIndicator={false}>
            <View style={styles.pinRow}>
              <PinTile
                title="Home"
                address={home?.address}
                color="#38BDF8"
                icon="home"
                onPress={() => openSlot('home', home)}
              />
              <PinTile
                title="Work"
                address={work?.address}
                color="#7C9CC0"
                icon="work"
                onPress={() => openSlot('work', work)}
              />
            </View>

            {/* The same "near home" shortcut the Plan tab offers. */}
            <NearbySuggestionsRow accent={accentTheme.primary} />

            {places.length === 0 ? (
              <View
                style={[
                  styles.emptyBlock,
                  { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
                ]}>
                {[
                  { title: 'Work', sub: '1250 René-Lévesque' },
                  { title: 'School', sub: 'Pickup 15:30' },
                  { title: "Grandma's", sub: 'Family' },
                ].map((ex) => (
                  <View key={ex.title} style={[styles.emptyRow, { opacity: 0.45 }]}>
                    <Text style={[styles.rowTitle, { color: c.text }]}>{ex.title}</Text>
                    <Text style={[styles.rowSubtitle, { color: c.textMuted }]}>{ex.sub}</Text>
                  </View>
                ))}
                <Text style={[styles.emptyHint, { color: c.textMuted }]}>
                  Poppins can save these as you talk: say &apos;work is on René-Lévesque&apos;.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.filterRow}>
                  {filterChips.map((chip) => {
                    const active = kindFilter === chip.id;
                    return (
                      <Pressable
                        key={chip.id}
                        onPress={() => setKindFilter(chip.id)}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: active ? accentTheme.primary : glassFill(isDark),
                            borderColor: active ? accentTheme.primary : glassBorder(0.1),
                          },
                        ]}>
                        <Text
                          style={[
                            styles.filterLabel,
                            { color: active ? (isDark ? '#041018' : '#fff') : c.textMuted },
                          ]}>
                          {chip.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {filteredExtras.map((place) => {
                  const meta = kindMeta(place.kind);
                  const used = placeUsedForSubtitle(place, household);
                  return (
                    <PlaceRow
                      key={place.id}
                      icon={meta.icon}
                      title={place.name}
                      subtitle={used.text}
                      needsAddress={used.needsAddress}
                      accent={meta.color}
                      onPress={() => openExtra(place)}
                      onSet={() => openExtra(place)}
                    />
                  );
                })}
              </>
            )}

            <Text style={[styles.mapsLabel, { color: c.textSubtle }]}>DIRECTIONS OPEN IN</Text>
            <View style={styles.mapsRow}>
              {MAPS_OPTS.map((opt) => {
                const active = preferredMapsApp === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => updatePreferredMapsApp(opt.value)}
                    style={[
                      styles.mapsTile,
                      {
                        backgroundColor: glassFill(isDark),
                        borderColor: active ? accentTheme.primary : glassBorder(0.1),
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}>
                    <MapsAppMark app={opt.value} size={28} />
                    <Text style={[styles.mapsTileLabel, { color: c.text }]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {summary.total > 0 ? (
              <Pressable
                onPress={() => void handlePickupCta()}
                disabled={suggestBusy}
                style={[
                  styles.summaryCta,
                  { borderColor: `${accentTheme.primary}44`, backgroundColor: glass(0.04) },
                ]}>
                <MaterialIcons name="route" size={16} color={accentTheme.primary} />
                <Text style={[styles.summaryCtaText, { color: accentTheme.primary }]}>
                  {suggestBusy
                    ? 'Asking Poppins…'
                    : summary.groups.some((g) => g.groceryLinked)
                      ? 'Open shopping list'
                      : 'Plan a pickup trip'}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </SettingsModalChrome>
      </>
    );
  }

  const accent = accentTheme.primary;
  const kindChoices = KIND_OPTIONS.filter((k) =>
    editor.kind === 'home' || editor.kind === 'work'
      ? k.id === editor.kind
      : k.id !== 'home' && k.id !== 'work'
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.editorTopBar}>
        <Pressable
          onPress={() => setEditor(null)}
          style={styles.editorBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to Places">
          <MaterialIcons name="chevron-left" size={22} color={accent} />
          <Text style={[styles.editorBackLabel, { color: accent }]}>Places</Text>
        </Pressable>
        <Pressable
          onPress={() => setEditor({ ...editor, isFavorite: !editor.isFavorite })}
          style={[
            styles.starBtn,
            {
              backgroundColor: editor.isFavorite ? 'rgba(245,158,11,0.18)' : glass(0.06),
              borderColor: editor.isFavorite ? 'rgba(245,158,11,0.45)' : glassBorder(0.1),
            },
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={editor.isFavorite ? 'Unfavorite place' : 'Favorite place'}
          accessibilityState={{ selected: editor.isFavorite }}>
          <MaterialIcons
            name={editor.isFavorite ? 'star' : 'star-border'}
            size={20}
            color={editor.isFavorite ? '#F59E0B' : c.textMuted}
          />
        </Pressable>
      </View>

      {cat ? (
        <KeyboardScreen
          offset={8}
          contentContainerStyle={styles.editorContent}
          footer={
            <View style={styles.editorFooter}>
              <OrbitButton onPress={saveEditor}>Save place</OrbitButton>
            </View>
          }>
          <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.editorHeader}>
            <Text style={[styles.editorEyebrow, { color: accent }]}>Places</Text>
            <Text style={[styles.editorTitle, { color: c.text }]}>
              {editor.isNew ? 'Add place' : 'Edit place'}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(40).duration(260)} style={styles.editorSection}>
            <Text style={[styles.editorLabel, { color: accent }]}>Type</Text>
            <View style={styles.kindWrap}>
              {kindChoices.map((k) => {
                const active = editor.kind === k.id;
                return (
                  <Pressable
                    key={k.id}
                    onPress={() =>
                      setEditor({
                        ...editor,
                        kind: k.id,
                        emoji:
                          editor.emoji === defaultEmoji(cat.id)
                            ? defaultEmoji(k.id)
                            : editor.emoji,
                      })
                    }
                    style={[
                      styles.kindChip,
                      {
                        backgroundColor: active ? `${k.color}28` : glass(0.05),
                        borderColor: active ? k.color : glassBorder(0.1),
                      },
                    ]}>
                    <MaterialIcons
                      name={k.icon}
                      size={14}
                      color={active ? k.color : c.textMuted}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        color: active ? k.color : c.textSoft,
                        fontWeight: active ? '800' : '600',
                      }}>
                      {k.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(70).duration(260)} style={styles.editorSection}>
            <Text style={[styles.editorLabel, { color: accent }]}>Icon</Text>
            <View style={styles.emojiRow}>
              {EMOJI_PRESETS.map((e) => {
                const active = editor.emoji === e;
                return (
                  <Pressable
                    key={e}
                    onPress={() => setEditor({ ...editor, emoji: e })}
                    style={[
                      styles.emojiChip,
                      {
                        backgroundColor: active ? `${cat.color}28` : glass(0.05),
                        borderColor: active ? cat.color : glassBorder(0.1),
                      },
                    ]}>
                    <Moji emoji={e} size={22} />
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {editor.kind !== 'home' && editor.kind !== 'work' ? (
            <Animated.View entering={FadeInDown.delay(90).duration(260)}>
              <LinearGradient
                colors={[`${accent}30`, `${accent}0A`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.fieldCard, { borderColor: `${accent}44` }]}>
                <Text style={[styles.editorLabel, { color: accent }]}>Name</Text>
                <TextInput
                  value={editor.name}
                  onChangeText={(name) => setEditor({ ...editor, name })}
                  placeholder="School, Grandma…"
                  placeholderTextColor={c.textFaint}
                  style={[
                    styles.input,
                    {
                      backgroundColor: glassFill(isDark),
                      borderColor: glassBorder(0.1),
                      color: c.text,
                    },
                  ]}
                />
              </LinearGradient>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(110).duration(260)}>
            <LinearGradient
              colors={[`${cat.color}32`, `${cat.color}0C`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.fieldCard, { borderColor: `${cat.color}55` }]}>
              <Text style={[styles.editorLabel, { color: cat.color }]}>Address</Text>
              <TextInput
                value={editor.address}
                onChangeText={(address) =>
                  setEditor({ ...editor, address, lat: undefined, lng: undefined })
                }
                placeholder="Street, city"
                placeholderTextColor={c.textFaint}
                style={[
                  styles.input,
                  styles.inputTall,
                  {
                    backgroundColor: glassFill(isDark),
                    borderColor: glassBorder(0.1),
                    color: c.text,
                  },
                ]}
                multiline
              />
              {searching ? (
                <Text style={[styles.searchHint, { color: c.textMuted }]}>Searching…</Text>
              ) : null}
              {suggestions.length > 0 ? (
                <View style={styles.suggestList}>
                  {suggestions.map((row) => (
                    <Pressable
                      key={row.id}
                      onPress={() => {
                        setEditor({
                          ...editor,
                          address: row.address,
                          lat: row.lat,
                          lng: row.lng,
                          name: editor.name || row.label,
                        });
                        setSuggestions([]);
                      }}
                      style={[
                        styles.suggestRow,
                        { borderColor: glassBorder(0.1), backgroundColor: glass(0.06) },
                      ]}>
                      <MaterialIcons name="place" size={16} color={accent} />
                      <Text style={[styles.suggestText, { color: c.text }]} numberOfLines={2}>
                        {row.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </LinearGradient>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(130).duration(260)} style={styles.mapBlock}>
            <PlaceMap
              height={168}
              locating={locating && editor.lat == null}
              permissionDenied={permissionDenied}
              userLocation={gps}
              emptyHint="Type an address or use your location."
              markers={
                editor.lat != null && editor.lng != null
                  ? [
                      {
                        id: editor.id,
                        title: editor.name || 'Place',
                        lat: editor.lat,
                        lng: editor.lng,
                      },
                    ]
                  : []
              }
            />
            <View style={styles.mapActions}>
              <Pressable
                onPress={() => void fillFromCurrentLocation()}
                style={[
                  styles.mapAction,
                  { borderColor: `${accent}55`, backgroundColor: glass(0.05) },
                ]}
                disabled={locating}>
                <MaterialIcons name="my-location" size={16} color={accent} />
                <Text style={[styles.mapActionText, { color: accent }]}>
                  {locating ? 'Finding…' : 'My location'}
                </Text>
              </Pressable>
              {editor.lat != null && editor.lng != null ? (
                <Pressable
                  onPress={() =>
                    void openDirections(
                      undefined,
                      { address: editor.address, lat: editor.lat, lng: editor.lng },
                      preferredMapsApp
                    )
                  }
                  style={[
                    styles.mapAction,
                    { borderColor: `${accent}55`, backgroundColor: glass(0.05) },
                  ]}>
                  <MaterialIcons name="directions" size={16} color={accent} />
                  <Text style={[styles.mapActionText, { color: accent }]}>Directions</Text>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(260)} style={styles.editorSection}>
            <Text style={[styles.editorLabel, { color: accent }]}>Pickup</Text>
            <View style={styles.addItemRow}>
              <TextInput
                value={itemInput}
                onChangeText={setItemInput}
                placeholder="Milk, bread…"
                placeholderTextColor={c.textFaint}
                onSubmitEditing={addEditorItem}
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: glass(0.06),
                    borderColor: glassBorder(0.1),
                    color: c.text,
                  },
                ]}
                returnKeyType="done"
              />
              <Pressable
                onPress={addEditorItem}
                style={[
                  styles.addItemBtn,
                  { backgroundColor: `${cat.color}22`, borderColor: `${cat.color}40` },
                ]}>
                <MaterialIcons name="add" size={18} color={cat.color} />
              </Pressable>
            </View>
            {editor.pickupItemNames.length > 0 ? (
              <View style={styles.pickupWrap}>
                {editor.pickupItemNames.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() =>
                      setEditor({
                        ...editor,
                        pickupItemNames: editor.pickupItemNames.filter((i) => i !== item),
                      })
                    }
                    style={[
                      styles.pickupChip,
                      { backgroundColor: `${cat.color}18`, borderColor: `${cat.color}30` },
                    ]}>
                    <Text style={{ fontSize: 12, color: cat.color, fontWeight: '600' }}>{item}</Text>
                    <MaterialIcons name="close" size={12} color={cat.color} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Animated.View>
        </KeyboardScreen>
      ) : null}
    </View>
  );
}

function PinTile({
  title,
  address,
  color,
  icon,
  onPress,
}: {
  title: string;
  address?: string;
  color: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
}) {
  const { c, isDark, glassBorder } = useOrbitColors();
  const empty = !address?.trim();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pinTile,
        {
          backgroundColor: glassFill(isDark),
          borderColor: empty ? '#F59E0B88' : glassBorder(0.1),
        },
      ]}>
      <View style={[styles.pinIcon, { backgroundColor: `${color}22` }]}>
        <MaterialIcons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.pinTitle, { color: c.text }]}>{title}</Text>
      <Text style={[styles.pinSub, { color: empty ? '#F59E0B' : c.textMuted }]} numberOfLines={2}>
        {empty ? 'Add' : address}
      </Text>
    </Pressable>
  );
}

function PlaceRow({
  icon,
  title,
  subtitle,
  needsAddress,
  accent,
  onPress,
  onSet,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  needsAddress?: boolean;
  accent: string;
  onPress: () => void;
  onSet?: () => void;
}) {
  const { c, isDark, glassBorder } = useOrbitColors();
  return (
    <Pressable
      style={[
        styles.row,
        {
          backgroundColor: glassFill(isDark),
          borderColor: needsAddress ? '#F59E0B88' : glassBorder(0.1),
        },
      ]}
      onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: `${accent}22`, borderColor: `${accent}40` }]}>
        <MaterialIcons name={icon} size={18} color={accent} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: c.text }]}>{title}</Text>
        <Text
          style={[styles.rowSubtitle, { color: needsAddress ? '#F59E0B' : c.textMuted }]}
          numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {needsAddress ? (
        <Pressable
          onPress={onSet}
          style={styles.setBtn}
          accessibilityRole="button"
          accessibilityLabel={`Set address for ${title}`}>
          <Text style={styles.setLabel}>Set</Text>
        </Pressable>
      ) : (
        <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
      )}
    </Pressable>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 12, paddingTop: 8 },
  editorTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  editorBack: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    minHeight: 44,
  },
  editorBackLabel: { fontSize: 16, fontWeight: '700' },
  starBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  editorContent: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  editorHeader: { gap: 2, marginBottom: 2 },
  editorEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  editorTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  editorSection: { gap: 10 },
  editorLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  editorFooter: { marginTop: 8 },
  fieldCard: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  searchHint: { fontSize: 12, fontWeight: '600' },
  suggestList: { gap: 6 },
  suggestRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestText: { flex: 1, fontSize: 14, fontWeight: '600' },
  mapBlock: { gap: 10 },
  mapActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mapAction: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mapActionText: { fontSize: 13, fontWeight: '800' },
  pinRow: { flexDirection: 'row', gap: 12 },
  pinTile: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    minHeight: 110,
    padding: 14,
  },
  pinIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  pinTitle: { fontSize: 16, fontWeight: '700' },
  pinSub: { fontSize: 13, lineHeight: 18 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterLabel: { fontSize: 13, fontWeight: '600' },
  emptyBlock: { borderRadius: 20, borderWidth: 1, gap: 10, padding: 16 },
  emptyRow: { gap: 2 },
  emptyHint: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  mapsLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 8,
  },
  mapsRow: { flexDirection: 'row', gap: 8 },
  mapsTile: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minHeight: 72,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  mapsTileLabel: { fontSize: 12, fontWeight: '600' },
  setBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  setLabel: { color: '#1A1208', fontSize: 13, fontWeight: '700' },
  kindWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  input: {
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputTall: { minHeight: 68, textAlignVertical: 'top' },
  addItemRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  addItemBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  pickupWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickupChip: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSubtitle: { fontSize: 13, lineHeight: 18 },
  rowAction: { padding: 4 },
  pickupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(236,72,153,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.25)',
  },
  pickupBadgeText: { fontSize: 10, color: '#EC4899', fontWeight: '700' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  addIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: { fontSize: 16, fontWeight: '600' },
  summaryCard: {
    borderRadius: radius.cardLarge,
    borderWidth: 1,
    padding: space.md,
    marginTop: 8,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  summaryTitle: { color: '#EC4899', fontSize: 14, fontWeight: '700', flex: 1 },
  summaryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(236,72,153,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.3)',
  },
  summaryBadgeText: { fontSize: 10, color: '#EC4899', fontWeight: '800' },
  summaryGroup: { paddingVertical: 10 },
  summaryPlaceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  summaryPlaceName: { fontSize: 12, fontWeight: '600', flex: 1 },
  groceryPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(52,211,153,0.15)',
  },
  groceryPillText: { fontSize: 9, color: '#34D399', fontWeight: '700' },
  summaryItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 20 },
  itemPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(236,72,153,0.12)',
  },
  itemPillText: { fontSize: 11, color: '#F0ABFC', fontWeight: '500' },
  summaryCta: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  summaryCtaText: { fontSize: 13, fontWeight: '700' },
});

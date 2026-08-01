import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrbitButton } from '@/components/orbit/orbit-button';
import { radius, space } from '@/constants/orbit-theme';
import { buildPickupSummary } from '@/lib/places/pickup-summary';
import { getCurrentCoords } from '@/lib/places/nearby-stores';
import { createLocalId } from '@/repositories/repository-utils';
import { useOrbit } from '@/store/orbit-store';
import type { SavedPlace, SavedPlaceKind } from '@/types/orbit';

const HOME_ID = 'place-home';
const WORK_ID = 'place-work';

const KIND_OPTIONS: { id: SavedPlaceKind; label: string; emoji: string; color: string }[] = [
  { id: 'home', label: 'Home', emoji: '🏠', color: '#38BDF8' },
  { id: 'work', label: 'Work', emoji: '💼', color: '#7C9CC0' },
  { id: 'school', label: 'School', emoji: '🏫', color: '#A78BFA' },
  { id: 'shop', label: 'Grocery', emoji: '🛒', color: '#34D399' },
  { id: 'practice', label: 'Activity', emoji: '⚽', color: '#F59E0B' },
  { id: 'family', label: 'Family', emoji: '👵', color: '#EC4899' },
  { id: 'cafe', label: 'Café', emoji: '☕', color: '#FB923C' },
  { id: 'pickup', label: 'Pickup', emoji: '📦', color: '#EC4899' },
  { id: 'custom', label: 'Other', emoji: '📍', color: '#7C9CC0' },
];

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

function glass(alpha = 0.07) {
  return `rgba(255,255,255,${alpha})`;
}

function kindMeta(kind: SavedPlaceKind) {
  return KIND_OPTIONS.find((k) => k.id === kind) ?? KIND_OPTIONS[KIND_OPTIONS.length - 1]!;
}

function formatCoordsLabel(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

async function reverseGeocodeLabel(lat: number, lng: number): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const place = results[0];
    if (!place) return formatCoordsLabel(lat, lng);
    const line = [place.streetNumber, place.street].filter(Boolean).join(' ').trim();
    const cityBit = [place.city, place.region].filter(Boolean).join(', ');
    return [line || place.name, cityBit].filter(Boolean).join(' · ') || formatCoordsLabel(lat, lng);
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
    emoji: place.emoji ?? meta.emoji,
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
    orbitPalette,
    removeSavedPlace,
    suggestNovaItinerary,
    upsertSavedPlace,
  } = useOrbit();
  const places = useMemo(() => household.savedPlaces ?? [], [household.savedPlaces]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [locating, setLocating] = useState(false);
  const [itemInput, setItemInput] = useState('');
  const [suggestBusy, setSuggestBusy] = useState(false);

  const home = places.find((p) => p.kind === 'home') ?? places.find((p) => p.id === HOME_ID);
  const work = places.find((p) => p.kind === 'work') ?? places.find((p) => p.id === WORK_ID);
  const extras = useMemo(
    () => places.filter((p) => p.id !== home?.id && p.id !== work?.id),
    [places, home?.id, work?.id]
  );

  const summary = useMemo(
    () => buildPickupSummary(places, household.groceries, household.preferredStoreId),
    [places, household.groceries, household.preferredStoreId]
  );

  const openSlot = (kind: 'home' | 'work', existing?: SavedPlace) => {
    const meta = kindMeta(kind);
    setEditor(
      placeToEditor(
        existing ?? {
          id: kind === 'home' ? HOME_ID : WORK_ID,
          name: kind === 'home' ? 'Home' : 'Work',
          kind,
          address: '',
          emoji: meta.emoji,
          isFavorite: true,
          pickupItemNames: [],
        },
        !existing
      )
    );
    setItemInput('');
  };

  const openExtra = (place?: SavedPlace) => {
    const meta = kindMeta(place?.kind ?? 'custom');
    setEditor(
      placeToEditor(
        place ?? {
          id: createLocalId('place'),
          name: '',
          kind: 'custom',
          address: '',
          emoji: meta.emoji,
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
        Alert.alert('Location needed', 'Allow location access to fill this place from where you are.');
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
      Alert.alert('Add an address', 'Enter a street address or use your current location.');
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
    Alert.alert(label, 'Trips and near-shop alerts will stop using it.', [
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
      const created = await suggestNovaItinerary();
      if (created) router.push(`/itinerary/${created.id}` as never);
      else router.push('/create-itinerary' as never);
    } finally {
      setSuggestBusy(false);
    }
  };

  const cat = editor ? kindMeta(editor.kind) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: orbitPalette.backgroundSoft }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.handle, { backgroundColor: glass(0.18) }]} />
      <View style={styles.header}>
        <Pressable
          onPress={() => (editor ? setEditor(null) : router.back())}
          style={[styles.iconBtn, { backgroundColor: glass(0.06) }]}
          hitSlop={8}>
          <MaterialIcons
            name={editor ? 'arrow-back' : 'close'}
            size={18}
            color={orbitPalette.textMuted}
          />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.kicker, { color: orbitPalette.textSubtle }]}>Household</Text>
          <Text style={[styles.title, { color: orbitPalette.text }]}>
            {editor ? (editor.isNew ? 'Add place' : 'Edit place') : 'My Places'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {editor && cat ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={[styles.subtitle, { color: orbitPalette.textMuted }]}>
            Used for trips, grocery stops, and near-shop alerts.
          </Text>

          <Text style={[styles.label, { color: orbitPalette.textSubtle }]}>CATEGORY</Text>
          <View style={styles.kindWrap}>
            {KIND_OPTIONS.filter((k) =>
              editor.kind === 'home' || editor.kind === 'work'
                ? k.id === editor.kind
                : k.id !== 'home' && k.id !== 'work'
            ).map((k) => {
              const active = editor.kind === k.id;
              return (
                <Pressable
                  key={k.id}
                  onPress={() =>
                    setEditor({
                      ...editor,
                      kind: k.id,
                      emoji: editor.emoji === cat.emoji ? k.emoji : editor.emoji,
                    })
                  }
                  style={[
                    styles.kindChip,
                    {
                      backgroundColor: active ? `${k.color}20` : glass(0.05),
                      borderColor: active ? `${k.color}55` : orbitPalette.border,
                    },
                  ]}>
                  <Text style={{ fontSize: 12 }}>{k.emoji}</Text>
                  <Text style={{ fontSize: 12, color: active ? k.color : orbitPalette.textSubtle, fontWeight: active ? '700' : '500' }}>
                    {k.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: orbitPalette.textSubtle }]}>EMOJI</Text>
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
                      backgroundColor: active ? `${cat.color}22` : glass(0.05),
                      borderColor: active ? `${cat.color}55` : orbitPalette.border,
                    },
                  ]}>
                  <Text style={{ fontSize: 18 }}>{e}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setEditor({ ...editor, isFavorite: !editor.isFavorite })}
            style={[
              styles.favToggle,
              {
                backgroundColor: editor.isFavorite ? 'rgba(245,158,11,0.15)' : glass(0.05),
                borderColor: editor.isFavorite ? 'rgba(245,158,11,0.4)' : orbitPalette.border,
              },
            ]}>
            <MaterialIcons
              name={editor.isFavorite ? 'star' : 'star-border'}
              size={18}
              color={editor.isFavorite ? '#F59E0B' : orbitPalette.textSubtle}
            />
            <Text style={{ color: editor.isFavorite ? '#F59E0B' : orbitPalette.textMuted, fontWeight: '600' }}>
              {editor.isFavorite ? 'Favorite place' : 'Mark as favorite'}
            </Text>
          </Pressable>

          {editor.kind !== 'home' && editor.kind !== 'work' ? (
            <View style={styles.field}>
              <Text style={[styles.label, { color: orbitPalette.textSubtle }]}>PLACE NAME</Text>
              <TextInput
                value={editor.name}
                onChangeText={(name) => setEditor({ ...editor, name })}
                placeholder="Work, School, Grandma…"
                placeholderTextColor={orbitPalette.textFaint}
                style={[
                  styles.input,
                  {
                    backgroundColor: glass(0.06),
                    borderColor: orbitPalette.border,
                    color: orbitPalette.text,
                  },
                ]}
              />
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={[styles.label, { color: orbitPalette.textSubtle }]}>ADDRESS</Text>
            <TextInput
              value={editor.address}
              onChangeText={(address) =>
                setEditor({ ...editor, address, lat: undefined, lng: undefined })
              }
              placeholder="Street, city"
              placeholderTextColor={orbitPalette.textFaint}
              style={[
                styles.input,
                styles.inputTall,
                {
                  backgroundColor: glass(0.06),
                  borderColor: orbitPalette.border,
                  color: orbitPalette.text,
                },
              ]}
              multiline
            />
          </View>

          <Pressable
            onPress={() => void fillFromCurrentLocation()}
            style={[styles.locateBtn, { borderColor: `${accentTheme.primary}55`, backgroundColor: glass(0.04) }]}
            disabled={locating}>
            <MaterialIcons name="my-location" size={18} color={accentTheme.primary} />
            <Text style={[styles.locateText, { color: accentTheme.primary }]}>
              {locating ? 'Finding you…' : 'Use current location'}
            </Text>
          </Pressable>

          <Text style={[styles.label, { color: orbitPalette.textSubtle }]}>ITEMS TO PICK UP</Text>
          <View style={styles.addItemRow}>
            <TextInput
              value={itemInput}
              onChangeText={setItemInput}
              placeholder="e.g. Milk, Bread…"
              placeholderTextColor={orbitPalette.textFaint}
              onSubmitEditing={addEditorItem}
              style={[
                styles.input,
                {
                  flex: 1,
                  backgroundColor: glass(0.06),
                  borderColor: orbitPalette.border,
                  color: orbitPalette.text,
                },
              ]}
              returnKeyType="done"
            />
            <Pressable
              onPress={addEditorItem}
              style={[styles.addItemBtn, { backgroundColor: `${cat.color}22`, borderColor: `${cat.color}40` }]}>
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
                  style={[styles.pickupChip, { backgroundColor: `${cat.color}18`, borderColor: `${cat.color}30` }]}>
                  <Text style={{ fontSize: 12, color: cat.color }}>{item}</Text>
                  <MaterialIcons name="close" size={12} color={cat.color} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={[styles.novaHint, { backgroundColor: 'rgba(6,182,212,0.08)', borderColor: 'rgba(6,182,212,0.18)' }]}>
            <MaterialIcons name="auto-awesome" size={13} color="#06B6D4" />
            <Text style={{ flex: 1, fontSize: 12, color: orbitPalette.textMuted, lineHeight: 18 }}>
              <Text style={{ color: '#06B6D4', fontWeight: '700' }}>Nova uses this</Text> to bundle
              errands, suggest pickup reminders, and build smart itineraries.
            </Text>
          </View>

          <OrbitButton onPress={saveEditor}>Save place</OrbitButton>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}>
          <Text style={[styles.subtitle, { color: orbitPalette.textMuted }]}>
            Train Nova with home, work, stores, and pickup spots — Plan trips reuse them.
          </Text>

          <PlaceRow
            palette={orbitPalette}
            emoji={home?.emoji ?? '🏠'}
            title="Home"
            subtitle={home?.address || 'Add home address…'}
            empty={!home?.address}
            favorite={home?.isFavorite}
            pickupCount={home?.pickupItemNames?.length ?? 0}
            accent={accentTheme.primary}
            onPress={() => openSlot('home', home)}
            onClear={home?.address ? () => clearOrDelete(home, 'home') : undefined}
          />
          <PlaceRow
            palette={orbitPalette}
            emoji={work?.emoji ?? '💼'}
            title="Work"
            subtitle={work?.address || 'Add work address…'}
            empty={!work?.address}
            favorite={work?.isFavorite}
            pickupCount={work?.pickupItemNames?.length ?? 0}
            accent={accentTheme.primary}
            onPress={() => openSlot('work', work)}
            onClear={work?.address ? () => clearOrDelete(work, 'work') : undefined}
          />

          {extras.map((place) => {
            const meta = kindMeta(place.kind);
            return (
              <PlaceRow
                key={place.id}
                palette={orbitPalette}
                emoji={place.emoji ?? meta.emoji}
                title={place.name}
                subtitle={place.address}
                favorite={place.isFavorite}
                pickupCount={place.pickupItemNames?.length ?? 0}
                accent={meta.color}
                onPress={() => openExtra(place)}
                onClear={() => clearOrDelete(place, 'extra')}
              />
            );
          })}

          <Pressable style={styles.addRow} onPress={() => openExtra()}>
            <View style={[styles.addIcon, { backgroundColor: glass(0.06) }]}>
              <MaterialIcons name="add" size={20} color={orbitPalette.textMuted} />
            </View>
            <Text style={[styles.addLabel, { color: orbitPalette.textMuted }]}>Add a place…</Text>
          </Pressable>

          {summary.total > 0 ? (
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: 'rgba(236,72,153,0.1)',
                  borderColor: 'rgba(236,72,153,0.22)',
                },
              ]}>
              <View style={styles.summaryHead}>
                <MaterialIcons name="shopping-cart" size={14} color="#EC4899" />
                <Text style={styles.summaryTitle}>Pickup Summary</Text>
                <View style={styles.summaryBadge}>
                  <Text style={styles.summaryBadgeText}>{summary.total} items</Text>
                </View>
              </View>
              {summary.groups.map((group, i) => (
                <View
                  key={group.placeId}
                  style={[
                    styles.summaryGroup,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: 'rgba(236,72,153,0.15)',
                    },
                  ]}>
                  <View style={styles.summaryPlaceRow}>
                    <Text style={{ fontSize: 13 }}>{group.emoji ?? '📍'}</Text>
                    <Text style={[styles.summaryPlaceName, { color: orbitPalette.text }]}>
                      {group.placeName}
                    </Text>
                    {group.groceryLinked ? (
                      <View style={styles.groceryPill}>
                        <Text style={styles.groceryPillText}>Groceries</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.summaryItems}>
                    {group.items.map((item) => (
                      <View key={`${group.placeId}-${item}`} style={styles.itemPill}>
                        <Text style={styles.itemPillText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
              <Pressable
                onPress={() => void handlePickupCta()}
                disabled={suggestBusy}
                style={[styles.summaryCta, { borderColor: `${accentTheme.primary}44` }]}>
                <MaterialIcons name="route" size={16} color={accentTheme.primary} />
                <Text style={[styles.summaryCtaText, { color: accentTheme.primary }]}>
                  {suggestBusy
                    ? 'Asking Nova…'
                    : summary.groups.some((g) => g.groceryLinked)
                      ? 'Open shopping list'
                      : 'Plan a pickup trip'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function PlaceRow({
  palette,
  emoji,
  title,
  subtitle,
  empty,
  favorite,
  pickupCount,
  accent,
  onPress,
  onClear,
}: {
  palette: { text: string; textMuted: string; textSubtle: string; border: string };
  emoji: string;
  title: string;
  subtitle: string;
  empty?: boolean;
  favorite?: boolean;
  pickupCount: number;
  accent: string;
  onPress: () => void;
  onClear?: () => void;
}) {
  return (
    <Pressable
      style={[styles.row, { backgroundColor: glass(0.05), borderColor: palette.border }]}
      onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: `${accent}22`, borderColor: `${accent}40` }]}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.rowTitleRow}>
          <Text style={[styles.rowTitle, { color: palette.text }]}>{title}</Text>
          {favorite ? <MaterialIcons name="star" size={14} color="#F59E0B" /> : null}
        </View>
        <Text
          style={[styles.rowSubtitle, { color: empty ? palette.textSubtle : palette.textMuted }]}
          numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {pickupCount > 0 ? (
        <View style={styles.pickupBadge}>
          <MaterialIcons name="shopping-cart" size={10} color="#EC4899" />
          <Text style={styles.pickupBadgeText}>{pickupCount}</Text>
        </View>
      ) : null}
      <MaterialIcons name="edit" size={18} color={palette.textSubtle} />
      {onClear ? (
        <Pressable onPress={onClear} hitSlop={10} style={styles.rowAction}>
          <MaterialIcons name="close" size={18} color={palette.textSubtle} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: { fontSize: 22, fontWeight: '800' },
  content: { paddingHorizontal: 20, gap: 12, paddingTop: 8 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  kindWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  field: { gap: 8 },
  input: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputTall: { minHeight: 72, textAlignVertical: 'top' },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  locateText: { fontSize: 14, fontWeight: '700' },
  addItemRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addItemBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  novaHint: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'flex-start',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  summaryCtaText: { fontSize: 13, fontWeight: '700' },
});

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitColors } from '@/constants/orbit-theme';
import { getCurrentCoords } from '@/lib/places/nearby-stores';
import { createLocalId } from '@/repositories/repository-utils';
import { useOrbit } from '@/store/orbit-store';
import type { SavedPlace, SavedPlaceKind } from '@/types/orbit';

const HOME_ID = 'place-home';
const WORK_ID = 'place-work';

type EditorState = {
  id: string;
  name: string;
  kind: SavedPlaceKind;
  address: string;
  lat?: number;
  lng?: number;
  isNew: boolean;
};

function kindIcon(kind: SavedPlaceKind): keyof typeof MaterialIcons.glyphMap {
  switch (kind) {
    case 'home':
      return 'home';
    case 'work':
      return 'work';
    case 'school':
      return 'school';
    case 'shop':
      return 'storefront';
    case 'practice':
      return 'sports-soccer';
    case 'family':
      return 'favorite';
    default:
      return 'place';
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
    const line = [place.streetNumber, place.street].filter(Boolean).join(' ').trim();
    const cityBit = [place.city, place.region].filter(Boolean).join(', ');
    return [line || place.name, cityBit].filter(Boolean).join(' · ') || formatCoordsLabel(lat, lng);
  } catch {
    return formatCoordsLabel(lat, lng);
  }
}

export default function PlacesScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, household, removeSavedPlace, upsertSavedPlace } = useOrbit();
  const places = household.savedPlaces ?? [];
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [locating, setLocating] = useState(false);

  const home = places.find((p) => p.kind === 'home') ?? places.find((p) => p.id === HOME_ID);
  const work = places.find((p) => p.kind === 'work') ?? places.find((p) => p.id === WORK_ID);
  const extras = useMemo(
    () => places.filter((p) => p.id !== home?.id && p.id !== work?.id),
    [places, home?.id, work?.id]
  );

  const openSlot = (kind: 'home' | 'work', existing?: SavedPlace) => {
    setEditor({
      id: existing?.id ?? (kind === 'home' ? HOME_ID : WORK_ID),
      name: existing?.name ?? (kind === 'home' ? 'Home' : 'Work'),
      kind,
      address: existing?.address ?? '',
      lat: existing?.lat,
      lng: existing?.lng,
      isNew: !existing,
    });
  };

  const openExtra = (place?: SavedPlace) => {
    setEditor({
      id: place?.id ?? createLocalId('place'),
      name: place?.name ?? '',
      kind: place?.kind ?? 'custom',
      address: place?.address ?? '',
      lat: place?.lat,
      lng: place?.lng,
      isNew: !place,
    });
  };

  const useCurrentLocation = async () => {
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

  const saveEditor = () => {
    if (!editor) return;
    const address = editor.address.trim();
    const name = editor.name.trim() || (editor.kind === 'home' ? 'Home' : editor.kind === 'work' ? 'Work' : 'Place');
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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.handle} />
      <View style={styles.header}>
        <Pressable onPress={() => (editor ? setEditor(null) : router.back())} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name={editor ? 'arrow-back' : 'close'} size={18} color={orbitColors.textMuted} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Household</Text>
          <Text style={styles.title}>{editor ? (editor.isNew ? 'Add place' : 'Edit place') : 'Places'}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {editor ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>Used for trips, grocery stops, and near-shop alerts.</Text>

          {editor.kind === 'custom' || editor.kind === 'shop' || editor.kind === 'school' || editor.kind === 'family' || editor.kind === 'practice' ? (
            <View style={styles.field}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                value={editor.name}
                onChangeText={(name) => setEditor({ ...editor, name })}
                placeholder="Work, School, Grandma…"
                placeholderTextColor={orbitColors.textSubtle}
                style={styles.input}
              />
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              value={editor.address}
              onChangeText={(address) => setEditor({ ...editor, address, lat: undefined, lng: undefined })}
              placeholder="Street, city"
              placeholderTextColor={orbitColors.textSubtle}
              style={[styles.input, styles.inputTall]}
              multiline
            />
          </View>

          <Pressable
            onPress={() => void useCurrentLocation()}
            style={[styles.locateBtn, { borderColor: `${accentTheme.primary}55` }]}
            disabled={locating}>
            <MaterialIcons name="my-location" size={18} color={accentTheme.primary} />
            <Text style={[styles.locateText, { color: accentTheme.primary }]}>
              {locating ? 'Finding you…' : 'Use current location'}
            </Text>
          </Pressable>

          <OrbitButton onPress={saveEditor}>Save place</OrbitButton>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>
            Pick home, work, and other stops once — Plan trips and grocery suggestions reuse them.
          </Text>

          <PlaceRow
            accent={accentTheme.primary}
            icon="home"
            title="Home"
            subtitle={home?.address || 'Add home address…'}
            empty={!home?.address}
            onPress={() => openSlot('home', home)}
            onEdit={() => openSlot('home', home)}
            onClear={home?.address ? () => clearOrDelete(home, 'home') : undefined}
          />
          <PlaceRow
            accent={accentTheme.primary}
            icon="work"
            title="Work"
            subtitle={work?.address || 'Add work address…'}
            empty={!work?.address}
            onPress={() => openSlot('work', work)}
            onEdit={() => openSlot('work', work)}
            onClear={work?.address ? () => clearOrDelete(work, 'work') : undefined}
          />

          {extras.map((place) => (
            <PlaceRow
              key={place.id}
              accent={accentTheme.primary}
              icon={kindIcon(place.kind)}
              title={place.name}
              subtitle={place.address}
              onPress={() => openExtra(place)}
              onEdit={() => openExtra(place)}
              onClear={() => clearOrDelete(place, 'extra')}
            />
          ))}

          <Pressable
            style={styles.addRow}
            onPress={() => openExtra()}>
            <View style={styles.addIcon}>
              <MaterialIcons name="add" size={20} color={orbitColors.textMuted} />
            </View>
            <Text style={styles.addLabel}>Add an address…</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function PlaceRow({
  accent,
  icon,
  title,
  subtitle,
  empty,
  onPress,
  onEdit,
  onClear,
}: {
  accent: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  empty?: boolean;
  onPress: () => void;
  onEdit: () => void;
  onClear?: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: `${accent}22` }]}>
        <MaterialIcons name={icon} size={20} color={accent} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={[styles.rowSubtitle, empty && styles.rowSubtitleEmpty]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Pressable onPress={onEdit} hitSlop={10} style={styles.rowAction}>
        <MaterialIcons name="edit" size={18} color={orbitColors.textSubtle} />
      </Pressable>
      {onClear ? (
        <Pressable onPress={onClear} hitSlop={10} style={styles.rowAction}>
          <MaterialIcons name="close" size={18} color={orbitColors.textSubtle} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A1525' },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerCopy: { flex: 1 },
  kicker: {
    color: orbitColors.textSubtle,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: { color: orbitColors.text, fontSize: 22, fontWeight: '800' },
  content: { paddingHorizontal: 20, gap: 12, paddingTop: 8 },
  subtitle: { color: orbitColors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { color: orbitColors.text, fontSize: 16, fontWeight: '700' },
  rowSubtitle: { color: orbitColors.textMuted, fontSize: 13, lineHeight: 18 },
  rowSubtitleEmpty: { color: orbitColors.textSubtle, fontStyle: 'italic' },
  rowAction: { padding: 4 },
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
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  addLabel: { color: orbitColors.textMuted, fontSize: 16, fontWeight: '600' },
  field: { gap: 8 },
  label: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    color: orbitColors.text,
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
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  locateText: { fontSize: 14, fontWeight: '700' },
});

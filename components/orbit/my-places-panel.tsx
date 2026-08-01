import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';

import { radius, space, typography } from '@/constants/orbit-theme';
import { buildPickupSummary } from '@/lib/places/pickup-summary';
import { useOrbit } from '@/store/orbit-store';
import type { SavedPlace, SavedPlaceKind } from '@/types/orbit';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type KindMeta = {
  id: SavedPlaceKind | 'all';
  label: string;
  emoji: string;
  color: string;
};

const KIND_META: Record<SavedPlaceKind, { label: string; emoji: string; color: string }> = {
  home: { label: 'Home', emoji: '🏠', color: '#38BDF8' },
  work: { label: 'Work', emoji: '💼', color: '#7C9CC0' },
  school: { label: 'School', emoji: '🏫', color: '#A78BFA' },
  shop: { label: 'Grocery', emoji: '🛒', color: '#34D399' },
  practice: { label: 'Activity', emoji: '⚽', color: '#F59E0B' },
  family: { label: 'Family', emoji: '👵', color: '#EC4899' },
  cafe: { label: 'Café', emoji: '☕', color: '#FB923C' },
  pickup: { label: 'Pickup', emoji: '📦', color: '#EC4899' },
  custom: { label: 'Other', emoji: '📍', color: '#7C9CC0' },
};

function glass(alpha = 0.07) {
  return `rgba(255,255,255,${alpha})`;
}

type MyPlacesPanelProps = {
  /** Compact embed inside Plan trips; hides FAB when false and uses addPlaceHref. */
  compact?: boolean;
  showFab?: boolean;
  onAddPlace?: () => void;
};

export function MyPlacesPanel({
  compact = false,
  showFab = true,
  onAddPlace,
}: MyPlacesPanelProps) {
  const {
    accentTheme,
    household,
    orbitPalette,
    removeSavedPlace,
    suggestNovaItinerary,
    upsertSavedPlace,
  } = useOrbit();
  const places = useMemo(() => household.savedPlaces ?? [], [household.savedPlaces]);
  const [filterKind, setFilterKind] = useState<SavedPlaceKind | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [suggestBusy, setSuggestBusy] = useState(false);

  const summary = useMemo(
    () => buildPickupSummary(places, household.groceries, household.preferredStoreId),
    [places, household.groceries, household.preferredStoreId]
  );

  const chips: KindMeta[] = useMemo(() => {
    const present = (Object.keys(KIND_META) as SavedPlaceKind[]).filter((kind) =>
      places.some((p) => p.kind === kind)
    );
    return [
      { id: 'all', label: 'All', emoji: '', color: '#38BDF8' },
      ...present.map((id) => ({ id, ...KIND_META[id] })),
    ];
  }, [places]);

  const filtered = places.filter((p) => filterKind === 'all' || p.kind === filterKind);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((cur) => (cur === id ? null : id));
  };

  const toggleFavorite = (place: SavedPlace) => {
    upsertSavedPlace({ ...place, isFavorite: !place.isFavorite });
  };

  const addPickupItem = (place: SavedPlace, raw: string) => {
    const name = raw.trim();
    if (!name) return;
    const existing = place.pickupItemNames ?? [];
    if (existing.some((i) => i.toLowerCase() === name.toLowerCase())) return;
    upsertSavedPlace({ ...place, pickupItemNames: [...existing, name] });
    setItemDrafts((d) => ({ ...d, [place.id]: '' }));
  };

  const handleAddPlace = () => {
    if (onAddPlace) {
      onAddPlace();
      return;
    }
    router.push('/places' as never);
  };

  const handlePickupCta = async () => {
    const hasShop = summary.groups.some((g) => g.groceryLinked);
    if (hasShop) {
      router.push('/shopping-mode' as never);
      return;
    }
    setSuggestBusy(true);
    try {
      const created = await suggestNovaItinerary();
      if (created) {
        router.push(`/itinerary/${created.id}` as never);
      } else {
        router.push('/create-itinerary' as never);
      }
    } finally {
      setSuggestBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {!compact ? (
        <LinearGradient
          colors={['rgba(167,139,250,0.13)', 'rgba(56,189,248,0.07)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.trainCard, { borderColor: 'rgba(167,139,250,0.22)' }]}>
          <View style={styles.trainRow}>
            <View style={styles.trainIcon}>
              <MaterialIcons name="auto-awesome" size={18} color="#A78BFA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.trainTitle, { color: orbitPalette.text }]}>Train Nova</Text>
              <Text style={[styles.trainBody, { color: orbitPalette.textMuted }]}>
                Add stores, schools & activities so Nova can plan optimised routes and pickup
                reminders.
              </Text>
            </View>
          </View>
        </LinearGradient>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}>
        {chips.map((chip) => {
          const active = filterKind === chip.id;
          const count =
            chip.id === 'all' ? places.length : places.filter((p) => p.kind === chip.id).length;
          return (
            <Pressable
              key={chip.id}
              onPress={() => setFilterKind(active && chip.id !== 'all' ? 'all' : chip.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? `${chip.color}1E` : glass(0.05),
                  borderColor: active ? `${chip.color}55` : orbitPalette.border,
                },
              ]}>
              {chip.emoji ? <Text style={styles.chipEmoji}>{chip.emoji}</Text> : null}
              <Text
                style={[
                  styles.chipLabel,
                  { color: active ? chip.color : orbitPalette.textSubtle, fontWeight: active ? '700' : '500' },
                ]}>
                {chip.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.list}>
        {filtered.map((place) => (
          <PlaceCard
            key={place.id}
            place={place}
            expanded={expandedId === place.id}
            itemDraft={itemDrafts[place.id] ?? ''}
            onToggleExpand={() => toggleExpand(place.id)}
            onToggleFav={() => toggleFavorite(place)}
            onDelete={() => removeSavedPlace(place.id)}
            onChangeDraft={(v) => setItemDrafts((d) => ({ ...d, [place.id]: v }))}
            onAddItem={() => addPickupItem(place, itemDrafts[place.id] ?? '')}
            onEdit={() => router.push('/places' as never)}
          />
        ))}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📍</Text>
            <Text style={[styles.emptyTitle, { color: orbitPalette.textSubtle }]}>No places yet</Text>
            <Text style={[styles.emptyBody, { color: orbitPalette.textFaint }]}>
              Tap + Add Place to get started
            </Text>
          </View>
        ) : null}
      </View>

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
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(236,72,153,0.15)' },
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

      {showFab ? (
        <Pressable onPress={handleAddPlace} style={styles.fab}>
          <LinearGradient
            colors={['#A78BFA', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabInner}>
            <MaterialIcons name="add" size={16} color="#fff" />
            <Text style={styles.fabLabel}>Add Place</Text>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

function PlaceCard({
  place,
  expanded,
  itemDraft,
  onToggleExpand,
  onToggleFav,
  onDelete,
  onChangeDraft,
  onAddItem,
  onEdit,
}: {
  place: SavedPlace;
  expanded: boolean;
  itemDraft: string;
  onToggleExpand: () => void;
  onToggleFav: () => void;
  onDelete: () => void;
  onChangeDraft: (v: string) => void;
  onAddItem: () => void;
  onEdit: () => void;
}) {
  const { orbitPalette } = useOrbit();
  const meta = KIND_META[place.kind];
  const pickups = place.pickupItemNames ?? [];
  const emoji = place.emoji ?? meta.emoji;

  return (
    <View
      style={[
        styles.placeCard,
        {
          backgroundColor: glass(expanded ? 0.07 : 0.05),
          borderColor: expanded ? `${meta.color}40` : orbitPalette.border,
        },
      ]}>
      <Pressable onPress={onToggleExpand} style={styles.placeHead}>
        <View style={[styles.placeEmoji, { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}40` }]}>
          <Text style={{ fontSize: 18 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.placeName, { color: orbitPalette.text }]} numberOfLines={1}>
            {place.name}
          </Text>
          <View style={styles.addrRow}>
            <MaterialIcons name="place" size={10} color={orbitPalette.textSubtle} />
            <Text style={[styles.addr, { color: orbitPalette.textSubtle }]} numberOfLines={1}>
              {place.address}
            </Text>
          </View>
        </View>
        <View style={styles.placeActions}>
          {pickups.length > 0 ? (
            <View style={styles.pickupBadge}>
              <MaterialIcons name="shopping-cart" size={9} color="#EC4899" />
              <Text style={styles.pickupBadgeText}>{pickups.length}</Text>
            </View>
          ) : null}
          <Pressable
            onPress={onToggleFav}
            hitSlop={8}
            style={styles.starHit}>
            <MaterialIcons
              name={place.isFavorite ? 'star' : 'star-border'}
              size={16}
              color={place.isFavorite ? '#F59E0B' : orbitPalette.textSubtle}
            />
          </Pressable>
          <MaterialIcons
            name="expand-more"
            size={18}
            color={orbitPalette.textSubtle}
            style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.placeBody}>
          <View style={[styles.divider, { backgroundColor: orbitPalette.border }]} />
          <View style={styles.placeMetaRow}>
            <Text style={[styles.kindLabel, { color: meta.color }]}>
              {meta.emoji} {meta.label}
            </Text>
            <View style={styles.placeMetaActions}>
              <Pressable onPress={onEdit} style={styles.miniAction}>
                <MaterialIcons name="edit" size={12} color={orbitPalette.textMuted} />
                <Text style={[styles.miniActionText, { color: orbitPalette.textMuted }]}>Edit</Text>
              </Pressable>
              {place.kind !== 'home' && place.kind !== 'work' ? (
                <Pressable onPress={onDelete} style={[styles.miniAction, styles.removeAction]}>
                  <MaterialIcons name="delete-outline" size={12} color="#EF4444" />
                  <Text style={[styles.miniActionText, { color: '#EF4444' }]}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <Text style={[styles.pickupLabel, { color: orbitPalette.textSubtle }]}>PICKUP LIST</Text>
          {pickups.length > 0 ? (
            <View style={styles.pickupWrap}>
              {pickups.map((item) => (
                <View key={item} style={styles.pickupChip}>
                  <Text style={styles.pickupChipText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.pickupEmpty, { color: orbitPalette.textFaint }]}>
              No items yet — Nova will remind you when passing by.
            </Text>
          )}

          <View style={styles.addRow}>
            <TextInput
              value={itemDraft}
              onChangeText={onChangeDraft}
              placeholder="Add item to pick up…"
              placeholderTextColor={orbitPalette.textFaint}
              onSubmitEditing={onAddItem}
              style={[
                styles.addInput,
                {
                  backgroundColor: glass(0.05),
                  borderColor: orbitPalette.border,
                  color: orbitPalette.text,
                },
              ]}
              returnKeyType="done"
            />
            <Pressable
              onPress={onAddItem}
              style={[styles.addBtn, { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}40` }]}>
              <MaterialIcons name="add" size={16} color={meta.color} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, position: 'relative', paddingBottom: 56 },
  trainCard: {
    borderRadius: radius.cardLarge,
    borderWidth: 1,
    overflow: 'hidden',
    padding: space.md,
  },
  trainRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  trainIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  trainTitle: { ...typography.callout, fontWeight: '700' },
  trainBody: { ...typography.caption1, marginTop: 2, lineHeight: 16 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipEmoji: { fontSize: 12 },
  chipLabel: { fontSize: 12 },
  list: { gap: 10 },
  placeCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  placeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  placeEmoji: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeName: { ...typography.callout, fontWeight: '600' },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  addr: { ...typography.caption2, flexShrink: 1 },
  placeActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  pickupBadgeText: { fontSize: 9, color: '#EC4899', fontWeight: '700' },
  starHit: { padding: 2 },
  placeBody: { paddingHorizontal: 14, paddingBottom: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 12 },
  placeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kindLabel: { fontSize: 12, fontWeight: '600' },
  placeMetaActions: { flexDirection: 'row', gap: 8 },
  miniAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  removeAction: {
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  miniActionText: { fontSize: 10, fontWeight: '600' },
  pickupLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  pickupWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  pickupChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(236,72,153,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.22)',
  },
  pickupChipText: { fontSize: 11, color: '#F0ABFC' },
  pickupEmpty: { fontSize: 12, marginBottom: 10 },
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 14, fontWeight: '600' },
  emptyBody: { fontSize: 12, marginTop: 4 },
  summaryCard: {
    borderRadius: radius.cardLarge,
    borderWidth: 1,
    padding: space.md,
    gap: 4,
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
  fab: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fabLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

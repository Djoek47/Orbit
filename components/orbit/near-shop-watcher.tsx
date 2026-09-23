import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { inferRegionFromLabel, matchInStorePromos } from '@/lib/grocery/in-store-promos';
import { isClothingCategory } from '@/lib/grocery/classify';
import { openDirections } from '@/lib/maps/directions';
import { haversineMeters } from '@/lib/places/nearby-stores';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { getPreferredStore } from '@/data/preferred-stores';
import { DEFAULT_POPPINS_NOTIFICATION_PREFS } from '@/services/poppins-notifications';
import { useOrbit } from '@/store/orbit-store';

const ENTER_RADIUS_M = 220;
const THROTTLE_MS = 12 * 60 * 1000;

type NearPrompt = {
  storeName: string;
  address: string;
  lat?: number;
  lng?: number;
  body: string;
  hasDeal: boolean;
};

/**
 * Foreground GPS: when near a saved/preferred store, ask whether to open the list.
 * Accept = shopping mode + directions. Not now = snooze. Never hijack without a choice.
 */
export function NearShopWatcher() {
  const { household, preferredMapsApp, pushNotification } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const lastAlertAt = useRef(0);
  const [prompt, setPrompt] = useState<NearPrompt | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setForeground(next === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!foreground) return;

    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    if (!prefs.nearShop && !prefs.missingOnTheWay) return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    async function start() {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted || cancelled) return;

      const store = getPreferredStore(household.preferredStoreId);
      const shopPlaces = [
        store,
        ...(household.savedPlaces ?? [])
          .filter((p) => p.kind === 'shop' || p.kind === 'clothing')
          .map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address,
            placeQuery: p.placeQuery ?? p.address,
            lat: p.lat,
            lng: p.lng,
          })),
      ].filter((s) => s.lat != null && s.lng != null);

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 40,
          timeInterval: 20000,
        },
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const near = shopPlaces.find((shop) => {
            if (shop.lat == null || shop.lng == null) return false;
            return haversineMeters(latitude, longitude, shop.lat, shop.lng) <= ENTER_RADIUS_M;
          });
          if (!near) return;

          const now = Date.now();
          if (now - lastAlertAt.current <= THROTTLE_MS) return;
          lastAlertAt.current = now;

          const missing = household.groceries.filter(
            (g) => g.status === 'Missing' || g.status === 'Low'
          );
          const region = inferRegionFromLabel(near.address);
          const deals = matchInStorePromos({
            listNames: missing.map((item) => item.name),
            retailer: near.name,
            region,
          });
          const clothing = missing.filter((item) =>
            isClothingCategory(item.categoryId ?? item.category)
          );
          const groceriesOnly = missing.filter(
            (item) => !isClothingCategory(item.categoryId ?? item.category)
          );
          const dealLine = deals[0]
            ? `${deals[0].listItem} — ${deals[0].offer}`
            : groceriesOnly.length
              ? `${groceriesOnly.length} grocery item${groceriesOnly.length === 1 ? '' : 's'} on your list`
              : clothing.length
                ? `${clothing[0]!.name} is on your shopping list`
                : 'Nothing needed — skip if you like';
          const clothingNear = clothing.length > 0;
          const shopBit =
            clothingNear && groceriesOnly.length
              ? `. ${clothing.slice(0, 2).map((item) => item.name).join(', ')} on your shopping list`
              : '';

          setPrompt({
            storeName: near.name,
            address: near.address,
            lat: near.lat,
            lng: near.lng,
            hasDeal: deals.length > 0,
            body: clothingNear && !deals.length
              ? `${dealLine}${shopBit}. Clothing stays in-store — not an online cart.`
              : `${dealLine}${shopBit}`,
          });

          void pushNotification({
            title: `Near ${near.name}`,
            body: dealLine,
            category: 'groceries',
            priority: 'medium',
            data: { kind: 'near_shop_deal', storeName: near.name },
          }).catch(() => undefined);
        }
      );
    }

    void start();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [
    foreground,
    household.groceries,
    household.notificationPrefs,
    household.preferredStoreId,
    household.savedPlaces,
    pushNotification,
  ]);

  const dismiss = () => setPrompt(null);

  const accept = async () => {
    const next = prompt;
    setPrompt(null);
    if (!next) return;
    router.push('/shopping-mode' as never);
    if (next.lat != null && next.lng != null) {
      await openDirections(undefined, { address: next.address, lat: next.lat, lng: next.lng }, preferredMapsApp);
    }
  };

  if (!prompt) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            { backgroundColor: c.backgroundSoft, borderColor: glassBorder(0.14) },
          ]}>
          <Text style={[styles.kicker, { color: c.textSubtle }]}>NEARBY STORE</Text>
          <Text style={[styles.title, { color: c.text }]}>{prompt.storeName}</Text>
          <Text style={[styles.body, { color: c.textMuted }]}>{prompt.body}</Text>
          <Text style={[styles.fine, { color: c.textSubtle }]}>
            {prompt.hasDeal
              ? 'Typical in-store offer — not a live price. Open the list if you want to stop.'
              : 'Poppins only redirects if you accept.'}
          </Text>
          <OrbitButton onPress={() => void accept()}>Stop and open list</OrbitButton>
          <Pressable onPress={dismiss} style={[styles.secondary, { backgroundColor: glass(0.05) }]}>
            <Text style={[styles.secondaryText, { color: c.textMuted }]}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 20,
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontSize: 22, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 22 },
  fine: { fontSize: 12, lineHeight: 18 },
  secondary: { alignItems: 'center', borderRadius: 16, paddingVertical: 14 },
  secondaryText: { fontSize: 15, fontWeight: '700' },
});

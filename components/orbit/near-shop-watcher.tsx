import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getPreferredStore } from '@/data/preferred-stores';
import { scheduleLocalReminder } from '@/lib/notifications/push';
import { haversineMeters } from '@/lib/places/nearby-stores';
import { DEFAULT_NOVA_NOTIFICATION_PREFS } from '@/services/nova-notifications';
import { useOrbit } from '@/store/orbit-store';

const ENTER_RADIUS_M = 220;
const THROTTLE_MS = 12 * 60 * 1000;

/**
 * Expo Go best-effort: while the app is foregrounded (or an active grocery trip
 * is running), watch position and fire near-shop local + in-app alerts.
 */
export function NearShopWatcher() {
  const { household, pushNotification } = useOrbit();
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const lastAlertAt = useRef(0);
  const lastMissingNudgeAt = useRef(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (appState !== 'active') return;

    const prefs = household.notificationPrefs ?? DEFAULT_NOVA_NOTIFICATION_PREFS;
    if (!prefs.nearShop && !prefs.missingOnTheWay) return;

    const activeGroceryTrip = (household.itineraries ?? []).some(
      (itin) =>
        itin.status === 'active' &&
        itin.stops.some(
          (stop) =>
            (stop.kind === 'grocery' || stop.kind === 'shop') &&
            (stop.status === 'active' || stop.status === 'pending')
        )
    );

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    async function start() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted || cancelled) return;

      const store = getPreferredStore(household.preferredStoreId);
      const shopPlaces = [
        store,
        ...(household.savedPlaces ?? [])
          .filter((p) => p.kind === 'shop')
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
          const missing = household.groceries.filter(
            (g) => g.status === 'Missing' || g.status === 'Low'
          );

          if (prefs.nearShop && now - lastAlertAt.current > THROTTLE_MS) {
            lastAlertAt.current = now;
            void pushNotification({
              title: 'Choremaxx · Near the store',
              body: `You're close to ${near.name}. Open shopping mode for ${missing.length} items.`,
              category: 'groceries',
              priority: 'high',
              data: { kind: 'near_shop', storeId: near.id, href: '/shopping-mode' },
            });
            void scheduleLocalReminder(
              'Choremaxx · Near the store',
              `${near.name} · ${missing.length} items on your list`,
              1
            ).catch(() => undefined);
          }

          if (
            prefs.missingOnTheWay &&
            (activeGroceryTrip || missing.length > 0) &&
            now - lastMissingNudgeAt.current > THROTTLE_MS
          ) {
            lastMissingNudgeAt.current = now;
            const sample = missing
              .slice(0, 3)
              .map((g) => g.name)
              .join(', ');
            void pushNotification({
              title: 'Nova · Before you go in',
              body: sample
                ? `Still missing: ${sample}. Tap to open shopping mode.`
                : 'List looks clear — check for anything else to add.',
              category: 'groceries',
              priority: 'medium',
              data: { kind: 'missing_on_the_way', href: '/shopping-mode' },
            });
          }
        }
      );
    }

    void start();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [
    appState,
    household.groceries,
    household.itineraries,
    household.notificationPrefs,
    household.preferredStoreId,
    household.savedPlaces,
    pushNotification,
  ]);

  return null;
}

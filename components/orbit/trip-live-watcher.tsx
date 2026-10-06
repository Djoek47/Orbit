/**
 * Foreground GPS for an active itinerary — drives the Lock Screen trip banner
 * like Uber / Waze: distance → Arrived → open grocery list when the stop has one.
 */
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { isGroceryStop, orderedStops, tripIntent, todayIso } from '@/lib/itinerary/trip-intent';
import { stopsToBannerItems } from '@/lib/itinerary/trip-banner-copy';
import {
  startTripBanner,
  stopTripBanner,
  updateTripBanner,
} from '@/lib/itinerary/trip-live-activity';
import {
  clearTripLive,
  getTripLiveSnapshot,
  patchTripLive,
} from '@/lib/itinerary/trip-live-session';
import { haversineMeters } from '@/lib/places/nearby-stores';
import { useOrbit } from '@/store/orbit-store';
import type { Itinerary, ItineraryStop, ItineraryStopKind } from '@/types/orbit';

const ARRIVE_RADIUS_M = 120;
const APPROACH_RADIUS_M = 2500;

const STOP_EMOJI: Record<ItineraryStopKind, string> = {
  school: '🏫',
  work: '💼',
  grocery: '🛒',
  pickup: '📦',
  practice: '🏃',
  family: '🏠',
  home: '🏡',
  shop: '🛒',
  custom: '📍',
};

export function TripLiveWatcher() {
  const { household, accentTheme, pushNotification } = useOrbit();
  const lastNotifyStop = useRef<string | null>(null);
  const bannerTripId = useRef<string | null>(null);

  const active = (household.itineraries ?? []).find((item) => item.status === 'active');
  const intent = active ? tripIntent(active, todayIso()) : null;
  const current = intent?.current ?? null;

  useEffect(() => {
    if (!active || !current || !intent || intent.phase === 'completed') {
      if (bannerTripId.current) {
        stopTripBanner();
        bannerTripId.current = null;
      }
      clearTripLive();
      return;
    }

    const trip: Itinerary = active;
    const stop: ItineraryStop = current;
    const completedCount = intent.completed.length;
    const remaining = intent.remaining;

    if (lastNotifyStop.current && lastNotifyStop.current !== stop.id) {
      lastNotifyStop.current = null;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    const pushBanner = (distanceMeters: number | null, arrived: boolean) => {
      const run = {
        tripTitle: trip.title,
        index: completedCount,
        total: orderedStops(trip).length,
        currentLabel: stop.label,
        arrived,
        distanceMeters,
        hasShoppingList: isGroceryStop(stop),
        remainingStops: stopsToBannerItems(remaining, (kind) => STOP_EMOJI[kind]),
      };
      if (!bannerTripId.current) {
        startTripBanner(trip.id, run, accentTheme.primary);
        bannerTripId.current = trip.id;
      } else {
        updateTripBanner(run);
      }
    };

    async function start() {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted || cancelled) {
        pushBanner(null, getTripLiveSnapshot().arrived && getTripLiveSnapshot().stopId === stop.id);
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 25,
          timeInterval: 15000,
        },
        (pos) => {
          if (cancelled) return;
          if (stop.lat == null || stop.lng == null) {
            pushBanner(null, false);
            return;
          }
          const meters = haversineMeters(
            pos.coords.latitude,
            pos.coords.longitude,
            stop.lat,
            stop.lng
          );
          if (meters > APPROACH_RADIUS_M) {
            patchTripLive({
              itineraryId: trip.id,
              stopId: stop.id,
              distanceMeters: meters,
              arrived: false,
            });
            pushBanner(meters, false);
            return;
          }

          const arrived = meters <= ARRIVE_RADIUS_M;
          patchTripLive({
            itineraryId: trip.id,
            stopId: stop.id,
            distanceMeters: meters,
            arrived,
          });
          pushBanner(meters, arrived);

          if (arrived && lastNotifyStop.current !== stop.id) {
            lastNotifyStop.current = stop.id;
            const shopping = isGroceryStop(stop);
            void pushNotification({
              title: shopping ? `Arrived · ${stop.label}` : `You’re at ${stop.label}`,
              body: shopping
                ? 'Open your list for this stop, then mark the stop done when you’re finished.'
                : 'When you’re finished, open the trip and mark this stop done for the next stop.',
              category: 'events',
              priority: 'high',
              data: {
                kind: 'trip_arrived',
                itineraryId: trip.id,
                stopId: stop.id,
                openShopping: shopping ? '1' : '0',
              },
            }).catch(() => undefined);

            if (shopping && AppState.currentState === 'active') {
              router.push('/shopping-mode' as never);
            }
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
    active,
    current,
    intent,
    accentTheme.primary,
    pushNotification,
  ]);

  return null;
}

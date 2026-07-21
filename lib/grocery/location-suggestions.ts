import * as Location from 'expo-location';

import { buildStoreRecommendations } from '@/lib/grocery/recommendations';
import type { GroceryItem, StoreRecommendation } from '@/types/orbit';

export async function getLocationAwareGrocerySuggestions(
  householdId: string | null,
  groceries: GroceryItem[]
): Promise<{ recommendations: StoreRecommendation[]; locationLabel: string | null }> {
  const recommendations = buildStoreRecommendations(householdId, groceries);

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return {
      recommendations,
      locationLabel: null,
    };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const places = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    const place = places[0];
    const locationLabel = [place?.city, place?.region].filter(Boolean).join(', ') || 'Near you';

    const enriched = recommendations.map((item, index) => ({
      ...item,
      title: index === 0 ? `Stop near ${locationLabel}` : item.title,
      detail: `${item.detail} Estimated drive from ${locationLabel}.`,
      etaMinutes: item.etaMinutes ?? 12 + index * 5,
    }));

    return { recommendations: enriched, locationLabel };
  } catch {
    return { recommendations, locationLabel: null };
  }
}

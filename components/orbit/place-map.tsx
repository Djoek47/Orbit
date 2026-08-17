import type { ComponentType, ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export type PlaceMapMarker = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  color?: string;
};

type Props = {
  markers: PlaceMapMarker[];
  height?: number;
  onMarkerPress?: (id: string) => void;
};

type MapsModule = {
  default: ComponentType<{
    style?: object;
    provider?: unknown;
    initialRegion?: object;
    region?: object;
    children?: ReactNode;
  }>;
  PROVIDER_DEFAULT?: unknown;
  Marker: ComponentType<{
    coordinate: { latitude: number; longitude: number };
    title?: string;
    pinColor?: string;
    onPress?: () => void;
  }>;
};

function loadMaps(): MapsModule | null {
  try {
    // Native TestFlight only — Expo Go has no MapView.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-maps') as MapsModule & { default?: MapsModule['default'] };
    if (!mod) return null;
    return {
      default: mod.default ?? (mod as unknown as MapsModule['default']),
      PROVIDER_DEFAULT: mod.PROVIDER_DEFAULT,
      Marker: mod.Marker,
    };
  } catch {
    return null;
  }
}

export function PlaceMap({ markers, height = 180, onMarkerPress }: Props) {
  const { c, glass, glassBorder } = useOrbitColors();
  const maps = loadMaps();
  const pinned = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

  if (!maps || Platform.OS === 'web' || pinned.length === 0) {
    return (
      <View
        style={[
          styles.fallback,
          { height, backgroundColor: glass(0.05), borderColor: glassBorder(0.1) },
        ]}>
        <Text style={[styles.fallbackText, { color: c.textMuted }]}>
          {pinned.length === 0
            ? 'Pick an address to drop a pin.'
            : 'Map preview needs the TestFlight build.'}
        </Text>
      </View>
    );
  }

  const MapView = maps.default;
  const Marker = maps.Marker;
  const region = {
    latitude: pinned[0]!.lat,
    longitude: pinned[0]!.lng,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  };

  return (
    <View style={[styles.wrap, { height, borderColor: glassBorder(0.1) }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'ios' ? undefined : maps.PROVIDER_DEFAULT}
        initialRegion={region}
        region={region}>
        {pinned.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.lat, longitude: marker.lng }}
            title={marker.title}
            pinColor={marker.color}
            onPress={() => onMarkerPress?.(marker.id)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallback: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  fallbackText: { fontSize: 13, textAlign: 'center' },
});

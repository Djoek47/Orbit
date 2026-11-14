import { memo, useEffect, useRef, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export type PlannerPin = {
  key: string;
  label: string;
  emoji?: string;
  lat: number;
  lng: number;
  isHome?: boolean;
};

type LatLngRN = { latitude: number; longitude: number };
type MapRef = {
  animateToRegion: (r: object, ms?: number) => void;
  fitToCoordinates: (c: LatLngRN[], o?: object) => void;
};
type MapsModule = {
  MapView: ComponentType<Record<string, unknown> & { children?: ReactNode }>;
  Marker: ComponentType<Record<string, unknown> & { children?: ReactNode }>;
  Polyline: ComponentType<Record<string, unknown>>;
};

function loadMaps(): MapsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-maps');
    if (!mod?.Marker) return null;
    return { MapView: mod.default ?? mod.MapView, Marker: mod.Marker, Polyline: mod.Polyline };
  } catch {
    return null;
  }
}

const rn = (p: { lat: number; lng: number }): LatLngRN => ({ latitude: p.lat, longitude: p.lng });

/** Marker bubble — pops on selection change. */
const PinBubble = memo(function PinBubble({
  pin,
  order,
  accent,
}: {
  pin: PlannerPin;
  order: number | null;
  accent: string;
}) {
  const { c, isDark } = useOrbitColors();
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.value = withSequence(withSpring(1.25, { damping: 6 }), withSpring(1, { damping: 10 }));
  }, [order != null, scale]); // eslint-disable-line react-hooks/exhaustive-deps
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const on = order != null;
  const bg = on ? accent : isDark ? '#0F1A2C' : '#FFFFFF';
  return (
    <Animated.View style={[styles.bubble, { backgroundColor: bg, borderColor: on ? '#FFFFFF' : `${accent}66` }, style]}>
      {on ? (
        <View style={styles.num}>
          <Text style={styles.numText}>{order}</Text>
        </View>
      ) : (
        <Moji emoji={pin.emoji} name={pin.isHome ? 'home' : undefined} size={16} fallback="pin" />
      )}
      <Text numberOfLines={1} style={[styles.bubbleText, { color: on ? '#0B1220' : c.text }]}>
        {pin.isHome ? 'Home' : pin.label.slice(0, 14)}
      </Text>
    </Animated.View>
  );
});

type Props = {
  pins: PlannerPin[];
  /** Keys of chosen stops, in order. */
  stopKeys: string[];
  home?: PlannerPin | null;
  accent: string;
  onTogglePin: (key: string) => void;
  bottomInset: number;
};

export function PlannerMap({ pins, stopKeys, home, accent, onTogglePin, bottomInset }: Props) {
  const { c, glass } = useOrbitColors();
  const maps = loadMaps();
  const ref = useRef<MapRef | null>(null);
  const byKey = new Map(pins.map((p) => [p.key, p]));
  const stops = stopKeys.map((k) => byKey.get(k)).filter(Boolean) as PlannerPin[];
  const routePts = [...(home ? [home] : []), ...stops].map(rn);
  const fitSig = stops.map((s) => s.key).join('|');

  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    if (stops.length === 1) {
      m.animateToRegion({ ...rn(stops[0]!), latitudeDelta: 0.03, longitudeDelta: 0.03 }, 450);
    } else if (stops.length >= 2) {
      m.fitToCoordinates(routePts, {
        edgePadding: { top: 80, right: 50, bottom: bottomInset + 40, left: 50 },
        animated: true,
      });
    }
  }, [fitSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = home ? [home, ...pins] : pins;
  const center = stops[0] ?? home ?? pins[0];

  if (!maps) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: glass(0.06) }]}>
        <Text style={{ color: c.textMuted, fontSize: 13 }}>Map isn&apos;t available in this build.</Text>
      </View>
    );
  }
  const { MapView, Marker, Polyline } = maps;
  return (
    <MapView
      ref={ref as never}
      style={StyleSheet.absoluteFill}
      showsUserLocation
      initialRegion={
        center
          ? { ...rn(center), latitudeDelta: 0.12, longitudeDelta: 0.12 }
          : { latitude: 45.5017, longitude: -73.5673, latitudeDelta: 0.3, longitudeDelta: 0.3 }
      }>
      {routePts.length >= 2 ? (
        <Polyline coordinates={routePts} strokeColor={accent} strokeWidth={4} lineDashPattern={[1]} />
      ) : null}
      {all.map((pin) => {
        const idx = stopKeys.indexOf(pin.key);
        return (
          <Marker
            key={pin.key}
            coordinate={rn(pin)}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={pin.isHome ? undefined : () => onTogglePin(pin.key)}>
            <PinBubble pin={pin} order={idx >= 0 ? idx + 1 : null} accent={accent} />
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  bubbleText: { fontSize: 12, fontWeight: '700', maxWidth: 110 },
  num: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  numText: { color: '#0B1220', fontSize: 11, fontWeight: '800' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});

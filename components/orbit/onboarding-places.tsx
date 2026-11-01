import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { PlaceMap } from '@/components/orbit/place-map';
import { typography } from '@/constants/orbit-theme';
import type { DraftPlace } from '@/lib/onboarding/setup-draft';
import { formatUsCaAddress } from '@/lib/places/address-format';
import { getCurrentCoords } from '@/lib/places/nearby-stores';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import * as Location from 'expo-location';

type Props = {
  places: DraftPlace[];
  onChange: (places: DraftPlace[]) => void;
  onContinue: () => void;
  onSkip: () => void;
  accent: string;
};

function upsert(places: DraftPlace[], next: DraftPlace): DraftPlace[] {
  const rest = places.filter((p) => p.kind !== next.kind);
  if (!next.address.trim() && next.kind !== 'home') return rest;
  return [...rest, next];
}

export function OnboardingPlaces({ places, onChange, onContinue, onSkip, accent }: Props) {
  const { c } = useOrbitColors();
  const home = places.find((p) => p.kind === 'home');
  const [address, setAddress] = useState(home?.address ?? '');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(
    home?.lat != null && home?.lng != null ? { lat: home.lat, lng: home.lng } : null
  );
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const [extraKind, setExtraKind] = useState<'school' | 'shop' | 'clothing' | null>(null);
  const [extraAddress, setExtraAddress] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLocating(true);
    void getCurrentCoords({ requestIfNeeded: true }).then(async (coords) => {
      if (cancelled) return;
      setLocating(false);
      if (!coords) {
        setDenied(true);
        return;
      }
      setGps(coords);
      if (!address.trim()) {
        try {
          const rows = await Location.reverseGeocodeAsync({
            latitude: coords.lat,
            longitude: coords.lng,
          });
          const place = rows[0];
          const formatted = place
            ? formatUsCaAddress({
                countryCode: place.isoCountryCode,
                houseNumber: place.streetNumber,
                road: place.street,
                city: place.city,
                region: place.region,
                postcode: place.postalCode,
              })
            : '';
          if (formatted) {
            setAddress(formatted);
            onChange(
              upsert(places, {
                kind: 'home',
                name: 'Home',
                address: formatted,
                lat: coords.lat,
                lng: coords.lng,
              })
            );
          }
        } catch {
          /* typed address still works */
        }
      }
    });
    return () => {
      cancelled = true;
    };
    // First mount only — do not re-request GPS as they type.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveHome = (nextAddress: string, coords = gps) => {
    setAddress(nextAddress);
    onChange(
      upsert(places, {
        kind: 'home',
        name: 'Home',
        address: nextAddress,
        lat: coords?.lat,
        lng: coords?.lng,
      })
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={[typography.title1, { color: c.text }]}>Where is home?</Text>
      <Text style={[typography.footnote, { color: c.textMuted, lineHeight: 20 }]}>
        The map follows you. Poppins uses this GPS to find nearby grocery and clothing stores,
        and to ask before redirecting you when a list item is on an in-store deal. You can skip.
      </Text>
      <PlaceMap
        height={168}
        locating={locating && !gps}
        permissionDenied={denied}
        userLocation={gps}
        markers={
          gps
            ? [{ id: 'home', title: 'Home', lat: gps.lat, lng: gps.lng, color: '#38BDF8' }]
            : []
        }
      />
      <OrbitInput
        label="Home address"
        value={address}
        onChangeText={saveHome}
        placeholder="Street, city"
      />
      <View style={styles.chipRow}>
        {([
          { id: 'school' as const, label: 'School' },
          { id: 'shop' as const, label: 'Grocery' },
          { id: 'clothing' as const, label: 'Clothing store' },
        ]).map((chip) => (
          <Pressable
            key={chip.id}
            onPress={() => setExtraKind(chip.id)}
            style={[
              styles.chip,
              {
                borderColor: extraKind === chip.id ? accent : 'rgba(255,255,255,0.12)',
                backgroundColor: extraKind === chip.id ? `${accent}22` : 'transparent',
              },
            ]}>
            <Text style={{ color: extraKind === chip.id ? accent : c.textMuted, fontWeight: '700' }}>
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {extraKind ? (
        <OrbitInput
          label={extraKind === 'school' ? 'School' : extraKind === 'clothing' ? 'Clothing store' : 'Grocery store'}
          value={extraAddress}
          onChangeText={(value) => {
            setExtraAddress(value);
            onChange(
              upsert(places, {
                kind: extraKind,
                name:
                  extraKind === 'school'
                    ? 'School'
                    : extraKind === 'clothing'
                      ? 'Clothing'
                      : 'Grocery',
                address: value,
              })
            );
          }}
          placeholder="Optional address"
        />
      ) : null}
      <OrbitButton onPress={onContinue} disabled={!address.trim() && !gps}>
        Continue
      </OrbitButton>
      <Pressable onPress={onSkip} style={styles.skip}>
        <Text style={{ color: c.textSubtle, fontWeight: '600' }}>Skip for now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  skip: { alignItems: 'center', paddingVertical: 8 },
});

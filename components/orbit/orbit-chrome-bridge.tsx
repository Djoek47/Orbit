import { StatusBar } from 'expo-status-bar';

import { NearShopWatcher } from '@/components/orbit/near-shop-watcher';
import { PoppinsInPlaceSheet } from '@/components/orbit/poppins-in-place-sheet';
import { useOrbit } from '@/store/orbit-store';

/** Bridges orbitPalette → StatusBar + near-shop watcher inside OrbitProvider. */
export function OrbitChromeBridge() {
  const { orbitPalette } = useOrbit();
  return (
    <>
      <StatusBar
        backgroundColor={orbitPalette.background}
        style={orbitPalette.isDark ? 'light' : 'dark'}
      />
      <NearShopWatcher />
      <PoppinsInPlaceSheet />
    </>
  );
}

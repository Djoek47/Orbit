import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import type { ReactNode } from 'react';

import { useOrbit } from '@/store/orbit-store';

/** Drives React Navigation theme from Orbit palette day/night, not raw OS. */
export function OrbitNavTheme({ children }: { children: ReactNode }) {
  const { orbitPalette } = useOrbit();
  return (
    <ThemeProvider value={orbitPalette.isDark ? DarkTheme : DefaultTheme}>{children}</ThemeProvider>
  );
}

import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';

const MARKS = {
  apple: require('@/assets/brand/maps/apple-maps.png'),
  google: require('@/assets/brand/maps/google-maps.png'),
  waze: require('@/assets/brand/maps/waze.png'),
} as const;

export type MapsAppMarkId = keyof typeof MARKS;

export function MapsAppMark({ app, size = 18 }: { app: MapsAppMarkId | 'auto'; size?: number }) {
  if (app === 'auto') {
    return (
      <View style={[styles.auto, { width: size, height: size, borderRadius: size / 5 }]}>
        <Text style={[styles.autoText, { fontSize: Math.max(8, size * 0.38) }]}>A</Text>
      </View>
    );
  }
  return (
    <Image
      source={MARKS[app]}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityLabel={app === 'apple' ? 'Apple Maps' : app === 'google' ? 'Google Maps' : 'Waze'}
    />
  );
}

const styles = StyleSheet.create({
  auto: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoText: { fontWeight: '700', color: '#EEF2FF' },
});

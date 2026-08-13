import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';

import { Avatar } from '@/components/orbit/avatar';
import { AppText as Text } from '@/components/orbit/app-text';
import { isAvatarImageUri } from '@/lib/game-levels';
import type { IuiFace } from '@/lib/poppins/ui-scenes';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  faces: IuiFace[];
  selectedName?: string;
  /** Pulse only while this name is the spoken token. */
  pulsingName?: string;
  onSelect?: (name: string) => void;
  accent: string;
};

export function IuiFaces({ faces, selectedName, pulsingName, onSelect, accent }: Props) {
  const { c } = useOrbitColors();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!pulsingName) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(withTiming(1.06, { duration: 700 }), 4, true);
  }, [pulse, pulsingName]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={styles.row}>
      {faces.slice(0, 3).map((face) => {
        const selected = selectedName ? face.name === selectedName : faces.length === 1;
        const pulsing = pulsingName ? face.name === pulsingName : false;
        return (
          <Animated.View
            key={face.id}
            entering={FadeIn.duration(280)}
            style={pulsing ? pulseStyle : undefined}>
            <Pressable
              onPress={() => onSelect?.(face.name)}
              accessibilityRole="button"
              accessibilityLabel={face.name}
              style={styles.item}>
              <View
                style={[
                  styles.ring,
                  { borderColor: selected ? accent : 'transparent' },
                ]}>
                <Avatar
                  name={face.name}
                  emoji={face.emoji}
                  imageUri={isAvatarImageUri(face.imageUri) ? face.imageUri : undefined}
                  size="l"
                />
              </View>
              <Text style={[styles.name, { color: c.text }]}>{face.name}</Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  item: { alignItems: 'center', gap: 8 },
  ring: {
    borderRadius: 999,
    borderWidth: 2,
    padding: 3,
  },
  name: { fontSize: 13, fontWeight: '600' },
});

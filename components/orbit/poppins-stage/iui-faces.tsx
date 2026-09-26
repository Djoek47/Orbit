import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

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

  // Never render an empty row: a card waiting for "who" with nobody to pick looks frozen.
  if (!faces.length) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: c.textMuted }]}>No one to assign to yet.</Text>
        <Pressable
          onPress={() => router.push('/household-members' as never)}
          accessibilityRole="button"
          accessibilityLabel="Add someone to the household"
          hitSlop={8}
          style={[styles.emptyBtn, { borderColor: `${accent}66` }]}>
          <MaterialIcons name="person-add-alt" size={16} color={accent} />
          <Text style={[styles.emptyBtnText, { color: c.text }]}>Add someone</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {faces.map((face) => {
        const selected = selectedName ? face.name === selectedName : faces.length === 1;
        const pulsing = pulsingName ? face.name === pulsingName : false;
        return (
          <Animated.View key={face.id} style={pulsing ? pulseStyle : undefined}>
            <Pressable
              onPress={() => onSelect?.(face.name)}
              accessibilityRole="button"
              accessibilityLabel={face.name}
              accessibilityState={{ selected }}
              style={styles.item}>
              <View style={[styles.ring, { borderColor: selected ? accent : 'transparent' }]}>
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
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  item: { alignItems: 'center', gap: 8, minWidth: 44, minHeight: 44 },
  ring: {
    borderRadius: 999,
    borderWidth: 2,
    padding: 3,
  },
  name: { fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 6 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600' },
});

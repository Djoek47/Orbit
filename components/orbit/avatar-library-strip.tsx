/**
 * Horizontal strip of saved Playground / photo faces for You + Make character.
 */
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { typography } from '@/constants/orbit-theme';
import type { AvatarLibraryEntry } from '@/lib/profile/avatar-library';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  entries: AvatarLibraryEntry[];
  selectedUri?: string | null;
  accent: string;
  onSelect: (uri: string) => void;
  emptyHint?: string;
};

export function AvatarLibraryStrip({
  entries,
  selectedUri,
  accent,
  onSelect,
  emptyHint,
}: Props) {
  const { c, glass, glassBorder } = useOrbitColors();
  const border = glassBorder(0.1);

  if (!entries.length) {
    if (!emptyHint) return null;
    return (
      <Text style={[typography.caption1, { color: c.textSubtle, marginTop: 4 }]}>{emptyHint}</Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[typography.eyebrow, { color: c.textSubtle, marginBottom: 8 }]}>
        Your gallery
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {entries.map((entry) => {
          const selected = selectedUri === entry.uri;
          return (
            <Pressable
              key={entry.id}
              onPress={() => onSelect(entry.uri)}
              accessibilityRole="button"
              accessibilityLabel="Use saved picture"
              style={[
                styles.thumbWrap,
                {
                  borderColor: selected ? accent : border,
                  backgroundColor: glass(0.05),
                },
              ]}>
              <Image source={{ uri: entry.uri }} style={styles.thumb} contentFit="cover" />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  row: { gap: 10, paddingRight: 8 },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: '100%' },
});

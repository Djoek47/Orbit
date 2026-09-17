import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { typography } from '@/constants/orbit-theme';
import { listBrowseCategories, type BrowseCategory } from '@/lib/grocery/catalog';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  onSelect: (browse: BrowseCategory) => void;
};

export function GroceryCategoryGrid({ onSelect }: Props) {
  const { c, glass, glassBorder } = useOrbitColors();
  const cats = listBrowseCategories().filter((b) => b.id !== 'other');

  return (
    <View style={styles.grid}>
      {cats.map((cat) => (
        <Pressable
          key={cat.id}
          onPress={() => onSelect(cat)}
          style={[
            styles.cell,
            {
              backgroundColor: glass(0.06),
              borderColor: glassBorder(0.1),
            },
          ]}>
          <Text style={styles.icon}>{cat.icon}</Text>
          <Text
            style={[typography.caption1, { color: c.text, fontWeight: '600', textAlign: 'center' }]}
            numberOfLines={2}>
            {cat.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: '31%',
    flexGrow: 1,
    minWidth: 96,
    maxWidth: '33%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
  },
  icon: { fontSize: 22 },
});

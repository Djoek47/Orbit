import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { radius, space } from '@/constants/orbit-theme';
import { groupByAisle } from '@/lib/grocery/classify';
import { useOrbit } from '@/store/orbit-store';

const KEEP_AWAKE_TAG = 'shopping-mode';

/**
 * Revision C §4.4 — aisle shopping view: group by aisle, hide empty cats,
 * header "N left", keep screen awake, large thumb targets.
 */
export default function ShoppingModeScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, household, orbitPalette, markGroceryPurchased } = useOrbit();

  useEffect(() => {
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, []);

  const items = useMemo(
    () => household.groceries.filter((g) => g.status === 'Missing' || g.status === 'Low'),
    [household.groceries]
  );

  const aisles = useMemo(() => groupByAisle(items), [items]);
  const left = items.length;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16,
            backgroundColor: orbitPalette.background,
          },
        ]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={20} color={orbitPalette.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ChoremaxxBadge size="sm" />
            <Text style={[styles.title, { color: orbitPalette.text }]}>Shopping</Text>
          </View>
          <Text style={[styles.leftCount, { color: accentTheme.primary }]}>
            {left} left
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {left === 0 ? (
            <Text style={[styles.empty, { color: orbitPalette.textMuted }]}>
              List is clear. Nice work.
            </Text>
          ) : (
            aisles.map((aisle) => (
              <View key={aisle.categoryId} style={styles.aisleBlock}>
                <View style={styles.aisleHead}>
                  <Text style={[styles.aisleTitle, { color: orbitPalette.textMuted }]}>
                    {aisle.categoryName.toUpperCase()}
                  </Text>
                  <Text style={[styles.aisleCount, { color: orbitPalette.textSubtle }]}>
                    {aisle.items.length}
                  </Text>
                </View>
                {aisle.items.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => void markGroceryPurchased(item.id)}
                    style={[
                      styles.row,
                      {
                        backgroundColor: orbitPalette.card,
                        borderColor: orbitPalette.border,
                      },
                    ]}>
                    <View style={[styles.check, { borderColor: accentTheme.primary }]}>
                      <MaterialIcons
                        name="check-box-outline-blank"
                        size={28}
                        color={accentTheme.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: orbitPalette.text }]}>
                        {item.name}
                      </Text>
                      {item.quantity && item.quantity !== '1' ? (
                        <Text style={[styles.qty, { color: orbitPalette.textMuted }]}>
                          {item.quantity}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.lg },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.md,
  },
  back: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  title: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  leftCount: { fontSize: 16, fontWeight: '800' },
  list: { gap: space.md, paddingBottom: space.xl },
  aisleBlock: { gap: space.sm },
  aisleHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  aisleTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  aisleCount: { fontSize: 12, fontWeight: '700' },
  row: {
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: space.md,
    minHeight: 64,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  check: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 0,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  itemName: { fontSize: 18, fontWeight: '700' },
  qty: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  empty: { fontSize: 16, marginTop: 40, textAlign: 'center' },
});

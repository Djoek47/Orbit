import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { radius, space } from '@/constants/orbit-theme';
import { DEFAULT_POPPINS_NOTIFICATION_PREFS } from '@/services/poppins-notifications';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

/**
 * Simplified shopping-only list — large checkboxes, no add/budget chrome.
 * Used near the store or from an itinerary grocery stop.
 */
export default function ShoppingModeScreen() {
  const insets = useSafeAreaInsets();
  const {
    accentTheme,
    household,
    orbitPalette,
    pushNotification,
    markGroceryPurchased,
  } = useOrbit();
  const [hintDismissed, setHintDismissed] = useState(false);

  const items = useMemo(
    () =>
      household.groceries.filter((g) => g.status === 'Missing' || g.status === 'Low'),
    [household.groceries]
  );

  const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;

  const suggestAdd = async () => {
    if (!prefs.missingOnTheWay) return;
    await pushNotification({
      title: 'Poppins · Add before you leave?',
      body: 'Anything else for the cart? Open add item if you remember something.',
      category: 'groceries',
      priority: 'low',
      data: { kind: 'shopping_mode_prompt', href: '/add-grocery' },
    });
  };

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
          <Pressable onPress={() => router.back()} style={styles.back}>
            <MaterialIcons name="arrow-back" size={20} color={orbitPalette.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ChoremaxxBadge size="sm" />
            <Text style={[styles.title, { color: orbitPalette.text }]}>Shopping mode</Text>
            <Text style={[styles.sub, { color: orbitPalette.textMuted }]}>
              Check off as you go · {items.length} left
            </Text>
          </View>
        </View>

        {!hintDismissed && prefs.missingOnTheWay ? (
          <Pressable
            style={[styles.banner, { borderColor: `${accentTheme.primary}55` }]}
            onPress={() => {
              setHintDismissed(true);
              void suggestAdd();
              router.push('/add-grocery' as never);
            }}>
            <MaterialIcons name="add-circle-outline" size={18} color={accentTheme.primary} />
            <Text style={[styles.bannerText, { color: accentTheme.primary }]}>
              Remember something? Add it before or during this run
            </Text>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                setHintDismissed(true);
              }}
              hitSlop={8}>
              <MaterialIcons name="close" size={16} color={orbitPalette.textMuted} />
            </Pressable>
          </Pressable>
        ) : null}

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <Text style={[styles.empty, { color: orbitPalette.textMuted }]}>
              List is clear. Nice work.
            </Text>
          ) : (
            items.map((item) => (
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
                <View
                  style={[
                    styles.check,
                    { borderColor: accentTheme.primary },
                  ]}>
                  <MaterialIcons name="check-box-outline-blank" size={28} color={accentTheme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: orbitPalette.text }]}>{item.name}</Text>
                  <Text style={[styles.meta, { color: orbitPalette.textMuted }]}>
                    {item.category}
                    {item.quantity ? ` · ${item.quantity}` : ''}
                    {item.status === 'Low' ? ' · Low' : ''}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>

        <OrbitButton tone="secondary" onPress={() => router.push('/(tabs)/groceries' as never)}>
          Full grocery list
        </OrbitButton>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: space.md,
    paddingHorizontal: space.xl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
  },
  back: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  sub: {
    fontSize: 13,
    marginTop: 2,
  },
  banner: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  empty: {
    fontSize: 15,
    paddingVertical: 40,
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    borderRadius: radius.cardLarge,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  check: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
});

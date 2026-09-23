/**
 * Shopping mode — HTML bible × ChoreMaxx amber glass.
 * Checked items stay in-aisle (fade + strike) with undo toast.
 */

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Alert, LayoutAnimation, Platform, StyleSheet, UIManager, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { ShoppingAisleSection } from '@/components/orbit/grocery/shopping-aisle-section';
import { ShoppingDock } from '@/components/orbit/grocery/shopping-dock';
import { ShoppingRunHeader } from '@/components/orbit/grocery/shopping-run-header';
import { ShoppingUndoToast } from '@/components/orbit/grocery/shopping-undo-toast';
import { typography } from '@/constants/orbit-theme';
import { classifyGroceryItem, groupByAisle } from '@/lib/grocery/classify';
import {
  groupShoppingAisles,
  resolveShoppingPalette,
  shoppingProgress,
  shoppingRunLabel,
  type ShoppingListItem,
} from '@/lib/grocery/shopping-palette';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

const KEEP_AWAKE_TAG = 'shopping-mode';
const TOAST_MS = 2600;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ShoppingModeScreen() {
  const insets = useSafeAreaInsets();
  const { c, isDark } = useOrbitColors();
  const {
    household,
    markGroceryPurchased,
    markGroceryMissing,
    addMissingGrocery,
    canAddGroceryWishlist,
  } = useOrbit();

  const palette = useMemo(() => resolveShoppingPalette(c, isDark), [c, isDark]);
  const runLabel = useMemo(() => shoppingRunLabel(), []);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [toast, setToast] = useState<{ id: string; name: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastToggled = useRef<string | null>(null);

  useEffect(() => {
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const listItems: ShoppingListItem[] = useMemo(
    () =>
      household.groceries
        .filter(
          (g) => g.status === 'Missing' || g.status === 'Low' || g.status === 'Purchased'
        )
        .map((g) => ({
          id: g.id,
          name: g.name,
          quantity: g.quantity,
          category: g.category || 'Other',
          categoryId: g.categoryId,
          done: g.status === 'Purchased',
        })),
    [household.groceries]
  );

  const aisles = useMemo(
    () => groupShoppingAisles(listItems, groupByAisle),
    [listItems]
  );
  const progress = useMemo(() => shoppingProgress(listItems), [listItems]);

  const guessLabel = useMemo(() => {
    const v = draft.trim();
    if (v.length < 2) return null;
    return classifyGroceryItem(v, household.groceryCategoryOverrides).categoryName;
  }, [draft, household.groceryCategoryOverrides]);

  const clearToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback(
    (id: string, name: string) => {
      lastToggled.current = id;
      setToast({ id, name });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
    },
    []
  );

  const toggleItem = useCallback(
    async (id: string) => {
      const item = listItems.find((i) => i.id === id);
      if (!item) return;
      if (!reduceMotion) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      try {
        if (item.done) {
          await markGroceryMissing(id);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          clearToast();
        } else {
          await markGroceryPurchased(id);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          showToast(id, item.name);
        }
      } catch {
        // store handles permissions; ignore
      }
    },
    [listItems, markGroceryMissing, markGroceryPurchased, reduceMotion, clearToast, showToast]
  );

  const undo = useCallback(() => {
    const id = lastToggled.current;
    if (!id) return;
    clearToast();
    void toggleItem(id);
  }, [clearToast, toggleItem]);

  const addItem = useCallback(async () => {
    if (!draft.trim() || !canAddGroceryWishlist) return;
    setBusy(true);
    try {
      await addMissingGrocery({ name: draft.trim() });
      setDraft('');
      if (!reduceMotion) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
    } catch (error) {
      Alert.alert(
        'Could not add item',
        error instanceof Error ? error.message : 'Try again.'
      );
    } finally {
      setBusy(false);
    }
  }, [addMissingGrocery, canAddGroceryWishlist, draft, reduceMotion]);

  const dockBottom = Math.max(insets.bottom, 12) + 8;
  const toastBottom = dockBottom + 72;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.root, { backgroundColor: palette.canvas, paddingTop: insets.top }]}>
        {/* Ambient washes so amber glass has something to catch */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View
            style={[
              styles.wash,
              {
                top: -40,
                left: -60,
                backgroundColor: palette.ambientA,
              },
            ]}
          />
          <View
            style={[
              styles.wash,
              {
                bottom: 80,
                right: -40,
                backgroundColor: palette.ambientB,
                width: 220,
                height: 220,
              },
            ]}
          />
        </View>

        <ShoppingRunHeader
          palette={palette}
          runLabel={runLabel}
          left={progress.left}
          done={progress.done}
          total={progress.total}
          ratio={progress.ratio}
          onBack={() => router.back()}
        />

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled">
          {progress.total === 0 ? (
            <View style={styles.empty}>
              <Text style={[typography.title3, { color: palette.inkMuted }]}>
                Nothing on the list
              </Text>
              <Text style={[typography.body, { color: palette.inkFaint, textAlign: 'center', marginTop: 6 }]}>
                Type what you need below. It files itself into the right aisle.
              </Text>
            </View>
          ) : (
            aisles.map((aisle) => (
              <ShoppingAisleSection
                key={aisle.categoryId}
                aisle={aisle}
                palette={palette}
                collapsed={collapsed.has(aisle.categoryId)}
                reduceMotion={reduceMotion}
                onToggleCollapse={() => {
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(aisle.categoryId)) next.delete(aisle.categoryId);
                    else next.add(aisle.categoryId);
                    return next;
                  });
                }}
                onToggleItem={(id) => void toggleItem(id)}
              />
            ))
          )}
        </ScrollView>

        <ShoppingUndoToast
          palette={palette}
          visible={Boolean(toast)}
          message={toast ? `${toast.name} in the cart` : ''}
          bottomOffset={toastBottom}
          onUndo={undo}
        />

        {canAddGroceryWishlist ? (
          <ShoppingDock
            palette={palette}
            value={draft}
            guessLabel={guessLabel}
            bottomInset={insets.bottom}
            busy={busy}
            onChangeText={setDraft}
            onAdd={() => void addItem()}
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  wash: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.55,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 160 },
  empty: { paddingTop: 56, paddingHorizontal: 26, alignItems: 'center' },
});

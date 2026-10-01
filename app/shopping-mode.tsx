/**
 * Shopping mode — HTML bible × ChoreMaxx amber glass.
 * Checked items stay in-aisle (fade + strike) with undo toast.
 */

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import {
  AccessibilityInfo,
  Alert,
  AppState,
  LayoutAnimation,
  Platform,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
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
import {
  shoppingBannerAvailable,
  startShoppingBanner,
  stopShoppingBanner,
  updateShoppingBanner,
} from '@/lib/grocery/shopping-live-activity';
import { drainLockScreenCheckOffs } from '@/modules/shopping-banner-bridge';
import { iconForGroceryName } from '@/lib/grocery/catalog';
import { loadShoppingBannerEnabled, saveShoppingBannerEnabled } from '@/lib/grocery/shopping-banner-pref';
import { ShoppingAmbient } from '@/components/orbit/grocery/shopping-ambient';
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

  // Lock Screen check-offs land in the App Group; pull them into the grocery list when the
  // run is open or the app comes back to the foreground.
  const applyLockScreenCheckOffs = useCallback(() => {
    const ids = drainLockScreenCheckOffs();
    if (!ids.length) return;
    for (const id of ids) {
      const item = listItems.find((row) => row.id === id);
      if (!item || item.done) continue;
      void markGroceryPurchased(id);
    }
  }, [listItems, markGroceryPurchased]);

  useEffect(() => {
    applyLockScreenCheckOffs();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') applyLockScreenCheckOffs();
    });
    const tick = setInterval(applyLockScreenCheckOffs, 2500);
    return () => {
      sub.remove();
      clearInterval(tick);
    };
  }, [applyLockScreenCheckOffs]);

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

  // The Lock Screen / Dynamic Island banner: the same list, in the same order, that stays
  // put when you leave the app so it's there at the store. It ends when the run does, or
  // when you tap End run.
  const nextAisle = aisles.find((aisle) => aisle.items.some((item) => !item.done))?.categoryName;
  // Each line leads with the item's emoji, the same one the list shows — and carries the
  // grocery id so a Lock Screen tap can check it off without opening the app.
  const remainingItems = useMemo(
    () =>
      aisles.flatMap((aisle) =>
        aisle.items
          .filter((item) => !item.done)
          .map((item) => ({
            id: item.id,
            label: `${iconForGroceryName(item.name, item.categoryId)} ${item.name}`,
          }))
      ),
    [aisles]
  );
  const bannerRun = useMemo(
    () => ({
      done: progress.done,
      total: progress.total,
      nextAisle,
      runLabel,
      remainingItems,
    }),
    [progress.done, progress.total, nextAisle, runLabel, remainingItems]
  );
  const started = useRef(false);
  // The Lock Screen switch. Off means no banner at all for this run and the next.
  const [bannerEnabled, setBannerEnabled] = useState(true);
  useEffect(() => {
    void loadShoppingBannerEnabled().then(setBannerEnabled);
  }, []);
  const toggleBanner = useCallback(() => {
    setBannerEnabled((on) => {
      const next = !on;
      void saveShoppingBannerEnabled(next);
      if (!next && started.current) {
        stopShoppingBanner();
        started.current = false;
      }
      void Haptics.selectionAsync();
      return next;
    });
  }, []);

  useEffect(() => {
    if (bannerRun.total === 0 || !bannerEnabled) return;
    if (!started.current) {
      started.current = true;
      startShoppingBanner(bannerRun, palette.accent);
      return;
    }
    updateShoppingBanner(bannerRun);
  }, [bannerRun, palette.accent, bannerEnabled]);

  // Everything picked up: the banner has done its job.
  useEffect(() => {
    if (started.current && progress.total > 0 && progress.done >= progress.total) {
      stopShoppingBanner(bannerRun);
      started.current = false;
    }
  }, [bannerRun, progress.done, progress.total]);

  const endRun = useCallback(() => {
    stopShoppingBanner(bannerRun);
    started.current = false;
    router.back();
  }, [bannerRun]);

  const dockBottom = Math.max(insets.bottom, 12) + 8;
  const toastBottom = dockBottom + 72;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.root, { backgroundColor: palette.canvas, paddingTop: insets.top }]}>
        <ShoppingAmbient palette={palette} reduceMotion={reduceMotion} />

        <ShoppingRunHeader
          palette={palette}
          runLabel={runLabel}
          left={progress.left}
          done={progress.done}
          total={progress.total}
          ratio={progress.ratio}
          onBack={() => router.back()}
          onEndRun={endRun}
          bannerOn={bannerEnabled && shoppingBannerAvailable() && progress.total > 0}
          lockScreen={
            shoppingBannerAvailable()
              ? { on: bannerEnabled, onToggle: toggleBanner }
              : undefined
          }
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
  list: { flex: 1 },
  listContent: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 160 },
  empty: { paddingTop: 56, paddingHorizontal: 26, alignItems: 'center' },
});

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrbitInput } from '@/components/orbit/orbit-input';
import { ProductBarcodeScanner } from '@/components/orbit/product-barcode-scanner';
import { orbitColors } from '@/constants/orbit-theme';
import { lookupProductByBarcode, searchProducts } from '@/data/mock-products';
import { fetchOpenFoodFactsProduct } from '@/lib/grocery/open-food-facts';
import { useOrbit } from '@/store/orbit-store';
import type { ProductCatalogItem } from '@/types/orbit';

function nutriTone(score?: string) {
  const grade = score?.toUpperCase();
  if (grade === 'A' || grade === 'B') return orbitColors.success;
  if (grade === 'C') return orbitColors.rankGold;
  if (grade === 'D' || grade === 'E') return orbitColors.danger;
  return orbitColors.textMuted;
}

export default function ScanGroceryScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, addMissingGrocery, canAddGroceryWishlist, preferredStore } = useOrbit();
  const [scanning, setScanning] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [query, setQuery] = useState('');
  const [product, setProduct] = useState<ProductCatalogItem | null>(null);
  const [message, setMessage] = useState('');
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);

  const results = searchProducts(query).slice(0, 6);

  const applyProduct = (item: ProductCatalogItem) => {
    setProduct(item);
    setScanning(false);
    setLookingUp(false);
    setMessage('');
  };

  const handleBarcode = async (code: string) => {
    setLastBarcode(code);
    setLookingUp(true);
    setMessage('');

    const local = lookupProductByBarcode(code);
    if (local) {
      applyProduct({ ...local, source: local.source ?? 'mock' });
      return;
    }

    const remote = await fetchOpenFoodFactsProduct(code);
    if (remote) {
      applyProduct(remote);
      return;
    }

    setScanning(false);
    setLookingUp(false);
    setProduct({
      barcode: code,
      name: `Unknown product (${code})`,
      brand: 'Not in Open Food Facts',
      category: 'Other',
      typicalPrice: 0,
      size: '1 item',
      source: 'unknown',
      ingredients: undefined,
      allergens: [],
      nutriScore: undefined,
      novaGroup: undefined,
    });
    setMessage(`No Open Food Facts match for ${code}. You can still Add to cart and edit details later.`);
    setQuery(code);
  };

  const handleAdd = () => {
    if (!product) return;
    if (!canAddGroceryWishlist) {
      setMessage('Earn more XP before adding wishlist items.');
      return;
    }
    addMissingGrocery({
      name: product.name,
      category: product.category,
      barcode: product.barcode,
      quantity: product.size ?? '1 item',
      typicalPrice: product.typicalPrice,
      salePrice: product.salePrice,
      aisle: product.aisle,
      storeId: product.storeId ?? preferredStore.id,
      note: [
        product.nutriScore ? `Nutri-Score ${product.nutriScore}` : null,
        product.allergens?.length ? `Allergens: ${product.allergens.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
    });
    router.back();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.handle} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <MaterialIcons name="close" size={18} color={orbitColors.textMuted} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Grocery intelligence</Text>
          <Text style={styles.title}>Scan product</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Preferred store: {preferredStore.name}</Text>

        {scanning ? (
          <View style={styles.scannerCard}>
            <ProductBarcodeScanner
              onCode={(code) => void handleBarcode(code)}
              onClose={() => setScanning(false)}
            />
          </View>
        ) : (
          <Pressable
            onPress={() => {
              setScanning(true);
              setMessage('');
            }}
            style={styles.secondaryBtn}>
            <MaterialIcons name="qr-code-scanner" size={18} color={orbitColors.novaCyan} />
            <Text style={[styles.secondaryText, { color: orbitColors.novaCyan }]}>Open scanner</Text>
          </Pressable>
        )}

        {lookingUp ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={accentTheme.primary} />
            <Text style={styles.loadingText}>Looking up {lastBarcode}…</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <OrbitInput label="Search catalog" value={query} onChangeText={setQuery} placeholder="Milk, cereal, UPC…" />
          {results.map((item) => (
            <Pressable key={item.barcode} onPress={() => applyProduct({ ...item, source: 'mock' })} style={styles.resultRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultMeta}>
                  {item.brand ?? 'Generic'} · ${item.typicalPrice.toFixed(2)}
                  {item.salePrice != null ? ' · On sale' : ''}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={orbitColors.textSubtle} />
            </Pressable>
          ))}
        </View>

        {product ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              {product.imageUrl ? (
                <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
              ) : (
                <View style={[styles.productImage, styles.productImageFallback]}>
                  <MaterialIcons name="shopping-bag" size={28} color={accentTheme.primary} />
                </View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.resultMeta}>
                  {product.brand ?? 'Generic'} · {product.size ?? '—'}
                  {product.aisle ? ` · Aisle ${product.aisle}` : ''}
                </Text>
                <Text style={[styles.price, { color: accentTheme.primary }]}>
                  {product.salePrice != null
                    ? `$${product.salePrice.toFixed(2)} (was $${product.typicalPrice.toFixed(2)})`
                    : `$${product.typicalPrice.toFixed(2)} est.`}
                </Text>
                {product.source === 'openfoodfacts' ? (
                  <Text style={styles.source}>Open Food Facts</Text>
                ) : product.source === 'unknown' ? (
                  <Text style={styles.source}>Unknown barcode · add anyway</Text>
                ) : (
                  <Text style={styles.source}>Mock catalog</Text>
                )}
              </View>
            </View>

            <View style={styles.qualityRow}>
              <View style={styles.qualityChip}>
                <Text style={styles.qualityLabel}>Nutri-Score</Text>
                <Text style={[styles.qualityValue, { color: nutriTone(product.nutriScore) }]}>
                  {product.nutriScore ?? '—'}
                </Text>
              </View>
              <View style={styles.qualityChip}>
                <Text style={styles.qualityLabel}>NOVA</Text>
                <Text style={styles.qualityValue}>{product.novaGroup ?? '—'}</Text>
              </View>
              <View style={[styles.qualityChip, { flex: 1.4 }]}>
                <Text style={styles.qualityLabel}>Allergens</Text>
                <Text style={styles.qualityValue} numberOfLines={2}>
                  {product.allergens?.length ? product.allergens.join(', ') : 'None listed'}
                </Text>
              </View>
            </View>

            {product.ingredients ? (
              <View style={styles.ingredientsBox}>
                <Text style={styles.qualityLabel}>Ingredients</Text>
                <Text style={styles.ingredients}>{product.ingredients}</Text>
              </View>
            ) : null}

            <Pressable onPress={handleAdd} style={styles.ctaWrap}>
              <LinearGradient
                colors={[accentTheme.primary, accentTheme.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cta}>
                <Text style={styles.ctaText}>Add to cart</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Pressable onPress={() => router.push('/add-grocery' as never)} style={styles.secondaryBtn}>
          <Text style={[styles.secondaryText, { color: accentTheme.primary }]}>Add manually</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A1525' },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  kicker: {
    color: orbitColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { color: orbitColors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  content: { padding: 16, gap: 12 },
  subtitle: { color: orbitColors.textSoft, fontSize: 13 },
  scannerCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingText: { color: orbitColors.textMuted, fontSize: 13 },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 14,
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  resultName: { color: orbitColors.text, fontSize: 14, fontWeight: '600' },
  resultMeta: { color: orbitColors.textMuted, fontSize: 12, marginTop: 2 },
  resultCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.25)',
    backgroundColor: 'rgba(6,182,212,0.08)',
    padding: 16,
    gap: 14,
  },
  resultHeader: { flexDirection: 'row', gap: 12 },
  productImage: { width: 72, height: 72, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)' },
  productImageFallback: { alignItems: 'center', justifyContent: 'center' },
  productName: { color: orbitColors.text, fontSize: 17, fontWeight: '800' },
  price: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  source: { color: orbitColors.novaCyan, fontSize: 11, fontWeight: '700' },
  qualityRow: { flexDirection: 'row', gap: 8 },
  qualityChip: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    gap: 4,
  },
  qualityLabel: {
    color: orbitColors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  qualityValue: { color: orbitColors.text, fontSize: 13, fontWeight: '700' },
  ingredientsBox: { gap: 6 },
  ingredients: { color: orbitColors.textSoft, fontSize: 12, lineHeight: 18 },
  ctaWrap: { borderRadius: 18, overflow: 'hidden' },
  cta: { alignItems: 'center', paddingVertical: 14 },
  ctaText: { color: '#04101F', fontWeight: '800', fontSize: 14 },
  message: { color: orbitColors.warning, fontSize: 13, lineHeight: 18 },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secondaryText: { fontSize: 14, fontWeight: '700' },
});

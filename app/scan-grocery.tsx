import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { ProductBarcodeScanner } from '@/components/orbit/product-barcode-scanner';
import { StatusPill } from '@/components/orbit/status-pill';
import { lookupProductByBarcode, searchProducts } from '@/data/mock-products';
import { orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { ProductCatalogItem } from '@/types/orbit';

export default function ScanGroceryScreen() {
  const { addMissingGrocery, canAddGroceryWishlist, preferredStore } = useOrbit();
  const [scanning, setScanning] = useState(true);
  const [query, setQuery] = useState('');
  const [product, setProduct] = useState<ProductCatalogItem | null>(null);
  const [message, setMessage] = useState('');

  const results = searchProducts(query).slice(0, 6);

  const applyProduct = (item: ProductCatalogItem) => {
    setProduct(item);
    setScanning(false);
    setMessage('');
  };

  const handleBarcode = (code: string) => {
    const found = lookupProductByBarcode(code);
    if (found) {
      applyProduct(found);
      return;
    }
    setScanning(false);
    setMessage(`No catalog match for ${code}. Search or add manually.`);
    setQuery(code);
  };

  const handleAdd = () => {
    if (!product) {
      return;
    }
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
    });
    router.back();
  };

  return (
    <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Grocery intelligence</Text>
        <Text style={orbitTypography.display}>Scan product</Text>
        <Text style={orbitTypography.body}>Preferred store: {preferredStore.name}</Text>
      </View>

      {scanning ? (
        <GlassCard>
          <ProductBarcodeScanner onCode={handleBarcode} onClose={() => setScanning(false)} />
        </GlassCard>
      ) : (
        <OrbitButton tone="secondary" onPress={() => setScanning(true)}>
          Open scanner
        </OrbitButton>
      )}

      <GlassCard style={styles.card}>
        <OrbitInput label="Search catalog" value={query} onChangeText={setQuery} placeholder="Milk, cereal, UPC…" />
        {results.map((item) => (
          <OrbitButton key={item.barcode} tone="secondary" onPress={() => applyProduct(item)}>
            {item.name}
            {item.salePrice != null ? ' · On sale' : ''}
          </OrbitButton>
        ))}
      </GlassCard>

      {product ? (
        <GlassCard style={styles.card}>
          <Text style={orbitTypography.cardTitle}>{product.name}</Text>
          <Text style={orbitTypography.caption}>
            {product.brand ?? 'Generic'} · {product.size ?? '—'} · Aisle {product.aisle ?? '—'}
          </Text>
          {product.salePrice != null ? (
            <StatusPill
              label={`On sale $${product.salePrice.toFixed(2)} (was $${product.typicalPrice.toFixed(2)})`}
              tone="green"
            />
          ) : (
            <StatusPill label={`$${product.typicalPrice.toFixed(2)}`} tone="blue" />
          )}
          <OrbitButton onPress={handleAdd}>Add to cart</OrbitButton>
        </GlassCard>
      ) : null}

      {message ? <Text style={orbitTypography.caption}>{message}</Text> : null}
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Cancel
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: orbitSpacing.sm,
  },
});

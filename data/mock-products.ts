import type { ProductCatalogItem } from '@/types/orbit';

/** Mock UPC catalog for Expo Go barcode shopping demos. */
export const MOCK_PRODUCTS: ProductCatalogItem[] = [
  {
    barcode: '041220576015',
    name: 'Organic Whole Milk',
    brand: 'Horizon',
    size: '1/2 gallon',
    category: 'Dairy',
    typicalPrice: 4.99,
    salePrice: 3.79,
    aisle: 'A3',
    storeId: 'store-freshmart',
  },
  {
    barcode: '021130126026',
    name: 'Large Eggs',
    brand: 'Lucerne',
    size: '12 pack',
    category: 'Dairy',
    typicalPrice: 3.49,
    aisle: 'A3',
    storeId: 'store-freshmart',
  },
  {
    barcode: '038000138416',
    name: 'Frosted Flakes',
    brand: 'Kellogg\'s',
    size: '15 oz',
    category: 'Pantry',
    typicalPrice: 4.29,
    salePrice: 2.99,
    aisle: 'B7',
    storeId: 'store-freshmart',
  },
  {
    barcode: '037000847392',
    name: 'Paper Towels',
    brand: 'Bounty',
    size: '6 rolls',
    category: 'Household',
    typicalPrice: 12.99,
    salePrice: 9.99,
    aisle: 'C2',
    storeId: 'store-quickstop',
  },
  {
    barcode: '071230001234',
    name: 'Blueberries',
    brand: 'Driscoll\'s',
    size: '1 pint',
    category: 'Produce',
    typicalPrice: 4.5,
    salePrice: 2.5,
    aisle: 'P1',
    storeId: 'store-freshmart',
  },
  {
    barcode: '028400064215',
    name: 'Greek Yogurt',
    brand: 'Chobani',
    size: '32 oz',
    category: 'Dairy',
    typicalPrice: 5.49,
    aisle: 'A4',
    storeId: 'store-freshmart',
  },
];

export function lookupProductByBarcode(barcode: string): ProductCatalogItem | undefined {
  const normalized = barcode.replace(/\D/g, '');
  return MOCK_PRODUCTS.find(
    (product) => product.barcode === barcode || product.barcode === normalized
  );
}

export function searchProducts(query: string): ProductCatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return MOCK_PRODUCTS;
  }
  return MOCK_PRODUCTS.filter(
    (product) =>
      product.name.toLowerCase().includes(q) ||
      product.brand?.toLowerCase().includes(q) ||
      product.category.toLowerCase().includes(q) ||
      product.barcode.includes(q)
  );
}

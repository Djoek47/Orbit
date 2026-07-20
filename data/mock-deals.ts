export type DealCategory = 'grocery' | 'shoes' | 'electronics' | 'furniture';

export type MockDeal = {
  id: string;
  category: DealCategory;
  title: string;
  store: string;
  typicalPrice: number;
  salePrice: number;
  expiresAt: string;
  keywords: string[];
};

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Mock deal catalog — food + non-food (shoes, electronics, furniture). */
export const MOCK_DEALS: MockDeal[] = [
  {
    id: 'deal-milk',
    category: 'grocery',
    title: 'Organic whole milk 1gal',
    store: 'FreshMart',
    typicalPrice: 5.49,
    salePrice: 3.99,
    expiresAt: daysFromNow(3),
    keywords: ['milk', 'dairy'],
  },
  {
    id: 'deal-berries',
    category: 'grocery',
    title: 'Blueberries 1 pint',
    store: 'FreshMart',
    typicalPrice: 4.5,
    salePrice: 2.5,
    expiresAt: daysFromNow(2),
    keywords: ['blueberry', 'blueberries', 'produce'],
  },
  {
    id: 'deal-paper',
    category: 'grocery',
    title: 'Paper towels 6-pack',
    store: 'QuickStop',
    typicalPrice: 12.99,
    salePrice: 8.99,
    expiresAt: daysFromNow(5),
    keywords: ['paper', 'towels', 'cleaning'],
  },
  {
    id: 'deal-sneakers',
    category: 'shoes',
    title: 'Kids running sneakers',
    store: 'Stride Outlet',
    typicalPrice: 64,
    salePrice: 39,
    expiresAt: daysFromNow(7),
    keywords: ['shoes', 'sneakers', 'kids'],
  },
  {
    id: 'deal-headphones',
    category: 'electronics',
    title: 'Wireless headphones',
    store: 'ByteBarn',
    typicalPrice: 129,
    salePrice: 79,
    expiresAt: daysFromNow(4),
    keywords: ['headphones', 'electronics', 'audio'],
  },
  {
    id: 'deal-desk',
    category: 'furniture',
    title: 'Compact study desk',
    store: 'Nest & Form',
    typicalPrice: 189,
    salePrice: 129,
    expiresAt: daysFromNow(10),
    keywords: ['desk', 'furniture', 'study'],
  },
  {
    id: 'deal-lamp',
    category: 'furniture',
    title: 'LED floor lamp',
    store: 'Nest & Form',
    typicalPrice: 79,
    salePrice: 49,
    expiresAt: daysFromNow(6),
    keywords: ['lamp', 'furniture', 'lighting'],
  },
  {
    id: 'deal-tablet-case',
    category: 'electronics',
    title: 'Tablet protective case',
    store: 'ByteBarn',
    typicalPrice: 34,
    salePrice: 19,
    expiresAt: daysFromNow(3),
    keywords: ['tablet', 'case', 'electronics'],
  },
];

export function scanDealsForHousehold(input: {
  groceryNames: string[];
  categories?: DealCategory[];
}) {
  const names = input.groceryNames.map((n) => n.toLowerCase());
  const cats = input.categories;

  return MOCK_DEALS.filter((deal) => {
    if (cats && !cats.includes(deal.category)) return false;
    if (deal.category === 'grocery') {
      return deal.keywords.some((kw) => names.some((n) => n.includes(kw) || kw.includes(n)));
    }
    // Non-food deals always surface as household opportunities
    return true;
  }).map((deal) => ({
    ...deal,
    savings: Math.round((deal.typicalPrice - deal.salePrice) * 100) / 100,
  }));
}

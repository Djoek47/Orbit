/**
 * Honest US + Canada in-store promo hints until a live research source (Serper) ships.
 * Never invent a live price — these are typical flyer-style matches for list items.
 */

export type InStoreRegion = 'US' | 'CA';

export type InStorePromo = {
  id: string;
  region: InStoreRegion;
  retailer: string;
  item: string;
  brand?: string;
  category: 'grocery' | 'clothing';
  offer: string;
  keywords: string[];
};

const PROMOS: InStorePromo[] = [
  {
    id: 'ca-iga-milk',
    region: 'CA',
    retailer: 'IGA',
    item: 'Milk',
    category: 'grocery',
    offer: 'Often on the weekly flyer as a 4L staple',
    keywords: ['milk', 'lait', '2%', 'whole milk'],
  },
  {
    id: 'ca-maxi-bread',
    region: 'CA',
    retailer: 'Maxi',
    item: 'Bread',
    category: 'grocery',
    offer: 'Store bakery loaves rotate on the in-store deals board',
    keywords: ['bread', 'pain', 'loaf'],
  },
  {
    id: 'us-target-milk',
    region: 'US',
    retailer: 'Target',
    item: 'Milk',
    category: 'grocery',
    offer: 'Good & Gather milk is a frequent in-aisle deal',
    keywords: ['milk'],
  },
  {
    id: 'us-walmart-eggs',
    region: 'US',
    retailer: 'Walmart',
    item: 'Eggs',
    category: 'grocery',
    offer: 'Great Value eggs show up on the rollback rail',
    keywords: ['eggs', 'egg'],
  },
  {
    id: 'us-costco-chicken',
    region: 'US',
    retailer: 'Costco',
    item: 'Chicken',
    brand: 'Kirkland',
    category: 'grocery',
    offer: 'Kirkland chicken is a warehouse-floor staple',
    keywords: ['chicken', 'rotisserie'],
  },
  {
    id: 'ca-costco-chicken',
    region: 'CA',
    retailer: 'Costco',
    item: 'Chicken',
    brand: 'Kirkland',
    category: 'grocery',
    offer: 'Kirkland chicken is a warehouse-floor staple',
    keywords: ['chicken', 'rotisserie', 'poulet'],
  },
  {
    id: 'us-oldnavy-jeans',
    region: 'US',
    retailer: 'Old Navy',
    item: 'Jeans',
    category: 'clothing',
    offer: 'Kids and adult jeans rotate on in-store % off racks',
    keywords: ['jeans', 'denim', 'pants'],
  },
  {
    id: 'ca-oldnavy-jeans',
    region: 'CA',
    retailer: 'Old Navy',
    item: 'Jeans',
    category: 'clothing',
    offer: 'Kids and adult jeans rotate on in-store % off racks',
    keywords: ['jeans', 'denim', 'pantalon'],
  },
  {
    id: 'us-gap-hoodie',
    region: 'US',
    retailer: 'Gap',
    item: 'Hoodie',
    category: 'clothing',
    offer: 'Fleece hoodies land on the clearance wall most seasons',
    keywords: ['hoodie', 'sweatshirt', 'fleece'],
  },
  {
    id: 'ca-winners-sneakers',
    region: 'CA',
    retailer: 'Winners',
    item: 'Sneakers',
    brand: 'Nike',
    category: 'clothing',
    offer: 'Brand sneakers (Nike, Adidas) appear on the shoe wall, not online-only',
    keywords: ['sneakers', 'runners', 'nike', 'adidas', 'shoes'],
  },
  {
    id: 'us-marshalls-sneakers',
    region: 'US',
    retailer: 'Marshalls',
    item: 'Sneakers',
    brand: 'Nike',
    category: 'clothing',
    offer: 'Brand sneakers appear on the shoe wall, not as an online cart',
    keywords: ['sneakers', 'nike', 'adidas', 'shoes'],
  },
  {
    id: 'us-nordstromrack-jacket',
    region: 'US',
    retailer: 'Nordstrom Rack',
    item: 'Jacket',
    category: 'clothing',
    offer: 'Outerwear racks carry last-season jackets in store',
    keywords: ['jacket', 'coat', 'parka'],
  },
  {
    id: 'ca-hm-tshirt',
    region: 'CA',
    retailer: 'H&M',
    item: 'T-shirt',
    category: 'clothing',
    offer: 'Basics packs are an in-store price, not a delivery deal',
    keywords: ['t-shirt', 'tshirt', 'tee', 'shirt'],
  },
  {
    id: 'us-target-socks',
    region: 'US',
    retailer: 'Target',
    item: 'Socks',
    brand: 'Cat & Jack',
    category: 'clothing',
    offer: 'Kids sock multipacks sit on the apparel endcap',
    keywords: ['socks', 'sock'],
  },
];

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferRegionFromLabel(label?: string | null): InStoreRegion {
  const hay = (label ?? '').toLowerCase();
  if (/\b(qc|on|bc|ab|mb|sk|ns|nb|nl|pe|yt|nt|nu|canada|montreal|toronto|vancouver)\b/.test(hay)) {
    return 'CA';
  }
  return /[a-z]/.test(hay) ? 'US' : 'CA';
}

export type PromoMatch = InStorePromo & { listItem: string };

/** Match Missing/Low list lines to typical in-store offers for a retailer near the user. */
export function matchInStorePromos(input: {
  listNames: string[];
  retailer?: string | null;
  region?: InStoreRegion;
  category?: 'grocery' | 'clothing' | 'any';
}): PromoMatch[] {
  const region = input.region ?? 'CA';
  const retailer = (input.retailer ?? '').toLowerCase();
  const wanted = input.category ?? 'any';
  const matches: PromoMatch[] = [];

  for (const name of input.listNames) {
    const hay = normalize(name);
    if (!hay) continue;
    const hit = PROMOS.find((promo) => {
      if (promo.region !== region) return false;
      if (wanted !== 'any' && promo.category !== wanted) return false;
      if (retailer && !promo.retailer.toLowerCase().includes(retailer) && !retailer.includes(promo.retailer.toLowerCase())) {
        return false;
      }
      return promo.keywords.some((keyword) => hay.includes(normalize(keyword)));
    });
    if (hit) matches.push({ ...hit, listItem: name });
  }

  return matches;
}

export function listInStorePromos(): InStorePromo[] {
  return PROMOS;
}

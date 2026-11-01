/**
 * US + Canada street labels for saved places.
 * Nominatim / Expo Location both feed this so we never ship a full
 * `display_name` dump (country, county, OSM extras).
 */

const US_STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN',
  texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

const CA_PROVINCES: Record<string, string> = {
  alberta: 'AB', 'british columbia': 'BC', manitoba: 'MB', 'new brunswick': 'NB',
  'newfoundland and labrador': 'NL', 'newfoundland': 'NL', 'northwest territories': 'NT',
  'nova scotia': 'NS', nunavut: 'NU', ontario: 'ON', 'prince edward island': 'PE',
  quebec: 'QC', québec: 'QC', saskatchewan: 'SK', yukon: 'YT',
};

export type UsCaAddressParts = {
  countryCode?: string | null;
  houseNumber?: string | null;
  road?: string | null;
  city?: string | null;
  region?: string | null;
  postcode?: string | null;
  iso3166?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function normalizeCountryCode(raw?: string | null): 'us' | 'ca' | null {
  const c = String(raw ?? '').trim().toLowerCase();
  if (c === 'us' || c === 'usa' || c === 'united states' || c === 'united states of america') {
    return 'us';
  }
  if (c === 'ca' || c === 'can' || c === 'canada') return 'ca';
  return null;
}

export function regionCode(country: 'us' | 'ca', region?: string | null, iso3166?: string | null): string {
  const iso = String(iso3166 ?? '');
  const isoMatch = iso.match(/^[A-Z]{2}-([A-Z]{2})$/i);
  if (isoMatch) return isoMatch[1]!.toUpperCase();

  const raw = String(region ?? '').trim();
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const key = raw.toLowerCase();
  if (country === 'us') return US_STATES[key] ?? raw;
  return CA_PROVINCES[key] ?? raw;
}

export function formatPostcode(country: 'us' | 'ca', postcode?: string | null): string {
  const raw = String(postcode ?? '').trim().toUpperCase();
  if (!raw) return '';
  if (country === 'us') {
    const zip = raw.match(/^(\d{5})(?:-?\d{4})?/);
    return zip ? zip[1]! : raw;
  }
  const compact = raw.replace(/\s+/g, '');
  const postal = compact.match(/^([A-Z]\d[A-Z])(\d[A-Z]\d)$/);
  if (postal) return `${postal[1]} ${postal[2]}`;
  return raw;
}

function line1(parts: UsCaAddressParts): string {
  return [parts.houseNumber, parts.road].map((bit) => String(bit ?? '').trim()).filter(Boolean).join(' ');
}

/**
 * US: `123 Main St, Springfield, IL 62704`
 * CA: `123 Main St, Toronto, ON M5V 2T6`
 * Returns null when the country is not US/CA.
 */
export function formatUsCaAddress(parts: UsCaAddressParts): string | null {
  const country = normalizeCountryCode(parts.countryCode);
  if (!country) return null;

  const street = line1(parts);
  const city = String(parts.city ?? '').trim();
  const region = regionCode(country, parts.region, parts.iso3166);
  const postal = formatPostcode(country, parts.postcode);
  const regionPostal = [region, postal].filter(Boolean).join(' ');

  const tail = [city, regionPostal].filter(Boolean).join(', ');
  if (street && tail) return `${street}, ${tail}`;
  if (street && regionPostal) return `${street}, ${regionPostal}`;
  if (city && regionPostal) return `${city}, ${regionPostal}`;
  if (street) return street;
  if (tail) return tail;
  return null;
}

/** Nominatim `address` object → US/CA label, or null to drop the hit. */
export function formatNominatimUsCa(address: unknown, fallbackName?: string): string | null {
  const a = asRecord(address);
  const country = normalizeCountryCode(String(a.country_code ?? a.country ?? ''));
  if (!country) return null;

  const city = String(
    a.city ?? a.town ?? a.village ?? a.municipality ?? a.hamlet ?? a.suburb ?? ''
  );
  const road = String(a.road ?? a.pedestrian ?? a.residential ?? a.footway ?? fallbackName ?? '');
  return formatUsCaAddress({
    countryCode: country,
    houseNumber: a.house_number != null ? String(a.house_number) : '',
    road,
    city,
    region: a.state != null ? String(a.state) : '',
    postcode: a.postcode != null ? String(a.postcode) : '',
    iso3166: a['ISO3166-2-lvl4'] != null ? String(a['ISO3166-2-lvl4']) : '',
  });
}

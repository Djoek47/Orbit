/**
 * US/CA address labels — no country dump, ZIP vs postal.
 * Run: npx --yes tsx lib/places/address-format.test.ts
 */
import assert from 'node:assert/strict';

import {
  formatNominatimUsCa,
  formatUsCaAddress,
  normalizeCountryCode,
  regionCode,
} from './address-format';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

{
  assert.equal(normalizeCountryCode('US'), 'us');
  assert.equal(normalizeCountryCode('Canada'), 'ca');
  assert.equal(normalizeCountryCode('FR'), null);
  assert.equal(regionCode('us', 'Illinois', 'US-IL'), 'IL');
  assert.equal(regionCode('ca', 'Ontario'), 'ON');
  pass('country + region codes');
}

{
  const us = formatUsCaAddress({
    countryCode: 'us',
    houseNumber: '123',
    road: 'Main St',
    city: 'Springfield',
    region: 'Illinois',
    postcode: '62704-1234',
    iso3166: 'US-IL',
  });
  assert.equal(us, '123 Main St, Springfield, IL 62704');
  pass('US street + ZIP5');
}

{
  const ca = formatUsCaAddress({
    countryCode: 'ca',
    houseNumber: '123',
    road: 'Main St',
    city: 'Toronto',
    region: 'Ontario',
    postcode: 'm5v2t6',
  });
  assert.equal(ca, '123 Main St, Toronto, ON M5V 2T6');
  pass('CA street + postal');
}

{
  assert.equal(
    formatNominatimUsCa({
      house_number: '850',
      road: 'Market Street',
      city: 'San Francisco',
      state: 'California',
      postcode: '94103',
      country_code: 'us',
      'ISO3166-2-lvl4': 'US-CA',
    }),
    '850 Market Street, San Francisco, CA 94103'
  );
  assert.equal(
    formatNominatimUsCa({
      country_code: 'fr',
      city: 'Paris',
      road: 'Rue de Rivoli',
    }),
    null
  );
  pass('Nominatim US kept, France dropped');
}

console.log('\naddress-format tests passed');

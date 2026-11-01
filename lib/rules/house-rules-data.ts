import libraryJson from '@/data/house-rules.json';

import { decodeHouseRules } from '@/lib/rules/decode';
import type { HouseRulesDoc } from '@/lib/rules/types';

let cached: HouseRulesDoc | null = null;

/** Load and decode the sole House Rules content file. */
export function getHouseRulesDoc(): HouseRulesDoc {
  if (!cached) {
    cached = decodeHouseRules(libraryJson);
  }
  return cached;
}

/** Test helper */
export function __resetHouseRulesCache() {
  cached = null;
}

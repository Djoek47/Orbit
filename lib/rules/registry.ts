/**
 * House Rules registry is retired. Copy lives in data/house-rules.json.
 * Custom-rule validation stays here so old imports keep working.
 */
export {
  CUSTOM_HOUSE_RULE_MAX_COUNT,
  CUSTOM_HOUSE_RULE_MAX_LEN,
  validateCustomHouseRule,
  type CustomHouseRule,
} from '@/lib/rules/custom-house-rules';

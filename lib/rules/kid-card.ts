/**
 * Kid House Rules card — Rev D §4.3 HOW IT WORKS subset.
 * Full JSON kid copy for every rule will not fit one 390pt screen (Rev F §13.b).
 * R30–R33 stay on the Adult manual.
 */
export const KID_CARD_RULE_IDS = [
  'DEAD-01',
  'DEAD-03',
  'DEAD-04',
  'STRK-01',
  'STRK-02',
  'STRK-03',
] as const;

export type KidCardRuleId = (typeof KID_CARD_RULE_IDS)[number];

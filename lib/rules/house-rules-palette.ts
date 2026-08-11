/**
 * Map HTML House Rules roles → ChoreMaxx orbit tokens.
 * Layout from HTML; colors from orbit palette so Adult/Kid still feel different
 * without hardcoding espresso / cream hexes from the HTML prototype.
 */

/** Minimal color surface — duck-typed to OrbitColorPalette without importing RN. */
export type OrbitColorLike = {
  background: string;
  backgroundSoft: string;
  shell: string;
  card: string;
  cardStrong: string;
  border: string;
  borderStrong: string;
  text: string;
  textSoft: string;
  textMuted: string;
  orbitBlue: string;
  orbitBlueDeep: string;
  primary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  planPurple: string;
  poppinsCyan: string;
  brandSlate: string;
};

export type HouseRulesVoice = 'adult' | 'kid';

export type HouseRulesDirection = 'chapters' | 'glance' | 'track' | 'ask';

/** Kid chapter tab color roles from JSON `kidColor`. */
export type KidColorRole = 'grape' | 'mango' | 'mint' | 'punch' | string;

export type HouseRulesPalette = {
  surface: string;
  surfaceSoft: string;
  ink: string;
  inkSoft: string;
  muted: string;
  spine: string;
  accent: string;
  card: string;
  cardBorder: string;
  pillBg: string;
  pillText: string;
  warn: string;
  danger: string;
  success: string;
  askBubble: string;
  ansBubble: string;
  chipBg: string;
  trackConnector: string;
};

function kidRoleColor(c: OrbitColorLike, role?: string): string {
  switch (role) {
    case 'grape':
      return c.planPurple;
    case 'mango':
      return c.warning;
    case 'mint':
      return c.accent;
    case 'punch':
      return c.danger;
    default:
      return c.primary;
  }
}

export function chapterAccentColor(
  c: OrbitColorLike,
  accent?: string,
  kidColor?: string,
  voice: HouseRulesVoice = 'adult'
): string {
  if (voice === 'kid') return kidRoleColor(c, kidColor);
  if (accent === 'ember') return c.warning;
  if (accent === 'olive') return c.success;
  return c.accent;
}

export function resolveHouseRulesPalette(
  c: OrbitColorLike,
  voice: HouseRulesVoice,
  direction: HouseRulesDirection
): HouseRulesPalette {
  const base: HouseRulesPalette = {
    surface: c.background,
    surfaceSoft: c.backgroundSoft,
    ink: c.text,
    inkSoft: c.textSoft,
    muted: c.textMuted,
    spine: c.brandSlate,
    accent: c.accent,
    card: c.card,
    cardBorder: c.border,
    pillBg: `${c.accent}22`,
    pillText: c.accent,
    warn: c.warning,
    danger: c.danger,
    success: c.success,
    askBubble: c.primary,
    ansBubble: c.cardStrong,
    chipBg: `${c.primary}22`,
    trackConnector: c.borderStrong,
  };

  if (voice === 'kid') {
    return {
      ...base,
      surface: c.backgroundSoft,
      surfaceSoft: c.cardStrong,
      spine: c.planPurple,
      accent: c.planPurple,
      askBubble: c.planPurple,
      pillBg: `${c.planPurple}28`,
      pillText: c.planPurple,
      chipBg: `${c.warning}28`,
    };
  }

  // Adult direction surfaces — mapped to orbit, not HTML navy/forest hexes
  if (direction === 'glance') {
    return {
      ...base,
      surface: c.background,
      surfaceSoft: c.shell,
      accent: c.orbitBlue,
      spine: c.orbitBlueDeep,
      pillBg: `${c.orbitBlue}28`,
      pillText: c.orbitBlue,
    };
  }
  if (direction === 'track') {
    return {
      ...base,
      surface: c.background,
      surfaceSoft: c.backgroundSoft,
      accent: c.success,
      spine: c.success,
      trackConnector: `${c.success}55`,
      pillBg: `${c.success}22`,
      pillText: c.success,
    };
  }
  if (direction === 'ask') {
    return {
      ...base,
      accent: c.poppinsCyan,
      askBubble: c.poppinsCyan,
      pillBg: `${c.poppinsCyan}22`,
      pillText: c.poppinsCyan,
    };
  }

  // Chapters — espresso spine mapped to brand slate / ink
  return {
    ...base,
    spine: c.brandSlate,
    accent: c.accent,
  };
}

export { kidRoleColor };

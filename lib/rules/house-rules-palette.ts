/**
 * House Rules colors — exact HTML prototype tokens (choremaxx-house-rules-full.html).
 * Typography stays Bricolage via AppText / orbit typography.
 */

export type HouseRulesVoice = 'adult' | 'kid';

export type HouseRulesDirection = 'chapters' | 'glance' | 'track' | 'ask';

/** Kid chapter tab color roles from JSON `kidColor`. */
export type KidColorRole = 'grape' | 'mango' | 'mint' | 'punch' | 'ink' | string;

/** HTML :root tokens */
export const HR = {
  espresso: '#1B1410',
  card: '#2E241C',
  cream: '#F2E7D4',
  creamDim: '#BCA98F',
  olive: '#8E9C5C',
  ember: '#E4572E',
  navy: '#16233A',
  navyCard: '#1E2E4A',
  amber: '#E9B44C',
  kidPaper: '#FFF7EC',
  kidInk: '#2B2019',
  kidGrape: '#6C5CE7',
  kidMango: '#FF9F1C',
  kidMint: '#17B9A0',
  kidPunch: '#FF5A5F',
  kidInkTab: '#4A3F5C',
  kidStairs: ['#17B9A0', '#3EC49F', '#8CC63F', '#FF9F1C', '#FF7A2F', '#FF5A5F'] as const,
  silver: '#B9C2CF',
  bronze: '#A9713F',
  kidBronze: '#C4834B',
  rampGold: '#B07E22',
  explorer: '#14100D',
  explorerTabBorder: '#3A2E24',
  explorerModeBg: '#221A14',
  missFill: '#8A3A2C',
  clause: '#EADCC6',
  spineBg: '#372A20',
  chapterBorder: '#3B2E23',
  foot: '#7C6A57',
  pillBg: '#3A2D22',
  pillText: '#D3C0A5',
  glanceInk: '#E7EDF6',
  glanceMuted: '#8DA0BC',
  glanceBody: '#A9B8CE',
  glanceQuietBorder: '#2A3A57',
  glanceSeg: '#101A2B',
  trackAdultBg: '#1F1A12',
  trackAdultInk: '#EDE3CF',
  trackRail: '#3E3527',
  trackDead: '#6B4034',
  trackMini: '#2C2519',
  trackKidBg: '#123A2E',
  trackKidInk: '#EAFBF2',
  trackKidWhen: '#7FE3B8',
  trackKidBox: '#17493A',
  trackKidGold: '#F5D77A',
  askAdultBg: '#221B15',
  askAdultInk: '#F0E6D4',
  askAnswer: '#A9977C',
  askSearch: '#2E251C',
  askSig: '#7C6C57',
  askKidBg: '#F6F1FF',
  askKidInk: '#241C36',
  askKidFacts: '#F0EBFF',
  kidBody: '#6E5F52',
  kidTitleMuted: '#7A6A5C',
  kidCard: '#FFFFFF',
  kidGlanceBg: '#0E1A2E',
  kidGlanceInk: '#EAF2FF',
  kidGlanceCard: '#182842',
  kidGlanceBorder: '#22385A',
} as const;

export type HouseRulesPalette = {
  surface: string;
  surfaceSoft: string;
  ink: string;
  inkSoft: string;
  muted: string;
  spine: string;
  spineBg: string;
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
  groupHead: string;
  quietBorder: string;
  nav: string;
  title: string;
  clause: string;
  foot: string;
  /** Selected direction tab fill (cream in HTML chrome). */
  tabOnBg: string;
  tabOnInk: string;
  modeOnBg: string;
};

/** Minimal duck type kept for chapterAccentColor callers. */
export type OrbitColorLike = Record<string, string | boolean | undefined>;

export function kidRoleColor(_c: OrbitColorLike | undefined, role?: string): string {
  switch (role) {
    case 'grape':
      return HR.kidGrape;
    case 'mango':
      return HR.kidMango;
    case 'mint':
      return HR.kidMint;
    case 'punch':
      return HR.kidPunch;
    case 'ink':
      return HR.kidInkTab;
    default:
      return HR.kidGrape;
  }
}

export function chapterAccentColor(
  _c: OrbitColorLike | undefined,
  accent?: string,
  kidColor?: string,
  voice: HouseRulesVoice = 'adult'
): string {
  if (voice === 'kid') return kidRoleColor(undefined, kidColor);
  if (accent === 'ember') return HR.ember;
  if (accent === 'olive') return HR.olive;
  return HR.olive;
}

export function resolveHouseRulesPalette(
  _c: OrbitColorLike | undefined,
  voice: HouseRulesVoice,
  direction: HouseRulesDirection
): HouseRulesPalette {
  const chrome = {
    tabOnBg: HR.cream,
    tabOnInk: '#14100D',
    modeOnBg: HR.ember,
  };

  if (voice === 'kid') {
    if (direction === 'chapters') {
      return {
        ...chrome,
        surface: HR.kidPaper,
        surfaceSoft: HR.kidCard,
        ink: HR.kidInk,
        inkSoft: HR.kidBody,
        muted: HR.kidTitleMuted,
        spine: HR.kidGrape,
        spineBg: HR.kidGrape,
        accent: HR.kidGrape,
        card: HR.kidCard,
        cardBorder: 'rgba(43,32,25,0.10)',
        pillBg: '#FFF0DC',
        pillText: '#B5651D',
        warn: HR.kidMango,
        danger: HR.kidPunch,
        success: HR.kidMint,
        askBubble: HR.kidGrape,
        ansBubble: HR.kidCard,
        chipBg: HR.askKidFacts,
        trackConnector: `${HR.kidMint}88`,
        groupHead: HR.kidGrape,
        quietBorder: 'rgba(43,32,25,0.12)',
        nav: HR.kidGrape,
        title: HR.kidInk,
        clause: HR.kidBody,
        foot: HR.kidTitleMuted,
      };
    }
    if (direction === 'glance') {
      return {
        ...chrome,
        surface: HR.kidGlanceBg,
        surfaceSoft: HR.kidGlanceCard,
        ink: HR.kidGlanceInk,
        inkSoft: '#A9B8CE',
        muted: '#7E8DA6',
        spine: HR.kidMango,
        spineBg: HR.kidMango,
        accent: HR.kidMango,
        card: HR.kidGlanceCard,
        cardBorder: HR.kidGlanceBorder,
        pillBg: `${HR.kidMango}28`,
        pillText: HR.kidMango,
        warn: HR.kidMango,
        danger: HR.kidPunch,
        success: HR.kidMint,
        askBubble: HR.kidGrape,
        ansBubble: HR.kidGlanceCard,
        chipBg: `${HR.kidMint}22`,
        trackConnector: HR.kidGlanceBorder,
        groupHead: HR.kidMango,
        quietBorder: HR.kidGlanceBorder,
        nav: HR.kidMango,
        title: HR.kidGlanceInk,
        clause: '#A9B8CE',
        foot: '#7E8DA6',
      };
    }
    if (direction === 'track') {
      return {
        ...chrome,
        surface: HR.trackKidBg,
        surfaceSoft: HR.trackKidBox,
        ink: HR.trackKidInk,
        inkSoft: HR.trackKidWhen,
        muted: HR.trackKidWhen,
        spine: HR.kidMint,
        spineBg: HR.kidMint,
        accent: HR.kidMint,
        card: HR.trackKidBox,
        cardBorder: 'rgba(127,227,184,0.18)',
        pillBg: `${HR.kidMango}33`,
        pillText: HR.kidMango,
        warn: HR.kidMango,
        danger: HR.kidPunch,
        success: HR.kidMint,
        askBubble: HR.kidGrape,
        ansBubble: HR.trackKidBox,
        chipBg: `${HR.trackKidGold}33`,
        trackConnector: `${HR.kidMint}66`,
        groupHead: HR.trackKidWhen,
        quietBorder: 'rgba(127,227,184,0.22)',
        nav: HR.trackKidWhen,
        title: HR.trackKidInk,
        clause: HR.trackKidWhen,
        foot: HR.trackKidWhen,
      };
    }
    // ask
    return {
      ...chrome,
      surface: HR.askKidBg,
      surfaceSoft: HR.askKidFacts,
      ink: HR.askKidInk,
      inkSoft: '#5A4E78',
      muted: '#8B7EAD',
      spine: HR.kidGrape,
      spineBg: HR.kidGrape,
      accent: HR.kidGrape,
      card: '#FFFFFF',
      cardBorder: 'rgba(108,92,231,0.18)',
      pillBg: HR.askKidFacts,
      pillText: HR.kidGrape,
      warn: HR.kidMango,
      danger: HR.kidPunch,
      success: HR.kidMint,
      askBubble: HR.kidGrape,
      ansBubble: '#FFFFFF',
      chipBg: HR.askKidFacts,
      trackConnector: 'rgba(108,92,231,0.25)',
      groupHead: HR.kidGrape,
      quietBorder: 'rgba(108,92,231,0.22)',
      nav: HR.kidGrape,
      title: HR.askKidInk,
      clause: '#5A4E78',
      foot: '#8B7EAD',
    };
  }

  // Adult
  if (direction === 'glance') {
    return {
      ...chrome,
      surface: HR.navy,
      surfaceSoft: HR.navyCard,
      ink: HR.glanceInk,
      inkSoft: HR.glanceBody,
      muted: HR.glanceMuted,
      spine: HR.amber,
      spineBg: HR.navyCard,
      accent: HR.amber,
      card: HR.navyCard,
      cardBorder: HR.glanceQuietBorder,
      pillBg: `${HR.amber}28`,
      pillText: HR.amber,
      warn: HR.amber,
      danger: '#8A3A2C',
      success: HR.kidMint,
      askBubble: HR.amber,
      ansBubble: HR.navyCard,
      chipBg: `${HR.amber}22`,
      trackConnector: HR.glanceQuietBorder,
      groupHead: HR.amber,
      quietBorder: HR.glanceQuietBorder,
      nav: HR.amber,
      title: HR.glanceInk,
      clause: HR.glanceBody,
      foot: HR.glanceMuted,
    };
  }
  if (direction === 'track') {
    return {
      ...chrome,
      surface: HR.trackAdultBg,
      surfaceSoft: HR.trackMini,
      ink: HR.trackAdultInk,
      inkSoft: HR.creamDim,
      muted: HR.creamDim,
      spine: HR.olive,
      spineBg: HR.trackRail,
      accent: HR.olive,
      card: HR.trackMini,
      cardBorder: HR.trackRail,
      pillBg: HR.trackMini,
      pillText: HR.creamDim,
      warn: HR.ember,
      danger: HR.trackDead,
      success: HR.olive,
      askBubble: HR.olive,
      ansBubble: HR.trackMini,
      chipBg: HR.trackMini,
      trackConnector: HR.trackRail,
      groupHead: HR.olive,
      quietBorder: HR.trackRail,
      nav: HR.olive,
      title: HR.trackAdultInk,
      clause: HR.creamDim,
      foot: HR.creamDim,
    };
  }
  if (direction === 'ask') {
    return {
      ...chrome,
      surface: HR.askAdultBg,
      surfaceSoft: HR.askSearch,
      ink: HR.askAdultInk,
      inkSoft: HR.askAnswer,
      muted: HR.askSig,
      spine: HR.olive,
      spineBg: HR.askSearch,
      accent: HR.olive,
      card: 'transparent',
      cardBorder: 'rgba(242,231,212,0.08)',
      pillBg: HR.askSearch,
      pillText: HR.olive,
      warn: HR.ember,
      danger: HR.ember,
      success: HR.olive,
      askBubble: HR.olive,
      ansBubble: HR.askSearch,
      chipBg: HR.askSearch,
      trackConnector: HR.askSig,
      groupHead: HR.ember,
      quietBorder: 'rgba(242,231,212,0.10)',
      nav: HR.olive,
      title: HR.askAdultInk,
      clause: HR.askAnswer,
      foot: HR.askSig,
    };
  }

  // Adult chapters (espresso)
  return {
    ...chrome,
    surface: HR.espresso,
    surfaceSoft: HR.card,
    ink: HR.cream,
    inkSoft: HR.clause,
    muted: HR.creamDim,
    spine: HR.olive,
    spineBg: HR.spineBg,
    accent: HR.ember,
    card: HR.card,
    cardBorder: HR.chapterBorder,
    pillBg: HR.pillBg,
    pillText: HR.pillText,
    warn: HR.ember,
    danger: HR.ember,
    success: HR.olive,
    askBubble: HR.ember,
    ansBubble: HR.card,
    chipBg: HR.pillBg,
    trackConnector: HR.spineBg,
    groupHead: HR.ember,
    quietBorder: HR.chapterBorder,
    nav: HR.olive,
    title: HR.cream,
    clause: HR.clause,
    foot: HR.foot,
  };
}

export { kidRoleColor as kidChapterTabColor };

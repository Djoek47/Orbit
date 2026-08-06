export type HouseholdRole = 'owner' | 'admin' | 'adult' | 'child' | 'guest' | 'shared-device';

export type HouseholdMemberStatus = 'pending' | 'active' | 'inactive';

/** ChoreMaxx v2: every household is a family. Legacy DB values are normalized to `family`. */
export type HouseholdType = 'family';

export type OrbitUser = {
  id: string;
  email: string;
  name: string;
  avatar: string;
  profileComplete: boolean;
};

export type AuthSession = {
  user: OrbitUser;
};

export type HouseholdMember = {
  id: string;
  name: string;
  role: HouseholdRole;
  status: HouseholdMemberStatus;
  avatar: string;
  xp: number;
  /** XP earned in the current week — used by Rankings (Figma Make v4+). */
  weekXp?: number;
  /** Consecutive-day streak for Rankings. */
  streak?: number;
  loadShare: number;
  /** Personal accent look — follows the member when switching personas. */
  accentThemeId?: string;
  /** ISO date YYYY-MM-DD — member away / on holiday (Poppins skips nudges). */
  awayFrom?: string;
  awayTo?: string;
  /** Revision D — first Streak Rescue accepted (free when FIRST_RESCUE_IS_FREE). */
  freeRescueUsed?: boolean;
  /**
   * For `shared-device` profiles: household member ids who use this phone/tablet.
   * Tasks assigned via the device must pick one of these people.
   */
  sharedWithMemberIds?: string[];
  /**
   * Per-person invite code/QR used to host this profile on a shared/kid device
   * (Netflix-style multi-profile tablet). Distinct from the household join code.
   */
  profileInviteCode?: string;
};

export type TaskDifficulty = 'easy' | 'medium' | 'hard';

/** Per-person progress on a split (multi-assignee) task. */
export type TaskAssigneeShare = {
  name: string;
  status: 'Pending' | 'Completed' | 'Penalized';
  proofUri?: string;
  proofStatus?: 'none' | 'submitted' | 'approved' | 'rejected';
  awardedXp?: number;
  penalizedXp?: number;
};

export type HouseholdTask = {
  id: string;
  title: string;
  description?: string;
  category: string;
  /**
   * Display label — single name, or “Emma & Liam” for split tasks.
   * For credit/filtering prefer `assignees` / `shares`.
   */
  assignee: string;
  /**
   * When length > 1 this is a split task: each person can finish (and prove) independently.
   * Completers earn XP; all-finish bonus; admins may penalize non-finishers.
   */
  assignees?: string[];
  shares?: TaskAssigneeShare[];
  /** XP each person earns when they complete their share (defaults to `xp`). */
  splitXpEach?: number;
  /** Bonus each completer gets when everyone finishes (defaults to ~25% of `xp`). */
  splitBonusXp?: number;
  /** XP deducted if an admin penalizes a non-finisher (defaults to ~50% of `xp`). */
  splitPenaltyXp?: number;
  due: string;
  xp: number;
  /**
   * Intrinsic Meritocracy ladder value (never overwrite when Equity is selected).
   * Display / award XP is resolved via `resolveTaskXp` + household reward settings.
   */
  baseXp?: number;
  /** Explicit eligibility; when omitted, derived from `tracking` / Hygiene category. */
  xpEligible?: boolean;
  /**
   * Snapshot of XP granted at completion. Leaderboards and history read this —
   * never recompute from current reward mode.
   */
  awardedXp?: number;
  /** Weight multiplier for XP (1 = easy, 1.5 = medium, 2 = hard). */
  weight?: number;
  difficulty?: TaskDifficulty;
  /**
   * `streak` = kids Hygiene habits (0 XP by default). Default / omit = normal XP chore.
   */
  tracking?: 'xp' | 'streak';
  proofRequired?: boolean;
  proofUri?: string;
  /** @deprecated Prefer `verification` + `proofRounds` (v2 §1.7). */
  proofStatus?: 'none' | 'submitted' | 'approved' | 'rejected';
  /**
   * Oversight layer — separate from status. XP awards on Complete tap.
   * `not_required` | `unreviewed` | `confirmed` | `proof_requested` | `rejected`
   */
  verification?:
    | 'not_required'
    | 'unreviewed'
    | 'confirmed'
    | 'proof_requested'
    | 'rejected';
  proofPhotoUrls?: string[];
  proofRounds?: { note?: string; requestedAt: string; requestedByMemberId?: string }[];
  verifiedBy?: string;
  verifiedAt?: string;
  /** True when completedAt > dueAt (informational; never reduces XP). */
  completedLate?: boolean;
  latenessMinutes?: number;
  /** Recurring rule id when Definition/Occurrence split is active. */
  definitionId?: string;
  /** Local calendar day key YYYY-MM-DD for occurrence uniqueness. */
  occurrenceDate?: string;
  repeat: 'None' | 'Daily' | 'Weekly' | 'Weekdays';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled' | 'Missed';
  dueAt?: string;
  /** ISO timestamp when the task was completed (household-local day checks). */
  completedAt?: string;
  /** Optional room for cleaning attribution. */
  roomId?: string;
  /** When set, task was created via this shared-device profile. */
  sharedDeviceId?: string;
};

export type CancelTaskScope = 'this' | 'future';

export type HouseholdRoomKind =
  | 'kitchen'
  | 'living'
  | 'bathroom'
  | 'bedroom'
  | 'laundry'
  | 'outdoor'
  | 'custom';

export type HouseholdRoom = {
  id: string;
  name: string;
  emoji: string;
  kind: HouseholdRoomKind;
};

export type GroceryItem = {
  id: string;
  name: string;
  category: string;
  quantity: string;
  /** @deprecated Rev C §4 — storage assignment removed from UI. Kept optional for legacy rows. */
  location?: 'Fridge' | 'Freezer' | 'Pantry' | 'Bathroom' | 'Cleaning';
  status: 'Available' | 'Low' | 'Missing' | 'Purchased';
  barcode?: string;
  typicalPrice?: number;
  salePrice?: number;
  aisle?: string;
  storeId?: string;
  requestedBy?: string;
  note?: string;
  /** Classifier category id (e.g. dairy_eggs) when known. */
  categoryId?: string;
  /** Canada catalog product id when added from search/browse. */
  productId?: string;
};

export type HouseholdEvent = {
  id: string;
  title: string;
  category: 'School' | 'Activity' | 'Appointment' | 'Family' | 'Routine';
  date: string;
  time: string;
  location: string;
  responsible: string;
  startsAt?: string;
  endsAt?: string;
};

export type ItineraryStopKind =
  | 'school'
  | 'work'
  | 'grocery'
  | 'pickup'
  | 'practice'
  | 'family'
  | 'home'
  | 'shop'
  | 'custom';

export type ItineraryStopStatus = 'pending' | 'active' | 'done' | 'skipped';

export type ItineraryStop = {
  id: string;
  label: string;
  kind: ItineraryStopKind;
  address?: string;
  placeQuery?: string;
  lat?: number;
  lng?: number;
  eventId?: string;
  groceryListId?: string;
  etaMinutes?: number;
  sortOrder: number;
  status: ItineraryStopStatus;
  savedPlaceId?: string;
};

export type Itinerary = {
  id: string;
  householdId: string;
  title: string;
  date: string;
  status: 'draft' | 'active' | 'completed';
  stops: ItineraryStop[];
  suggestedByPoppins?: boolean;
  summary?: string;
  /** Saved as a preferred / reusable trip template. */
  favorite?: boolean;
};

/** Household saved places for building multi-stop itineraries. */
export type SavedPlaceKind =
  | 'home'
  | 'work'
  | 'school'
  | 'shop'
  | 'practice'
  | 'family'
  | 'cafe'
  | 'pickup'
  | 'custom';

export type SavedPlace = {
  id: string;
  name: string;
  kind: SavedPlaceKind;
  address: string;
  placeQuery?: string;
  lat?: number;
  lng?: number;
  /** Display emoji for My Places cards (Design 8). */
  emoji?: string;
  isFavorite?: boolean;
  /** Place-local pickup reminders; grocery Missing/Low also merge into summary for shops. */
  pickupItemNames?: string[];
};

export type ProductCatalogItem = {
  barcode: string;
  name: string;
  brand?: string;
  size?: string;
  category: string;
  typicalPrice: number;
  salePrice?: number;
  aisle?: string;
  storeId?: string;
  imageUrl?: string;
  ingredients?: string;
  allergens?: string[];
  nutriScore?: string;
  novaGroup?: number;
  source?: 'mock' | 'openfoodfacts' | 'unknown';
};

export type PreferredStore = {
  id: string;
  name: string;
  address: string;
  placeQuery: string;
  lat?: number;
  lng?: number;
  /** Distance in meters when resolved from nearby search. */
  distanceMeters?: number;
  source?: 'curated' | 'osm' | 'saved';
};

export type RewardOrigin = 'minted' | 'special-request';

export type Reward = {
  id: string;
  title: string;
  /**
   * @deprecated v2 §6.1 — rewards are not purchased with XP.
   * Kept optional for legacy rows; treat missing/0 as free grant.
   */
  cost?: number;
  approvalRequired: boolean;
  /** @deprecated v2 §6.2 — no emoji on reward surfaces. */
  emoji?: string;
  category?: string;
  color?: string;
  archived?: boolean;
  specialRequest?: boolean;
  /** Catalog mint vs member special ask — admin-visible. */
  origin?: RewardOrigin;
  createdByMemberId?: string;
  createdByName?: string;
  /** When set, only this member (and admins) see the reward in the vault. */
  assignedMemberId?: string;
  assignedMemberName?: string;
  /** Grant cadence — daily / weekly / monthly (§6.2). */
  frequency?: 'daily' | 'weekly' | 'monthly';
  /** e.g. "30 min" for screen-time tiers. */
  quantity?: string;
  subtitle?: string;
  isCustom?: boolean;
  /** Library preset id when minted from REWARD_PRESETS. */
  presetId?: string;
};

/** Cash / privilege allowance — admin grants or member requests, admin approves. */
export type AllowanceGrant = {
  id: string;
  householdId: string;
  memberId: string;
  memberName: string;
  /** Display amount, e.g. "$5" or "Extra screen". */
  amountLabel: string;
  /** Optional XP tied to the allowance ask (informational / cost). */
  amountXp?: number;
  status: 'pending' | 'approved' | 'rejected';
  kind: 'admin-grant' | 'member-request';
  note?: string;
  requestedAt: string;
  decidedAt?: string;
  createdByMemberId?: string;
  createdByName?: string;
};

export type Badge = {
  id: string;
  title: string;
  icon: string;
  progress: number;
};

export type PoppinsBriefing = {
  title: string;
  summary: string;
  actions: string[];
};

export type PoppinsRecommendation = {
  id: string;
  title: string;
  detail: string;
  tone: 'blue' | 'cyan' | 'green' | 'amber' | 'red';
};

export type PoppinsWeeklyBriefing = {
  title: string;
  summary: string;
  tasksCompleted: number;
  tasksMissed: number;
  groceriesPurchased: number;
  mostActiveMember: string;
  xpEarned: number;
  momentumChange: number;
  recommendations: string[];
};

export type PoppinsConversationAnswer = {
  question: string;
  answer: string;
};

export type MemberProgress = HouseholdMember & {
  level: number;
  levelProgress: number;
  nextLevelXp: number;
  levelName: string;
  levelEmoji: string;
  levelColor: string;
  weekXp: number;
  streak: number;
  accentColor: string;
  avatarEmoji: string;
  /** Completed tasks attributed to this member (Rankings · Most Tasks). */
  tasksCompleted: number;
};

export type OrbitMetrics = {
  taskCompletionRate: number;
  groceryReadiness: number;
  calendarCoverage: number;
  momentum: number;
  openTasks: number;
  missingGroceries: number;
  purchasedGroceries: number;
  upcomingEvents: number;
  /** Week XP spread fairness 0–100 (admin health). */
  fairnessScore?: number;
  /** Best active-member streak days (admin health). */
  householdStreak?: number;
};

/** Admin toggles for what non-admin members may do. */
export type MemberCapabilities = {
  allowRewardRedeem: boolean;
  allowSpecialRewardRequest: boolean;
  /** When true, Rewards Center shows the Allowance surface. */
  allowAllowance: boolean;
  allowGroceryAdd: boolean;
  allowCalendarCreate: boolean;
};

export type CreateTaskInput = {
  title: string;
  category: string;
  assignee: string;
  /** Multi-person split — when 2+, each gets their own completion/proof share. */
  assignees?: string[];
  splitXpEach?: number;
  splitBonusXp?: number;
  splitPenaltyXp?: number;
  due: string;
  xp: number;
  baseXp?: number;
  xpEligible?: boolean;
  repeat: HouseholdTask['repeat'];
  description?: string;
  weight?: number;
  difficulty?: TaskDifficulty;
  /** Kids Hygiene habits — no XP. */
  tracking?: 'xp' | 'streak';
  proofRequired?: boolean;
  dueAt?: string;
  roomId?: string;
  /** Shared-device profile id when the task was routed through a shared phone/tablet. */
  sharedDeviceId?: string;
  /** When true, also save into household custom catalog (admin mint). */
  saveAsTemplate?: boolean;
  /** Recurrence series id — pairs with occurrenceDate for uniqueness (§5.2). */
  definitionId?: string;
  /** Local calendar day key YYYY-MM-DD for this occurrence. */
  occurrenceDate?: string;
};

export type CreateGroceryInput = {
  name: string;
  /** Optional — when omitted, offline classifier assigns aisle. */
  category?: string;
  categoryId?: string;
  barcode?: string;
  quantity?: string;
  typicalPrice?: number;
  salePrice?: number;
  aisle?: string;
  storeId?: string;
  requestedBy?: string;
  /** @deprecated Rev C — storage removed from UI. */
  location?: GroceryItem['location'];
  note?: string;
  /** Wishlist items for kids who met XP threshold. */
  wishlist?: boolean;
  /** Canada catalog product id when known. */
  productId?: string;
};

export type CreateItineraryInput = {
  title: string;
  date: string;
  stops: Omit<ItineraryStop, 'id' | 'status'>[];
  suggestedByPoppins?: boolean;
  summary?: string;
};

export type CreateRewardInput = {
  title: string;
  /** @deprecated v2 §6.1 — always pass 0. */
  cost?: number;
  approvalRequired?: boolean;
  emoji?: string;
  specialRequest?: boolean;
  category?: string;
  color?: string;
  origin?: RewardOrigin;
  createdByMemberId?: string;
  createdByName?: string;
  assignedMemberId?: string;
  assignedMemberName?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  quantity?: string;
  subtitle?: string;
  isCustom?: boolean;
  presetId?: string;
};

export type CreateAllowanceInput = {
  memberId: string;
  memberName: string;
  amountLabel: string;
  amountXp?: number;
  note?: string;
  /** Admin instant grant vs member-pending request. */
  kind: 'admin-grant' | 'member-request';
  createdByMemberId?: string;
  createdByName?: string;
};

export type TaskTemplate = {
  id: string;
  title: string;
  category: string;
  baseXp: number;
  difficulty: TaskDifficulty;
  weight: number;
  repeat: HouseholdTask['repeat'];
  proofRequired: boolean;
  description?: string;
  householdScoped: boolean;
};

export type PoppinsNotificationPrefs = {
  tasks: boolean;
  itinerary: boolean;
  groceries: boolean;
  rewards: boolean;
  /** Monitor Agent: deal alerts (mock catalog). */
  deals?: boolean;
  /** Monitor Agent: plan / itinerary proposals. */
  plans?: boolean;
  /** Monitor Agent: XP fairness assessments. */
  xpFairness?: boolean;
  /** Foreground near-shop local alerts. */
  nearShop?: boolean;
  /** Nudge missing items before / during a grocery run. */
  missingOnTheWay?: boolean;
};

/** Activity feed entry from Poppins Monitor Agent. */
export type PoppinsMonitorAction = {
  id: string;
  kind: 'nudge' | 'deals' | 'plan' | 'xp_fairness' | 'holiday' | 'ask_info' | 'monitor';
  label: string;
  detail: string;
  createdAt: string;
};

export type CreateEventInput = {
  title: string;
  date: string;
  time: string;
  location: string;
  responsible: string;
  category?: HouseholdEvent['category'];
  /** When true, schedule a short Expo Go local reminder after create. */
  remindMe?: boolean;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type SignUpInput = {
  email: string;
  password: string;
};

export type CreateProfileInput = {
  name: string;
  /** Optional emoji avatar chosen during onboarding. */
  avatar?: string;
};

export type CreateHouseholdInput = {
  name: string;
  /** Ignored — all households are created as `family` (ChoreMaxx v2). */
  type?: HouseholdType;
  /** Selected during create. Defaults applied when omitted. */
  rooms?: HouseholdRoom[];
  rewardModel?:
    | 'xp_only'
    | 'allowance'
    | 'xp_rewards'
    | 'xp_allowance'
    | 'full';
  rewardMode?: 'weighted' | 'flat';
  setupComplete?: boolean;
};

export type JoinHouseholdInput = {
  inviteCode: string;
};

export type HouseholdSnapshot = {
  id: string | null;
  householdName: string;
  householdType: HouseholdType | null;
  inviteCode: string;
  greetingName: string;
  momentum: number;
  trend: number;
  completionRate: number;
  missingGroceries: number;
  upcomingEvents: number;
  members: HouseholdMember[];
  tasks: HouseholdTask[];
  groceries: GroceryItem[];
  events: HouseholdEvent[];
  itineraries: Itinerary[];
  rooms: HouseholdRoom[];
  /** Saved locations for multi-stop trips (home, work, school, shops…). */
  savedPlaces?: SavedPlace[];
  preferredStoreId?: string;
  /** Rev C §4.3 — household corrections for aisle classifier (normalized name → category id). */
  groceryCategoryOverrides?: Record<string, string>;
  /** Catalog product ids marked favorite (mock AsyncStorage / household). */
  groceryFavorites?: string[];
  /** Recently purchased/cleared names for Buy again (newest first). */
  groceryPurchaseHistory?: string[];
  /** Last time an admin opened the groceries tab (for Home badge). */
  groceriesLastOpenedAt?: string;
  /** When false, homework-gated House Rules chapters hide. Default true. */
  homeworkEnabled?: boolean;
  /** Make accent theme id (ocean/aurora/…). */
  accentThemeId?: string;
  taskTemplates: TaskTemplate[];
  notificationPrefs: PoppinsNotificationPrefs;
  /** What non-admin members may do (admin-controlled). */
  memberCapabilities?: MemberCapabilities;
  /**
   * Household-scoped XP scoring (Meritocracy vs Equity + hygiene opt-in).
   * Defaults: weighted, hygieneRewarded false, hygieneXp 5.
   * `weighted` ≡ meritocracy, `flat` ≡ equity (§2 / §3.2).
   */
  rewardMode?: 'weighted' | 'flat';
  /**
   * How chores feel — XP / allowance / rewards subsystems (§2.2).
   * Screens must read CAPABILITIES via `capabilitiesFor(rewardModel)`.
   */
  rewardModel?:
    | 'xp_only'
    | 'allowance'
    | 'xp_rewards'
    | 'xp_allowance'
    | 'full';
  /** False until roster Create household / finish-later path settles (§3.4). */
  setupComplete?: boolean;
  hygieneRewarded?: boolean;
  hygieneXp?: 5 | 10;
  /** IANA timezone for streak/day boundaries. Default America/Toronto. */
  timezone?: string;
  /** Local time HH:mm when the household day ends. Default 00:00. */
  dayEndsAt?: string;
  /** 0 = Sunday … 1 = Monday (default). */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** When true, streak rescue requires parent approval. Default false. */
  redemptionRequiresApproval?: boolean;
  /** Local hour 0–23 for queued streak-break notifications. Default 8. */
  notificationHour?: number;
  /**
   * Revision D Recess periods (per member). Prefer this over awayFrom/awayTo.
   * Stored in supabase `recess_periods` when data mode is supabase.
   */
  recessPeriods?: {
    id: string;
    memberId: string;
    startDate: string;
    endDate: string | null;
    createdBy: string;
    createdAt: string;
    isBackdated: boolean;
  }[];
  /** Custom house rules — display only; never alter mechanics. */
  customHouseRules?: { id: string; body: string; sortOrder: number }[];
  rewards: Reward[];
  badges: Badge[];
  poppins: PoppinsBriefing;
};

export type NotificationItem = {
  id: string;
  householdId: string;
  title: string;
  body: string;
  category: 'tasks' | 'groceries' | 'events' | 'rewards' | 'ai' | 'general' | 'members';
  priority: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
};

export type RewardRedemption = {
  id: string;
  householdId: string;
  rewardId: string;
  memberId: string;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  note?: string;
  requestedAt: string;
  decidedAt?: string;
};

export type StoreRecommendation = {
  id: string;
  householdId: string;
  title: string;
  detail: string;
  description?: string;
  etaMinutes?: number;
  itemCount: number;
  storeId?: string;
};

export type SmartHomeDevice = {
  id: string;
  householdId: string;
  externalId: string;
  name: string;
  room?: string;
  deviceType: string;
  description?: string;
  isOnline: boolean;
  /** Mock-friendly on/off for toggles; full platform state lives in `state`. */
  isOn: boolean;
  state: Record<string, unknown>;
};

export type SmartHomeScene = {
  id: string;
  householdId: string;
  name: string;
  description?: string;
  actions: Record<string, unknown>[];
};

export type WeeklyReport = {
  id?: string;
  householdId: string;
  title: string;
  summary: string;
  description?: string;
  tasksCompleted: number;
  tasksMissed: number;
  groceriesPurchased: number;
  mostActiveMember: string;
  xpEarned: number;
  momentumChange: number;
  recommendations: string[];
  createdAt?: string;
};

export type InviteLinks = {
  code: string;
  deepLink: string;
  webLink: string;
};

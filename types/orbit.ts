export type HouseholdRole = 'owner' | 'admin' | 'adult' | 'child' | 'guest' | 'shared-device';

export type HouseholdMemberStatus = 'pending' | 'active' | 'inactive';

export type HouseholdType = 'family' | 'single-parent' | 'roommates' | 'multi-generational' | 'custom';

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
  /** ISO date YYYY-MM-DD — member away / on holiday (Nova skips nudges). */
  awayFrom?: string;
  awayTo?: string;
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
  /** Weight multiplier for XP (1 = easy, 1.5 = medium, 2 = hard). */
  weight?: number;
  difficulty?: TaskDifficulty;
  proofRequired?: boolean;
  proofUri?: string;
  proofStatus?: 'none' | 'submitted' | 'approved' | 'rejected';
  repeat: 'None' | 'Daily' | 'Weekly' | 'Weekdays';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled';
  dueAt?: string;
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
  location: 'Fridge' | 'Freezer' | 'Pantry' | 'Bathroom' | 'Cleaning';
  status: 'Available' | 'Low' | 'Missing' | 'Purchased';
  barcode?: string;
  typicalPrice?: number;
  salePrice?: number;
  aisle?: string;
  storeId?: string;
  requestedBy?: string;
  note?: string;
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
  suggestedByNova?: boolean;
  summary?: string;
  /** Saved as a preferred / reusable trip template. */
  favorite?: boolean;
};

/** Household saved places for building multi-stop itineraries. */
export type SavedPlaceKind = 'home' | 'work' | 'school' | 'shop' | 'practice' | 'family' | 'custom';

export type SavedPlace = {
  id: string;
  name: string;
  kind: SavedPlaceKind;
  address: string;
  placeQuery?: string;
  lat?: number;
  lng?: number;
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
  cost: number;
  approvalRequired: boolean;
  emoji?: string;
  category?: string;
  color?: string;
  archived?: boolean;
  specialRequest?: boolean;
  /** Catalog mint vs member special ask — admin-visible. */
  origin?: RewardOrigin;
  createdByMemberId?: string;
  createdByName?: string;
};

export type Badge = {
  id: string;
  title: string;
  icon: string;
  progress: number;
};

export type NovaBriefing = {
  title: string;
  summary: string;
  actions: string[];
};

export type NovaRecommendation = {
  id: string;
  title: string;
  detail: string;
  tone: 'blue' | 'cyan' | 'green' | 'amber' | 'red';
};

export type NovaWeeklyBriefing = {
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

export type NovaConversationAnswer = {
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
  repeat: HouseholdTask['repeat'];
  description?: string;
  weight?: number;
  difficulty?: TaskDifficulty;
  proofRequired?: boolean;
  dueAt?: string;
  roomId?: string;
  /** Shared-device profile id when the task was routed through a shared phone/tablet. */
  sharedDeviceId?: string;
  /** When true, also save into household custom catalog (admin mint). */
  saveAsTemplate?: boolean;
};

export type CreateGroceryInput = {
  name: string;
  category: string;
  barcode?: string;
  quantity?: string;
  typicalPrice?: number;
  salePrice?: number;
  aisle?: string;
  storeId?: string;
  requestedBy?: string;
  location?: GroceryItem['location'];
  note?: string;
  /** Wishlist items for kids who met XP threshold. */
  wishlist?: boolean;
};

export type CreateItineraryInput = {
  title: string;
  date: string;
  stops: Omit<ItineraryStop, 'id' | 'status'>[];
  suggestedByNova?: boolean;
  summary?: string;
};

export type CreateRewardInput = {
  title: string;
  cost: number;
  approvalRequired?: boolean;
  emoji?: string;
  specialRequest?: boolean;
  category?: string;
  color?: string;
  origin?: RewardOrigin;
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

export type NovaNotificationPrefs = {
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

/** Activity feed entry from Nova Monitor Agent. */
export type NovaMonitorAction = {
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
  type: HouseholdType;
  /** Selected during create (name → type → rooms). Defaults applied when omitted. */
  rooms?: HouseholdRoom[];
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
  /** Make accent theme id (ocean/aurora/…). */
  accentThemeId?: string;
  taskTemplates: TaskTemplate[];
  notificationPrefs: NovaNotificationPrefs;
  /** What non-admin members may do (admin-controlled). */
  memberCapabilities?: MemberCapabilities;
  rewards: Reward[];
  badges: Badge[];
  nova: NovaBriefing;
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

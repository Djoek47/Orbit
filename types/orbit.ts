export type HouseholdRole = 'owner' | 'admin' | 'adult' | 'child' | 'guest';

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
  /** ISO date YYYY-MM-DD — member away / on holiday (Nova skips nudges). */
  awayFrom?: string;
  awayTo?: string;
};

export type TaskDifficulty = 'easy' | 'medium' | 'hard';

export type HouseholdTask = {
  id: string;
  title: string;
  description?: string;
  category: string;
  assignee: string;
  due: string;
  xp: number;
  /** Weight multiplier for XP (1 = easy, 1.5 = medium, 2 = hard). */
  weight?: number;
  difficulty?: TaskDifficulty;
  proofRequired?: boolean;
  proofUri?: string;
  proofStatus?: 'none' | 'submitted' | 'approved' | 'rejected';
  repeat: 'None' | 'Daily' | 'Weekly' | 'Weekdays';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  dueAt?: string;
  /** Optional room for cleaning attribution. */
  roomId?: string;
};

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

export type ItineraryStopKind = 'school' | 'work' | 'grocery' | 'pickup' | 'custom';

export type ItineraryStopStatus = 'pending' | 'active' | 'done' | 'skipped';

export type ItineraryStop = {
  id: string;
  label: string;
  kind: ItineraryStopKind;
  address?: string;
  placeQuery?: string;
  eventId?: string;
  groceryListId?: string;
  etaMinutes?: number;
  sortOrder: number;
  status: ItineraryStopStatus;
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
  source?: 'mock' | 'openfoodfacts';
};

export type PreferredStore = {
  id: string;
  name: string;
  address: string;
  placeQuery: string;
};

export type Reward = {
  id: string;
  title: string;
  cost: number;
  approvalRequired: boolean;
  emoji?: string;
  archived?: boolean;
  specialRequest?: boolean;
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
};

export type CreateTaskInput = {
  title: string;
  category: string;
  assignee: string;
  due: string;
  xp: number;
  repeat: HouseholdTask['repeat'];
  description?: string;
  weight?: number;
  difficulty?: TaskDifficulty;
  proofRequired?: boolean;
  dueAt?: string;
  roomId?: string;
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
};

export type CreateHouseholdInput = {
  name: string;
  type: HouseholdType;
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
  preferredStoreId?: string;
  /** Make accent theme id (ocean/aurora/…). */
  accentThemeId?: string;
  taskTemplates: TaskTemplate[];
  notificationPrefs: NovaNotificationPrefs;
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

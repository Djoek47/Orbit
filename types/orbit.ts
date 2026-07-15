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
};

export type HouseholdTask = {
  id: string;
  title: string;
  description?: string;
  category: string;
  assignee: string;
  due: string;
  xp: number;
  repeat: 'None' | 'Daily' | 'Weekly' | 'Weekdays';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
};

export type GroceryItem = {
  id: string;
  name: string;
  category: string;
  quantity: string;
  location: 'Fridge' | 'Freezer' | 'Pantry' | 'Bathroom' | 'Cleaning';
  status: 'Available' | 'Low' | 'Missing' | 'Purchased';
};

export type HouseholdEvent = {
  id: string;
  title: string;
  category: 'School' | 'Activity' | 'Appointment' | 'Family' | 'Routine';
  date: string;
  time: string;
  location: string;
  responsible: string;
};

export type Reward = {
  id: string;
  title: string;
  cost: number;
  approvalRequired: boolean;
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
};

export type CreateGroceryInput = {
  name: string;
  category: string;
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

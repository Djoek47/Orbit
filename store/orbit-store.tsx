import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { dataMode } from '@/config/data-mode';
import { createEmptyHousehold, mockHousehold } from '@/data/mock-household';
import { loadActiveMemberId, loadMockSession, saveActiveMemberId } from '@/lib/auth/mock-session';
import type { PoppinsChatMessage } from '@/lib/ai/ai-provider';
import { trackAnalytics } from '@/lib/analytics';
import { evaluateAchievements, getLevel, LEVELS, MEMBER_ACCENTS, memberDisplayEmoji, xpProgress } from '@/lib/game-levels';
import { getLocationAwareGrocerySuggestions, buildStoreRecommendations } from '@/lib/grocery/location-suggestions';
import { countUpcomingSoon } from '@/lib/calendar/event-groups';
import {
  loadHouseholdRooms,
  loadMemberAvatarOverrides,
  saveHouseholdRooms,
  saveMemberAvatarOverride,
} from '@/lib/household/local-prefs';
import { saveChildInviteRecord, loadChildInviteRecord } from '@/lib/household/child-invites';
import {
  applyStoredHouseholdLogicPrefs,
  saveMemberCapabilitiesPrefs,
  saveRewardSettings,
} from '@/lib/household/reward-settings-prefs';
import { saveActiveMockHousehold } from '@/lib/household/mock-active-household';
import { resolveMemberByProfileCode } from '@/lib/household/profile-codes';
import { buildInviteLinks, normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import { suggestItineraryFromHousehold } from '@/lib/calendar/suggest-itinerary';
import {
  isNotificationVisibleToMember,
  PROOF_REVIEW_ROLES,
  REWARD_REVIEW_ROLES,
} from '@/lib/notifications/audience';
import { registerForPushNotifications, scheduleLocalReminder } from '@/lib/notifications/push';
import { getPermissionsForRole, type HouseholdPermissions } from '@/lib/permissions';
import { getV2Permissions } from '@/lib/permissions-v2';
import { persistHouseholdScore } from '@/lib/momentum/score-writer';
import { subscribeHouseholdRealtime } from '@/lib/realtime/household-realtime';
import {
  DEFAULT_REWARD_MODEL,
  capabilitiesFor,
  type RewardModel,
  type RewardModelCapabilities,
} from '@/lib/rewards/reward-model';
import { normalizeRewardSettings } from '@/lib/rewards/reward-mode';
import { formatLocalDate } from '@/lib/streaks/local-date';
import {
  ensureOccurrencesForDay,
  rolloverMissedOccurrences,
  seriesDefinitionId,
} from '@/lib/tasks/recurring';
import { completedLateFlag } from '@/lib/tasks/occurrence-status';
import {
  autoConfirmUnreviewed,
  confirmTaskVerification,
  markTaskNotDone,
  requestAnotherProofOnTask,
  resubmitProofPhoto,
} from '@/lib/tasks/proof-actions';
import { initialVerification } from '@/lib/tasks/verification';
import {
  allSharesCompleted,
  allSharesSettled,
  getShare,
  getTaskAssignees,
  isSplitTask,
  splitAllDoneBonus,
  splitPenaltyAmount,
  splitShareXp,
  taskMatchesAssignee,
} from '@/lib/tasks/split-assign';
import { splitOpenTasksBetweenTwo } from '@/lib/tasks/split-between';
import { isOpenTask, isSameTaskSeries } from '@/lib/tasks/cancel';
import { isTodayTask } from '@/lib/tasks/today';
import { isTaskLate, resolveCompletionXp } from '@/lib/tasks/xp';
import { recordCompletionForTrophies } from '@/lib/trophies/runtime';
import {
  canPromoteToAdmin,
  resolveSplitPair,
} from '@/lib/household/admins';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import {
  resolveMemberCapabilities,
} from '@/lib/member-capabilities';
import {
  clearMockHouseholdSnapshot,
  persistMockHouseholdSnapshot,
} from '@/repositories/household-repository';
import {
  authRepository,
  calendarRepository,
  groceryRepository,
  householdRepository,
  itineraryRepository,
  notificationsRepository,
  poppinsRepository,
  rewardsRepository,
  smartHomeRepository,
  taskRepository,
} from '@/repositories';
import {
  DEFAULT_ACCENT_THEME_ID,
  getAccentTheme,
  type AccentTheme,
  type AccentThemeId,
} from '@/constants/accent-themes';
import { DEFAULT_HOUSEHOLD_ROOMS } from '@/data/household-rooms';
import { loadPoppinsNotificationPrefs, savePoppinsNotificationPrefs } from '@/lib/poppins/prefs-store';
import {
  applyStoredMemberThemes,
  loadAccentThemeId,
  saveAccentThemeId,
  saveMemberAccentThemeId,
} from '@/lib/theme/accent-prefs';
import {
  loadAppearanceMode,
  loadBackgroundThemeId,
  loadPaletteId,
  loadPreferredMapsApp,
  resolveTheme,
  saveAppearanceMode,
  saveBackgroundThemeId,
  savePaletteId,
  savePreferredMapsApp,
  type AppearanceMode,
  type PreferredMapsApp,
} from '@/lib/theme/appearance-prefs';
import {
  DEFAULT_BACKGROUND_THEME_ID,
  type BackgroundThemeId,
} from '@/constants/background-themes';
import {
  DEFAULT_COLOR_PALETTE_ID,
  isColorPaletteId,
  migrateColorPaletteId,
  type ColorPaletteId,
} from '@/constants/color-palettes';
import type { OrbitColorPalette } from '@/constants/orbit-theme';
import { openDirections, openMultiStopRoute } from '@/lib/maps/directions';
import { DEFAULT_POPPINS_NOTIFICATION_PREFS, poppinsNotifications } from '@/services/poppins-notifications';
import { runMonitorPass } from '@/services/poppins-monitor';
import { poppinsService, suggestedPoppinsQuestions } from '@/services/poppins-service';
import type {
  AuthSession,
  CancelTaskScope,
  CreateEventInput,
  CreateGroceryInput,
  CreateHouseholdInput,
  CreateItineraryInput,
  CreateProfileInput,
  AllowanceGrant,
  CreateAllowanceInput,
  CreateRewardInput,
  CreateTaskInput,
  HouseholdEvent,
  HouseholdMember,
  HouseholdRole,
  HouseholdRoom,
  HouseholdSnapshot,
  HouseholdTask,
  InviteLinks,
  Itinerary,
  JoinHouseholdInput,
  MemberCapabilities,
  MemberProgress,
  NotificationItem,
  PoppinsBriefing,
  PoppinsConversationAnswer,
  PoppinsMonitorAction,
  PoppinsNotificationPrefs,
  PoppinsRecommendation,
  PoppinsWeeklyBriefing,
  OrbitUser,
  OrbitMetrics,
  PreferredStore,
  RewardRedemption,
  SavedPlace,
  SignInInput,
  SignUpInput,
  SmartHomeDevice,
  SmartHomeScene,
  StoreRecommendation,
  TaskTemplate,
} from '@/types/orbit';
import { CHILD_GROCERY_WISHLIST_XP } from '@/data/task-presets';
import { getPreferredStore } from '@/data/preferred-stores';

type OrbitContextValue = {
  currentUser: OrbitUser | null;
  currentMember: HouseholdMember | undefined;
  activeMemberId: string | null;
  household: HouseholdSnapshot;
  hasHousehold: boolean;
  isPendingMember: boolean;
  isLoading: boolean;
  isSignedIn: boolean;
  metrics: OrbitMetrics;
  membersWithProgress: MemberProgress[];
  achievements: ReturnType<typeof evaluateAchievements>;
  poppinsAskCount: number;
  poppinsConversation: PoppinsChatMessage[];
  poppinsBriefing: PoppinsBriefing;
  poppinsRecommendations: PoppinsRecommendation[];
  poppinsMonitorActions: PoppinsMonitorAction[];
  poppinsWeeklyBriefing: PoppinsWeeklyBriefing;
  permissions: HouseholdPermissions;
  /** v2 Admin/Member capability matrix (§1.6). */
  v2Permissions: ReturnType<typeof getV2Permissions>;
  /** Derived from household.rewardModel (§2.2). */
  rewardCapabilities: RewardModelCapabilities;
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  pendingRedemptions: RewardRedemption[];
  /** Full redeem ledger (pending + decided) for the tally subpage. */
  redemptions: RewardRedemption[];
  allowances: AllowanceGrant[];
  pendingAllowances: AllowanceGrant[];
  smartHomeDevices: SmartHomeDevice[];
  smartHomeScenes: SmartHomeScene[];
  storeRecommendations: StoreRecommendation[];
  inviteLinks: InviteLinks | null;
  askPoppins: (question: string) => Promise<PoppinsConversationAnswer>;
  askPoppinsVoice: (audioUri: string | null) => Promise<PoppinsConversationAnswer>;
  appendPoppinsTurn: (question: string, answer: string) => void;
  switchPersona: (memberId: string) => void;
  approveMember: (memberId: string) => Promise<void>;
  declineMember: (memberId: string) => Promise<void>;
  createHousehold: (input: CreateHouseholdInput) => Promise<HouseholdSnapshot | null>;
  createProfile: (input: CreateProfileInput) => Promise<void>;
  /** Rename the signed-in user (profile + owner member + greeting). */
  updateDisplayName: (name: string, avatar?: string) => Promise<void>;
  /** Admin: rename any household member display name. */
  updateMemberDisplayName: (memberId: string, name: string) => Promise<void>;
  createTask: (
    input: CreateTaskInput,
    options?: { householdId?: string | null }
  ) => Promise<HouseholdTask | null>;
  updateTask: (task: HouseholdTask) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  completeTask: (
    taskId: string,
    options?: { forAssignee?: string }
  ) => Promise<{
    awarded: number;
    penalty: number;
    late: boolean;
    bonus?: number;
    /** Proof should be attached after this completion (preset / create flag). */
    needsProof?: boolean;
  } | null>;
  submitTaskProof: (taskId: string, proofUri: string, options?: { forAssignee?: string }) => Promise<void>;
  approveTaskProof: (taskId: string, options?: { forAssignee?: string }) => Promise<void>;
  /** Admin: confirm completion verification (XP already awarded). */
  confirmVerification: (taskId: string) => Promise<boolean>;
  /** Admin: ask for another photo (max 3 rounds). XP untouched. */
  requestAnotherProof: (taskId: string, note?: string) => Promise<boolean>;
  /** Admin: reverse XP and return task to pending/missed within 7 days. */
  markNotDone: (taskId: string, note?: string) => Promise<boolean>;
  /** Foreground catch-up: auto-confirm, materialise occurrences, mark missed. */
  runOccurrenceCatchUp: () => Promise<void>;
  /** Admin: dock XP from someone who did not finish their share of a split task. */
  penalizeSplitAssignee: (taskId: string, assigneeName: string) => Promise<number | null>;
  /** Reassign overdue / unfinished work — new assignee earns XP on complete. */
  reassignTask: (taskId: string, newAssigneeName: string) => Promise<void>;
  /** Award daily streak once when today's tasks are all done. */
  awardDailyStreak: () => Promise<number | null>;
  /**
   * Streak Rescue — member must press the confirmation prompt
   * (confirmedViaPrompt). Free first rescue still requires that tap.
   * XP cost settles at week close via the rescue accrual ledger.
   */
  redeemStreak: () => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<void>;
  /** Admin-only soft cancel (keeps history). `future` also stops the recurring series. */
  cancelTask: (taskId: string, scope?: CancelTaskScope) => Promise<void>;
  /** Evenly reassign every open task between the two family admins (or two chosen members). */
  splitAllTasksBetweenTwo: (nameA?: string, nameB?: string) => Promise<void>;
  addMissingGrocery: (input: CreateGroceryInput) => void;
  setPreferredStore: (storeId: string) => void;
  preferredStore: PreferredStore;
  joinHousehold: (input: JoinHouseholdInput) => Promise<void>;
  markGroceryPurchased: (itemId: string) => void;
  markGroceryMissing: (itemId: string) => void;
  markGroceryLow: (itemId: string) => void;
  createEvent: (input: CreateEventInput) => Promise<void>;
  updateEvent: (event: HouseholdEvent) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  remindAboutEvent: (eventId: string) => Promise<void>;
  createItinerary: (input: CreateItineraryInput) => Promise<Itinerary | null>;
  suggestPoppinsItinerary: (options?: {
    date?: string;
    mode?: 'efficient' | 'spread';
    eventIds?: string[];
  }) => Promise<Itinerary | null>;
  advanceItineraryStop: (itineraryId: string, stopId: string) => Promise<void>;
  openStopInMaps: (itineraryId: string, stopId: string) => Promise<void>;
  reorderItineraryStops: (itineraryId: string, stopIds: string[]) => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  hydrateFromSession: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean; email: string }>;
  suggestedPoppinsQuestions: readonly string[];
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  pushNotification: (input: {
    title: string;
    body: string;
    category: NotificationItem['category'];
    priority?: NotificationItem['priority'];
    data?: Record<string, unknown>;
    /** When set, notification is attributed to this user (e.g. admin inbox). */
    userId?: string | null;
  }) => Promise<NotificationItem | null>;
  updateNotificationPrefs: (prefs: Partial<PoppinsNotificationPrefs>) => void;
  updateMemberCapabilities: (prefs: Partial<MemberCapabilities>) => void;
  /** Parent/admin: Meritocracy vs Equity + hygiene XP opt-in (household-scoped). */
  updateHouseholdRewardSettings: (prefs: {
    rewardMode?: 'weighted' | 'flat';
    hygieneRewarded?: boolean;
    hygieneXp?: 5 | 10;
  }) => void;
  /** Parent/admin: XP system (xp_only / allowance / rewards / full) — changeable in Settings. */
  updateHouseholdRewardModel: (model: RewardModel) => void;
  /** Updates the current member’s personal look (follows persona switches). */
  updateAccentTheme: (themeId: AccentThemeId) => void;
  /** Unified palette wheel — day/night pairs live on the palette. */
  updatePalette: (paletteId: ColorPaletteId) => void;
  /** Owner/admin: household fallback theme for members without a personal pick. */
  updateHouseholdAccentTheme: (themeId: AccentThemeId) => void;
  accentTheme: AccentTheme;
  paletteId: ColorPaletteId;
  appearanceMode: AppearanceMode;
  updateAppearanceMode: (mode: AppearanceMode) => void;
  /** @deprecated Background packs folded into palette day/night. */
  backgroundThemeId: BackgroundThemeId;
  updateBackgroundTheme: (themeId: BackgroundThemeId) => void;
  /** Resolved surface palette (palette + day/night/system). */
  orbitPalette: OrbitColorPalette & { isDark: boolean };
  preferredMapsApp: PreferredMapsApp;
  updatePreferredMapsApp: (app: PreferredMapsApp) => void;
  openFullItineraryInMaps: (itineraryId: string) => Promise<void>;
  toggleItineraryFavorite: (itineraryId: string) => Promise<void>;
  rerunItinerary: (itineraryId: string) => Promise<Itinerary | null>;
  upsertSavedPlace: (place: SavedPlace) => void;
  removeSavedPlace: (placeId: string) => void;
  updateMemberAvatar: (memberId: string, avatar: string) => Promise<void>;
  upsertRoom: (room: HouseholdRoom) => void;
  removeRoom: (roomId: string) => void;
  runPoppinsMonitor: () => Promise<PoppinsMonitorAction[]>;
  requestRewardRedemption: (rewardId: string, note?: string) => Promise<void>;
  /** Hold-to-claim: Instant spends XP now; Approval submits a pending request. */
  claimReward: (rewardId: string) => Promise<'claimed' | 'requested' | null>;
  requestSpecialReward: (title: string, note?: string, cost?: number) => Promise<void>;
  createReward: (
    input: CreateRewardInput,
    options?: { householdId?: string | null }
  ) => Promise<void>;
  archiveReward: (rewardId: string) => Promise<void>;
  approveRedemption: (redemptionId: string) => Promise<void>;
  rejectRedemption: (redemptionId: string) => Promise<void>;
  /** Admin: grant allowance to a member instantly. */
  grantAllowance: (input: Omit<CreateAllowanceInput, 'kind'>) => Promise<AllowanceGrant | null>;
  /** Member (or admin testing): request an allowance for approval. */
  requestAllowance: (input: Omit<CreateAllowanceInput, 'kind' | 'memberId' | 'memberName'>) => Promise<AllowanceGrant | null>;
  approveAllowance: (allowanceId: string) => Promise<void>;
  rejectAllowance: (allowanceId: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: HouseholdRole) => Promise<void>;
  /** Create a shared-device profile (phone/tablet) that multiple people can use. */
  createSharedDevice: (name?: string) => Promise<HouseholdMember | null>;
  /** Link / unlink household people on a shared-device profile. */
  updateSharedDeviceLinks: (deviceId: string, memberIds: string[]) => Promise<void>;
  /**
   * Admin creates 1–2 kid profiles (no child email). Invites are AirDrop/shareable.
   * Household data stays on the admin account.
   */
  createChildInvites: (
    names: string[],
    options?: { householdId?: string | null; householdName?: string }
  ) => Promise<HouseholdMember[]>;
  /** Persist onboarding roster drafts into household_members (explicit household id). */
  addOnboardingMembers: (
    householdId: string,
    drafts: { name: string; role: 'admin' | 'member' }[],
    options?: { householdName?: string }
  ) => Promise<HouseholdMember[]>;
  /** Child device: redeem invite code / QR with no sign-up. */
  redeemChildInvite: (rawCode: string) => Promise<HouseholdMember>;
  /**
   * Shared / tablet onboarding: host one or more profile invite codes (AirDrop/QR)
   * with no email on the tablet. Admin account remains the data owner.
   */
  connectSharedTabletProfiles: (
    rawCodes: string[],
    deviceLabel?: string,
  ) => Promise<{ members: HouseholdMember[]; needsProfilePick: boolean }>;
  removeMember: (memberId: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  exportUserData: () => Promise<string>;
  toggleSmartDevice: (deviceId: string) => Promise<void>;
  activateSmartScene: (sceneId: string) => Promise<void>;
  refreshStoreRecommendations: () => Promise<void>;
  refreshInviteLinks: () => Promise<InviteLinks | null>;
  refreshSmartHome: () => Promise<void>;
  refreshHousehold: () => Promise<void>;
  canAddGroceryWishlist: boolean;
};

const OrbitContext = createContext<OrbitContextValue | null>(null);

export function OrbitProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<OrbitUser | null>(null);
  const [household, setHousehold] = useState<HouseholdSnapshot>(mockHousehold);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pendingRedemptions, setPendingRedemptions] = useState<RewardRedemption[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [allowances, setAllowances] = useState<AllowanceGrant[]>([]);
  const pendingAllowances = useMemo(
    () => allowances.filter((item) => item.status === 'pending'),
    [allowances]
  );
  const [smartHomeDevices, setSmartHomeDevices] = useState<SmartHomeDevice[]>([]);
  const [smartHomeScenes, setSmartHomeScenes] = useState<SmartHomeScene[]>([]);
  const [storeRecommendations, setStoreRecommendations] = useState<StoreRecommendation[]>([]);
  const [inviteLinks, setInviteLinks] = useState<InviteLinks | null>(null);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [poppinsAskCount, setPoppinsAskCount] = useState(0);
  const [poppinsConversation, setPoppinsConversation] = useState<PoppinsChatMessage[]>([]);
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>('dark');
  const [paletteId, setPaletteId] = useState<ColorPaletteId>(DEFAULT_COLOR_PALETTE_ID);
  const [backgroundThemeId, setBackgroundThemeId] = useState<BackgroundThemeId>(
    DEFAULT_BACKGROUND_THEME_ID
  );
  const [preferredMapsApp, setPreferredMapsApp] = useState<PreferredMapsApp>('auto');
  const initialMetrics = useMemo(() => calculateMetrics(mockHousehold), []);
  const [poppinsWeeklyBriefing, setPoppinsWeeklyBriefing] = useState<PoppinsWeeklyBriefing>(() =>
    poppinsService.generateWeeklyBriefing(mockHousehold, initialMetrics)
  );
  const [poppinsRecommendations, setPoppinsRecommendations] = useState<PoppinsRecommendation[]>(() =>
    poppinsService.generateRecommendations(mockHousehold, initialMetrics)
  );
  const [poppinsMonitorActions, setPoppinsMonitorActions] = useState<PoppinsMonitorAction[]>([]);

  const currentMember = useMemo(() => {
    if (activeMemberId) {
      return household.members.find((m) => m.id === activeMemberId) ?? household.members[0];
    }
    return (
      household.members.find((m) => m.name === currentUser?.name) ??
      household.members.find((m) => m.role === 'owner') ??
      household.members[0]
    );
  }, [activeMemberId, currentUser?.name, household.members]);
  const hasHousehold = Boolean(currentUser && household.id);
  const isPendingMember = currentMember?.status === 'pending';
  const permissions = useMemo(() => {
    // Pending joiners wait for owner/admin approval — same surface limits as guests.
    if (currentMember?.status === 'pending') {
      return getPermissionsForRole('guest');
    }
    return getPermissionsForRole(currentMember?.role ?? 'guest');
  }, [currentMember?.role, currentMember?.status]);
  const v2Permissions = useMemo(
    () => getV2Permissions(currentMember?.role),
    [currentMember?.role]
  );
  const rewardCapabilities = useMemo(
    () => capabilitiesFor(household.rewardModel ?? DEFAULT_REWARD_MODEL),
    [household.rewardModel]
  );
  const metrics = useMemo(() => calculateMetrics(household), [household]);
  const membersWithProgress = useMemo(
    () => household.members.map((member) => calculateMemberProgress(member, household.tasks)),
    [household.members, household.tasks]
  );
  const achievements = useMemo(
    () => evaluateAchievements(household, { poppinsAskCount, focusMemberName: currentMember?.name }),
    [household, poppinsAskCount, currentMember?.name]
  );
  const poppinsBriefing = useMemo(() => household.poppins, [household.poppins]);
  const visibleNotifications = useMemo(
    () =>
      notifications.filter((item) =>
        isNotificationVisibleToMember(
          item,
          currentMember ? { id: currentMember.id, role: currentMember.role } : null
        )
      ),
    [currentMember?.id, currentMember?.role, notifications]
  );
  const unreadNotificationCount = useMemo(
    () => visibleNotifications.filter((item) => !item.isRead).length,
    [visibleNotifications]
  );

  const analyticsContext = useMemo(
    () => ({ householdId: household.id, userId: currentUser?.id ?? null }),
    [currentUser?.id, household.id]
  );

  const refreshNotifications = useCallback(async () => {
    const items = await notificationsRepository.list(household.id);
    setNotifications(items);
  }, [household.id]);

  const refreshSmartHome = useCallback(async () => {
    if (household.id) {
      await smartHomeRepository.ensureMockSeed(household.id);
    }
    const [devices, scenes] = await Promise.all([
      smartHomeRepository.listDevices(household.id),
      smartHomeRepository.listScenes(household.id),
    ]);
    setSmartHomeDevices(devices);
    setSmartHomeScenes(scenes);
  }, [household.id]);

  const refreshStoreRecommendations = useCallback(async () => {
    try {
      const { recommendations } = await getLocationAwareGrocerySuggestions(household.id, household.groceries);
      setStoreRecommendations(recommendations);
    } catch {
      setStoreRecommendations(buildStoreRecommendations(household.id, household.groceries));
    }
  }, [household.groceries, household.id]);

  const refreshInviteLinks = useCallback(async () => {
    if (!household.id) {
      setInviteLinks(null);
      return null;
    }
    const links = await householdRepository.getInviteLink(household.id);
    setInviteLinks(links);
    setHousehold((current) => ({ ...current, inviteCode: links.code }));
    return links;
  }, [household.id]);

  const reloadHouseholdDomains = useCallback(async () => {
    const baseHousehold = await householdRepository.getHousehold();
    const hydratedHousehold = await hydrateHousehold(baseHousehold);
    setHousehold(hydratedHousehold);
    await Promise.all([
      notificationsRepository.list(hydratedHousehold.id).then(setNotifications),
      rewardsRepository.getRedemptions(hydratedHousehold.id).then((items) => {
        setRedemptions(items);
        setPendingRedemptions(items.filter((item) => item.status === 'pending'));
      }),
      rewardsRepository.getAllowances(hydratedHousehold.id).then(setAllowances),
      smartHomeRepository.listDevices(hydratedHousehold.id).then(setSmartHomeDevices),
      smartHomeRepository.listScenes(hydratedHousehold.id).then(setSmartHomeScenes),
    ]);
    setStoreRecommendations(buildStoreRecommendations(hydratedHousehold.id, hydratedHousehold.groceries));
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      const session = await authRepository.getCurrentSession();

      if (!session) {
        if (isMounted) {
          const [prefs, themeId, savedRooms, avatarOverrides, appearance, bgTheme, mapsApp, palette] =
            await Promise.all([
              loadPoppinsNotificationPrefs(mockHousehold.id),
              loadAccentThemeId(mockHousehold.id),
              loadHouseholdRooms(mockHousehold.id),
              loadMemberAvatarOverrides(mockHousehold.id),
              loadAppearanceMode(),
              loadBackgroundThemeId(mockHousehold.id),
              loadPreferredMapsApp(),
              loadPaletteId(mockHousehold.id),
            ]);
          setAppearanceMode(appearance);
          setBackgroundThemeId(bgTheme);
          setPaletteId(palette);
          setPreferredMapsApp(mapsApp);
          const withAvatars = mockHousehold.members.map((member) =>
            avatarOverrides[member.id] ? { ...member, avatar: avatarOverrides[member.id] } : member,
          );
          const themedMembers = await applyStoredMemberThemes(mockHousehold.id, withAvatars);
          setHousehold((current) => ({
            ...current,
            notificationPrefs: prefs,
            accentThemeId: themeId,
            rooms: savedRooms?.length
              ? savedRooms
              : current.rooms?.length
                ? current.rooms
                : DEFAULT_HOUSEHOLD_ROOMS.map((r) => ({ ...r })),
            members: themedMembers.length ? themedMembers : current.members,
          }));
          setStoreRecommendations(buildStoreRecommendations(mockHousehold.id, mockHousehold.groceries));
          const items = await notificationsRepository.list(mockHousehold.id);
          setNotifications(items);
          await smartHomeRepository.ensureMockSeed(mockHousehold.id ?? 'hh-rivera');
          const [devices, scenes] = await Promise.all([
            smartHomeRepository.listDevices(mockHousehold.id),
            smartHomeRepository.listScenes(mockHousehold.id),
          ]);
          setSmartHomeDevices(devices);
          setSmartHomeScenes(scenes);
          setIsLoading(false);
        }
        return;
      }

      const baseHousehold = await householdRepository.getHousehold();
      let hydratedHousehold = await hydrateHousehold(baseHousehold);

      if (!hydratedHousehold.id && session.user) {
        const pending = await householdRepository.getPendingHouseholdSnapshot(session.user);
        if (pending) {
          hydratedHousehold = pending;
        }
      }

      if (isMounted) {
        const [prefs, themeId, appearance, bgTheme, mapsApp, storedMemberId, mockStored, palette] =
          await Promise.all([
            loadPoppinsNotificationPrefs(hydratedHousehold.id),
            loadAccentThemeId(hydratedHousehold.id),
            loadAppearanceMode(),
            loadBackgroundThemeId(hydratedHousehold.id, session.user.id),
            loadPreferredMapsApp(),
            loadActiveMemberId(),
            dataMode === 'mock' ? loadMockSession() : Promise.resolve(null),
            loadPaletteId(hydratedHousehold.id, session.user.id),
          ]);
        setAppearanceMode(appearance);
        setBackgroundThemeId(bgTheme);
        setPaletteId(palette);
        setPreferredMapsApp(mapsApp);
        setCurrentUser(session.user);
        setHousehold({
          ...hydratedHousehold,
          greetingName: session.user.name || hydratedHousehold.greetingName,
          notificationPrefs: prefs,
          accentThemeId: themeId,
          rooms: hydratedHousehold.rooms?.length
            ? hydratedHousehold.rooms
            : DEFAULT_HOUSEHOLD_ROOMS.map((r) => ({ ...r })),
        });
        const resumeMemberId =
          mockStored?.activeMemberId ||
          storedMemberId ||
          hydratedHousehold.members.find(
            (member) =>
              member.status === 'active' &&
              member.name.toLowerCase() === session.user.name.toLowerCase(),
          )?.id ||
          null;
        if (resumeMemberId) {
          setActiveMemberId(resumeMemberId);
        }
        const history = await poppinsRepository.getConversationHistory(
          hydratedHousehold.id,
          session.user.id
        );
        setPoppinsConversation(history);
        setStoreRecommendations(buildStoreRecommendations(hydratedHousehold.id, hydratedHousehold.groceries));
        const [items, redemptions, allowanceItems, devices, scenes, links] = await Promise.all([
          notificationsRepository.list(hydratedHousehold.id),
          rewardsRepository.getRedemptions(hydratedHousehold.id),
          rewardsRepository.getAllowances(hydratedHousehold.id),
          smartHomeRepository.listDevices(hydratedHousehold.id),
          smartHomeRepository.listScenes(hydratedHousehold.id),
          hydratedHousehold.id
            ? householdRepository.getInviteLink(hydratedHousehold.id)
            : Promise.resolve(null),
        ]);
        setNotifications(items);
        setRedemptions(redemptions);
        setPendingRedemptions(redemptions.filter((item) => item.status === 'pending'));
        setAllowances(allowanceItems);
        setSmartHomeDevices(devices);
        setSmartHomeScenes(scenes);
        if (links) {
          setInviteLinks(links);
        }
        setIsLoading(false);
      }
    }

    hydrate().catch((error) => {
      console.warn('Failed to hydrate Orbit data', error);
      if (isMounted) {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (dataMode !== 'supabase' || !household.id) {
      return;
    }

    return subscribeHouseholdRealtime(household.id, () => {
      reloadHouseholdDomains().catch((error) => {
        console.warn('Failed to reload after realtime change', error);
      });
    });
  }, [household.id, reloadHouseholdDomains]);

  useEffect(() => {
    void refreshStoreRecommendations();
  }, [refreshStoreRecommendations]);

  const hydrateFromSession = async (session: AuthSession) => {
    const baseHousehold = await householdRepository.getHousehold();
    const hydratedHousehold = await hydrateHousehold({
      ...baseHousehold,
      greetingName: session.user.name || baseHousehold.greetingName,
    });

    setCurrentUser(session.user);
    await authRepository.persistLocalSession(session.user);
    setHousehold(hydratedHousehold);
    await trackAnalytics(
      'auth.session_hydrate',
      { email: session.user.email },
      { householdId: hydratedHousehold.id, userId: session.user.id }
    );
    const [items, redemptions, allowanceItems, devices, scenes] = await Promise.all([
      notificationsRepository.list(hydratedHousehold.id),
      rewardsRepository.getRedemptions(hydratedHousehold.id),
      rewardsRepository.getAllowances(hydratedHousehold.id),
      smartHomeRepository.listDevices(hydratedHousehold.id),
      smartHomeRepository.listScenes(hydratedHousehold.id),
    ]);
    setNotifications(items);
    setRedemptions(redemptions);
    setPendingRedemptions(redemptions.filter((item) => item.status === 'pending'));
    setAllowances(allowanceItems);
    setSmartHomeDevices(devices);
    setSmartHomeScenes(scenes);
    setStoreRecommendations(buildStoreRecommendations(hydratedHousehold.id, hydratedHousehold.groceries));
    registerForPushNotifications(session.user.id).catch((error) => {
      console.warn('Push registration skipped', error);
    });
  };

  const signIn = async (input: SignInInput) => {
    const session = await authRepository.signIn(input);
    await hydrateFromSession(session);
    await trackAnalytics('auth.sign_in', { email: input.email }, { userId: session.user.id });
  };

  const signUp = async (input: SignUpInput) => {
    const outcome = await authRepository.signUp(input);
    if (outcome.status === 'needs_confirmation') {
      await trackAnalytics('auth.sign_up_pending_confirm', { email: outcome.email });
      return { needsConfirmation: true, email: outcome.email };
    }

    setCurrentUser(outcome.session.user);
    setHousehold(createEmptyHousehold(outcome.session.user));
    await trackAnalytics('auth.sign_up', { email: input.email }, { userId: outcome.session.user.id });
    return { needsConfirmation: false, email: outcome.session.user.email };
  };

  const forgotPassword = async (email: string) => {
    await authRepository.forgotPassword(email);
    await trackAnalytics('auth.forgot_password', { email }, analyticsContext);
  };

  const createProfile = async (input: CreateProfileInput) => {
    if (!currentUser) {
      return;
    }

    const previousName = currentUser.name;
    const user = await authRepository.createProfile(currentUser, input);
    setCurrentUser(user);
    setHousehold((current) => {
      const next: HouseholdSnapshot = {
        ...current,
        greetingName: user.name,
        members: current.members.map((member) => {
          const isOwnerRow =
            member.role === 'owner' ||
            member.name === previousName ||
            member.name === current.greetingName;
          if (!isOwnerRow) return member;
          return {
            ...member,
            name: user.name,
            avatar:
              input.avatar?.trim() ||
              (member.avatar?.length === 1 ? user.name.charAt(0).toUpperCase() : member.avatar),
          };
        }),
      };
      if (dataMode === 'mock') {
        void persistMockHouseholdSnapshot(next);
      }
      return next;
    });
    await trackAnalytics('profile.created', { name: user.name }, { ...analyticsContext, userId: user.id });
  };

  const updateDisplayName = async (name: string, avatar?: string) => {
    await createProfile({ name, avatar });
  };

  const updateMemberDisplayName = async (memberId: string, name: string) => {
    if (!permissions.canManageHousehold && currentMember?.id !== memberId) {
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return;
    const updated = await householdRepository.updateMemberDisplayName(
      memberId,
      trimmed,
      household.id
    );
    setHousehold((current) => {
      const next = {
        ...current,
        greetingName:
          currentMember?.id === memberId || updated?.role === 'owner'
            ? trimmed
            : current.greetingName,
        members: current.members.map((member) =>
          member.id === memberId
            ? { ...member, name: trimmed, ...(updated ?? {}) }
            : member
        ),
      };
      if (dataMode === 'mock') {
        void persistMockHouseholdSnapshot(next);
      }
      return next;
    });
    if (currentMember?.id === memberId && currentUser) {
      await createProfile({ name: trimmed, avatar: currentUser.avatar });
    }
  };

  const createHousehold = async (input: CreateHouseholdInput): Promise<HouseholdSnapshot | null> => {
    if (!currentUser) {
      return null;
    }

    const createdHousehold = await householdRepository.createHousehold(input, currentUser);
    const rooms =
      input.rooms && input.rooms.length > 0
        ? input.rooms.map((room) => ({ ...room }))
        : createdHousehold.rooms?.length
          ? createdHousehold.rooms
          : DEFAULT_HOUSEHOLD_ROOMS.map((room) => ({ ...room }));
    const createdNext: HouseholdSnapshot = {
      ...createdHousehold,
      rooms,
      rewardModel: input.rewardModel ?? createdHousehold.rewardModel ?? DEFAULT_REWARD_MODEL,
      rewardMode: input.rewardMode ?? createdHousehold.rewardMode ?? 'weighted',
      setupComplete: input.setupComplete ?? createdHousehold.setupComplete ?? false,
    };
    setHousehold(createdNext);
    void saveHouseholdRooms(createdHousehold.id, rooms);
    if (dataMode === 'mock') {
      await persistMockHouseholdSnapshot(createdNext);
    }
    if (createdHousehold.id) {
      const links = createdHousehold.inviteCode
        ? buildInviteLinks(createdHousehold.inviteCode)
        : await householdRepository.getInviteLink(createdHousehold.id);
      setInviteLinks(links);
      if (createdHousehold.inviteCode) {
        setHousehold((current) => ({ ...current, inviteCode: createdHousehold.inviteCode }));
      }
    }
    await trackAnalytics('household.created', { name: input.name }, { householdId: createdHousehold.id, userId: currentUser.id });
    return createdNext;
  };

  const joinHousehold = async (input: JoinHouseholdInput) => {
    if (!currentUser) {
      return;
    }

    const joinedHousehold = await householdRepository.joinHousehold(input, currentUser);
    const pendingSelf =
      joinedHousehold.members.find(
        (member) => member.name === currentUser.name && member.status === 'pending'
      ) ?? joinedHousehold.members.find((member) => member.status === 'pending');
    setHousehold(joinedHousehold);
    if (pendingSelf) {
      setActiveMemberId(pendingSelf.id);
    }
    if (dataMode === 'mock') {
      await persistMockHouseholdSnapshot(joinedHousehold);
    }
    if (joinedHousehold.id) {
      await poppinsNotifications.joinPending(pushNotification, {
        memberName: currentUser.name,
        inviteCode: input.inviteCode,
      });
    }
    await trackAnalytics('household.joined', { inviteCode: input.inviteCode }, { householdId: joinedHousehold.id, userId: currentUser.id });
  };

  const signOut = async () => {
    await authRepository.signOut();
    await trackAnalytics('auth.sign_out', {}, analyticsContext);
    await clearMockHouseholdSnapshot();
    setCurrentUser(null);
    setHousehold(mockHousehold);
    setPendingRedemptions([]);
    setRedemptions([]);
    setInviteLinks(null);
    setActiveMemberId(null);
    void import('@/lib/device/device-session').then(({ markNeedsProfilePick }) =>
      markNeedsProfilePick()
    );
  };

  const createTask = async (
    input: CreateTaskInput,
    options?: { householdId?: string | null }
  ): Promise<HouseholdTask | null> => {
    const targetHouseholdId = options?.householdId ?? household.id;
    // Explicit householdId = onboarding materialize (owner perms not flushed yet).
    const allowOnboardingWrite = Boolean(options?.householdId && currentUser);
    if (
      !allowOnboardingWrite &&
      !v2Permissions.canAssignOrEditTask &&
      !permissions.canCreateTask
    ) {
      console.warn('createTask blocked: no assign/create permission', {
        role: currentMember?.role,
        v2: v2Permissions.canAssignOrEditTask,
        create: permissions.canCreateTask,
      });
      return null;
    }
    try {
      const task = await taskRepository.createTask(targetHouseholdId, input);
      // Functional update so batched assigns don't clobber each other with a stale closure.
      const nextHousehold = await new Promise<HouseholdSnapshot>((resolve) => {
        setHousehold((current) => {
          const nextTemplates: TaskTemplate[] = input.saveAsTemplate
            ? [
                {
                  id: `tpl-${task.id}`,
                  title: task.title,
                  category: task.category,
                  baseXp: input.xp,
                  difficulty: input.difficulty ?? 'easy',
                  weight: input.weight ?? 1,
                  repeat: task.repeat,
                  proofRequired: Boolean(input.proofRequired),
                  description: task.description,
                  householdScoped: true,
                },
                ...(current.taskTemplates ?? []),
              ]
            : current.taskTemplates ?? [];
          const next: HouseholdSnapshot = {
            ...current,
            tasks: [task, ...current.tasks],
            taskTemplates: nextTemplates,
          };
          resolve(next);
          return next;
        });
      });
      // Persist so getHousehold() → seedMockDomains cannot wipe newly assigned tasks.
      await persistMockHouseholdSnapshot(nextHousehold);
      await trackAnalytics('task.created', { taskId: task.id }, analyticsContext);
      return task;
    } catch (error) {
      console.warn('createTask failed', error);
      return null;
    }
  };

  const updateTask = async (task: HouseholdTask) => {
    if (!v2Permissions.canAssignOrEditTask && !permissions.canAssignTask) {
      return;
    }
    const updated = await taskRepository.updateTask(task);
    setHousehold((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === updated.id ? updated : item)),
    }));
    await trackAnalytics('task.updated', { taskId: updated.id }, analyticsContext);
  };

  const submitTaskProof = async (
    taskId: string,
    proofUri: string,
    options?: { forAssignee?: string }
  ) => {
    const currentTask = household.tasks.find((item) => item.id === taskId);
    if (!currentTask) {
      return;
    }

    const forAssignee =
      options?.forAssignee?.trim() ||
      (isSplitTask(currentTask) ? currentMember?.name : undefined) ||
      currentTask.assignee;

    const withProof = resubmitProofPhoto(currentTask, proofUri);
    let updated: HouseholdTask;
    if (isSplitTask(currentTask) && currentTask.shares) {
      updated = await taskRepository.updateTask({
        ...withProof,
        shares: currentTask.shares.map((share) =>
          share.name === forAssignee
            ? { ...share, proofUri, proofStatus: 'submitted' }
            : share
        ),
        status: currentTask.status === 'Pending' ? 'In Progress' : currentTask.status,
      });
    } else {
      updated = await taskRepository.updateTask(withProof);
    }

    setHousehold((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === taskId ? updated : item)),
    }));
    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    const created = await poppinsNotifications.proofSubmitted(pushNotification, prefs, {
      title: currentTask.title,
      assignee: forAssignee,
      taskId,
      proofUri,
      audienceRoles: [...PROOF_REVIEW_ROLES],
    });
    if (created) {
      await scheduleLocalReminder(created.title, created.body, 2).catch((error) =>
        console.warn('Proof admin reminder skipped', error)
      );
    }
    await trackAnalytics('task.proof_submitted', { taskId, forAssignee }, analyticsContext);
  };

  const approveTaskProof = async (taskId: string, options?: { forAssignee?: string }) => {
    await confirmVerification(taskId);
    void options;
  };

  const confirmVerification = async (taskId: string) => {
    if (!v2Permissions.canApproveCompletion) return false;
    const currentTask = household.tasks.find((item) => item.id === taskId);
    if (!currentTask || !currentMember) return false;
    const result = confirmTaskVerification(currentTask, currentMember.id);
    if (!result.ok) return false;
    const updated = await taskRepository.updateTask(result.task);
    setHousehold((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === taskId ? updated : item)),
    }));
    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    const assigneeMember = household.members.find((member) => member.name === currentTask.assignee);
    await poppinsNotifications.proofApproved(pushNotification, prefs, {
      title: currentTask.title,
      taskId,
      audienceRoles: assigneeMember ? [assigneeMember.role] : undefined,
    });
    await trackAnalytics('task.verification_confirmed', { taskId }, analyticsContext);
    return true;
  };

  const requestAnotherProof = async (taskId: string, note?: string) => {
    if (!v2Permissions.canRequestProof) return false;
    const currentTask = household.tasks.find((item) => item.id === taskId);
    if (!currentTask || !currentMember) return false;
    const result = requestAnotherProofOnTask(currentTask, currentMember.id, note);
    if (!result.ok) return false;
    const updated = await taskRepository.updateTask(result.task);
    setHousehold((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === taskId ? updated : item)),
    }));
    await pushNotification({
      title: 'Poppins · Another photo please',
      body: note?.trim()
        ? `${currentMember.name}: ${note.trim()}`
        : `${currentMember.name} asked for another photo of “${currentTask.title}”.`,
      category: 'tasks',
      priority: 'high',
      data: { taskId, kind: 'proof_requested' },
    });
    await trackAnalytics('task.proof_requested', { taskId }, analyticsContext);
    return true;
  };

  const markNotDone = async (taskId: string, note?: string) => {
    if (!v2Permissions.canApproveCompletion) return false;
    const currentTask = household.tasks.find((item) => item.id === taskId);
    if (!currentTask || !currentMember) return false;
    const result = markTaskNotDone(currentTask);
    if (!result.ok) return false;
    const updated = await taskRepository.updateTask(result.task);
    const reversed = result.reversedXp ?? 0;
    const completionDay = currentTask.completedAt
      ? formatLocalDate(new Date(currentTask.completedAt))
      : null;
    const todayKey = formatLocalDate(new Date());
    const remainingToday = household.tasks.some(
      (task) =>
        task.id !== taskId &&
        task.status === 'Completed' &&
        taskMatchesAssignee(task, currentTask.assignee) &&
        task.completedAt &&
        formatLocalDate(new Date(task.completedAt)) === (completionDay ?? todayKey)
    );
    setHousehold((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === taskId ? updated : item)),
      members: current.members.map((member) => {
        if (member.name !== currentTask.assignee) return member;
        const streak =
          !remainingToday && completionDay === todayKey
            ? Math.max(0, (member.streak ?? 0) - 1)
            : member.streak ?? 0;
        if (streak !== (member.streak ?? 0)) {
          void import('@/lib/streaks/mock-streak-store').then(({ syncChildStreakCurrent }) => {
            syncChildStreakCurrent(member.id, streak);
          });
        }
        return {
          ...member,
          xp: Math.max(0, member.xp - reversed),
          weekXp: Math.max(0, (member.weekXp ?? 0) - reversed),
          streak,
        };
      }),
    }));
    await pushNotification({
      title: 'Poppins · Not done yet',
      body: note?.trim()
        ? `${currentMember.name} marked “${currentTask.title}” as not done yet. ${note.trim()}`
        : `${currentMember.name} marked “${currentTask.title}” as not done yet.`,
      category: 'tasks',
      priority: 'high',
      data: { taskId, kind: 'marked_not_done', reversedXp: reversed },
    });
    await trackAnalytics('task.marked_not_done', { taskId, reversed }, analyticsContext);
    return true;
  };

  const runOccurrenceCatchUp = async () => {
    const now = new Date();
    let nextTasks = autoConfirmUnreviewed(household.tasks, now);

    // Cold-start: resolve intervening days (up to 14) then materialise today.
    const LOOKBACK_DAYS = 7;
    for (let offset = LOOKBACK_DAYS; offset >= 1; offset -= 1) {
      const day = new Date(now);
      day.setDate(day.getDate() - offset);
      const dayKey = formatLocalDate(day);
      nextTasks = rolloverMissedOccurrences(nextTasks, dayKey, now);
      const dayDrafts = ensureOccurrencesForDay(nextTasks, day);
      for (const draft of dayDrafts) {
        const exists = nextTasks.some(
          (t) =>
            t.definitionId === draft.definitionId &&
            t.occurrenceDate === draft.occurrenceDate
        );
        if (exists || !household.id) continue;
        const row = await taskRepository.createTask(household.id, {
          title: draft.title,
          description: draft.description,
          category: draft.category,
          assignee: getTaskAssignees(draft)[0] ?? draft.assignee,
          assignees: isSplitTask(draft) ? getTaskAssignees(draft) : undefined,
          due: draft.due,
          dueAt: draft.dueAt,
          xp: draft.xp,
          baseXp: draft.baseXp,
          xpEligible: draft.xpEligible,
          repeat: draft.repeat,
          weight: draft.weight,
          difficulty: draft.difficulty,
          tracking: draft.tracking,
          proofRequired: draft.proofRequired,
          definitionId: draft.definitionId ?? seriesDefinitionId(draft),
          occurrenceDate: draft.occurrenceDate,
        });
        nextTasks = [row, ...nextTasks];
      }
      // After creating past-day open rows, mark them missed if still pending.
      nextTasks = rolloverMissedOccurrences(nextTasks, dayKey, now);
    }

    const todayDrafts = ensureOccurrencesForDay(nextTasks, now);
    const created: HouseholdTask[] = [];
    for (const draft of todayDrafts) {
      const exists = nextTasks.some(
        (t) =>
          t.definitionId === draft.definitionId &&
          t.occurrenceDate === draft.occurrenceDate
      );
      if (exists || !household.id) continue;
      const row = await taskRepository.createTask(household.id, {
        title: draft.title,
        description: draft.description,
        category: draft.category,
        assignee: getTaskAssignees(draft)[0] ?? draft.assignee,
        assignees: isSplitTask(draft) ? getTaskAssignees(draft) : undefined,
        due: draft.due,
        dueAt: draft.dueAt,
        xp: draft.xp,
        baseXp: draft.baseXp,
        xpEligible: draft.xpEligible,
        repeat: draft.repeat,
        weight: draft.weight,
        difficulty: draft.difficulty,
        tracking: draft.tracking,
        proofRequired: draft.proofRequired,
        definitionId: draft.definitionId ?? seriesDefinitionId(draft),
        occurrenceDate: draft.occurrenceDate,
      });
      created.push(row);
    }

    const merged = [...created, ...nextTasks];
    // Persist auto-confirm / missed transitions for changed rows
    for (const task of merged) {
      const prev = household.tasks.find((t) => t.id === task.id);
      if (
        prev &&
        (prev.verification !== task.verification || prev.status !== task.status)
      ) {
        await taskRepository.updateTask(task);
      }
    }

    setHousehold((current) => ({ ...current, tasks: merged }));
  };

  useEffect(() => {
    if (!household.id || isLoading) return;
    void runOccurrenceCatchUp();
    // One catch-up per household session mount / id change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household.id, isLoading]);

  const completeTask = async (taskId: string, options?: { forAssignee?: string }) => {
    const currentTask = household.tasks.find((item) => item.id === taskId);

    if (!currentTask || currentTask.status === 'Completed' || currentTask.status === 'Cancelled') {
      return null;
    }

    const rewardSettings = normalizeRewardSettings({
      rewardMode: household.rewardMode,
      hygieneRewarded: household.hygieneRewarded,
      hygieneXp: household.hygieneXp,
    });
    const completedAt = new Date().toISOString();
    const localHour = new Date().getHours();
    const onDueDay = isTodayTask(currentTask) || /today/i.test(currentTask.due);

    const finishTrophyAndStreakHooks = async (
      assigneeName: string,
      awardedXp: number,
      nextHousehold: HouseholdSnapshot
    ) => {
      const member = nextHousehold.members.find((item) => item.name === assigneeName);
      if (!member || !nextHousehold.id) return;
      const unlocks = await recordCompletionForTrophies({
        householdId: nextHousehold.id,
        childId: member.id,
        event: {
          localHour,
          xpAwarded: awardedXp,
          isHygiene: currentTask.tracking === 'streak' || /hygiene/i.test(currentTask.category),
          onDueDay,
        },
      });
      for (const unlock of unlocks) {
        await pushNotification({
          title: 'Trophy unlocked',
          body: unlock.name,
          category: 'rewards',
          priority: 'medium',
          data: { kind: 'trophy_unlock', trophyId: unlock.id },
        });
      }
      if (dataMode === 'mock') {
        await persistMockHouseholdSnapshot(nextHousehold);
      }
    };

    // --- Split task: one person's share ---
    if (isSplitTask(currentTask) && currentTask.shares) {
      const forAssignee = options?.forAssignee?.trim() || currentMember?.name;
      if (!forAssignee || !taskMatchesAssignee(currentTask, forAssignee)) {
        return null;
      }
      const share = getShare(currentTask, forAssignee);
      if (!share || share.status !== 'Pending') {
        return null;
      }
      const needsProof =
        Boolean(currentTask.proofRequired) &&
        share.proofStatus !== 'submitted' &&
        share.proofStatus !== 'approved';

      const late = isTaskLate(currentTask);
      const baseShare = splitShareXp(currentTask, rewardSettings);
      // v2 §5.2: late never docks XP
      const latePenalty = 0;
      const awarded = Math.max(0, baseShare);

      const nextShares = currentTask.shares.map((item) =>
        item.name === forAssignee
          ? { ...item, status: 'Completed' as const, awardedXp: awarded }
          : item
      );
      const draft: HouseholdTask = { ...currentTask, shares: nextShares };
      const everyoneDone = allSharesCompleted(draft);
      const settled = allSharesSettled(draft);
      const bonus = everyoneDone ? splitAllDoneBonus(currentTask, rewardSettings) : 0;
      const totalAwarded = awarded + (everyoneDone ? bonus : 0);

      let nextTask: HouseholdTask = {
        ...draft,
        status: settled || everyoneDone ? 'Completed' : 'In Progress',
        completedAt: settled || everyoneDone ? completedAt : currentTask.completedAt,
        awardedXp: everyoneDone
          ? (currentTask.awardedXp ?? 0) + totalAwarded
          : currentTask.awardedXp,
      };

      // Apply all-finish bonus onto each completed share
      if (everyoneDone && bonus > 0) {
        nextTask = {
          ...nextTask,
          shares: nextTask.shares?.map((item) =>
            item.status === 'Completed'
              ? { ...item, awardedXp: (item.awardedXp ?? 0) + bonus }
              : item
          ),
        };
      }

      const saved = await taskRepository.updateTask(nextTask);
      if (household.id && totalAwarded > 0) {
        await taskRepository.awardMemberXp({
          householdId: household.id,
          memberName: forAssignee,
          amount: totalAwarded,
          reason: late
            ? `Split share (late): ${currentTask.title}`
            : `Split share: ${currentTask.title}`,
          taskId,
        });
      }
      if (everyoneDone && bonus > 0 && household.id) {
        for (const earlier of nextShares) {
          if (earlier.name === forAssignee || earlier.status !== 'Completed') continue;
          await taskRepository.awardMemberXp({
            householdId: household.id,
            memberName: earlier.name,
            amount: bonus,
            reason: `Split all-done bonus: ${currentTask.title}`,
            taskId,
          });
        }
      }

      let nextOccurrence: HouseholdTask | null = null;
      // v2 §5.2: completion never spawns the next occurrence.
      void nextOccurrence;

      let nextHouseholdSnapshot: HouseholdSnapshot | null = null;
      setHousehold((current) => {
        const tasks = current.tasks.map((item) => (item.id === taskId ? saved : item));
        const members = current.members.map((member) => {
          if (member.name === forAssignee) {
            return {
              ...member,
              xp: member.xp + totalAwarded,
              weekXp: (member.weekXp ?? 0) + totalAwarded,
              streak: member.streak ?? 0,
            };
          }
          // When the last person finishes, give bonus to earlier completers too
          if (everyoneDone && bonus > 0 && nextShares.some((s) => s.name === member.name && s.status === 'Completed' && s.name !== forAssignee)) {
            return {
              ...member,
              xp: member.xp + bonus,
              weekXp: (member.weekXp ?? 0) + bonus,
            };
          }
          return member;
        });
        nextHouseholdSnapshot = {
          ...current,
          members,
          tasks,
        };
        return nextHouseholdSnapshot;
      });

      const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
      await poppinsNotifications.taskCompleted(pushNotification, prefs, {
        title: currentTask.title,
        assignee: forAssignee,
        awardedXp: totalAwarded,
        penalty: latePenalty,
        late,
        taskId,
      });
      if (nextHouseholdSnapshot) {
        await finishTrophyAndStreakHooks(forAssignee, totalAwarded, nextHouseholdSnapshot);
      }
      await trackAnalytics(
        'task.share_completed',
        { taskId, forAssignee, awarded, bonus, everyoneDone, needsProof },
        analyticsContext
      );
      return {
        awarded,
        penalty: latePenalty,
        late,
        bonus: everyoneDone ? bonus : 0,
        needsProof,
      };
    }

    // --- Single-assignee task ---
    // Proof is requested after complete when the create/preset flag is set — never a pre-gate.
    const needsProof =
      Boolean(currentTask.proofRequired) &&
      currentTask.proofStatus !== 'submitted' &&
      currentTask.proofStatus !== 'approved';

    const { awarded, penalty, late } = resolveCompletionXp(currentTask, rewardSettings);
    const lateMeta = completedLateFlag(completedAt, currentTask.dueAt);
    const verification = initialVerification(Boolean(currentTask.proofRequired));
    const completedWithXp: HouseholdTask = {
      ...currentTask,
      status: 'Completed',
      awardedXp: awarded,
      completedAt,
      verification,
      proofRounds: currentTask.proofRounds ?? [],
      proofPhotoUrls: currentTask.proofUri
        ? [currentTask.proofUri, ...(currentTask.proofPhotoUrls ?? [])]
        : currentTask.proofPhotoUrls ?? [],
      completedLate: lateMeta.completedLate || late,
      latenessMinutes: lateMeta.latenessMinutes,
      // Keep legacy proofStatus in sync for older UI until fully migrated.
      proofStatus: currentTask.proofRequired
        ? currentTask.proofStatus === 'submitted' || currentTask.proofStatus === 'approved'
          ? currentTask.proofStatus
          : 'none'
        : 'none',
    };
    const completedTask = await taskRepository.completeTask(completedWithXp, household.id);
    // v2 §5.2: completion never spawns the next occurrence (time-based only).

    let nextHouseholdSnapshot: HouseholdSnapshot | null = null;
    setHousehold((current) => {
      const task = current.tasks.find((item) => item.id === taskId);

      if (!task || task.status === 'Completed') {
        return current;
      }

      const tasks = current.tasks.map((item) => (item.id === taskId ? completedTask : item));
      nextHouseholdSnapshot = {
        ...current,
        members: current.members.map((member) =>
          member.name === task.assignee
            ? {
                ...member,
                xp: member.xp + awarded,
                weekXp: (member.weekXp ?? 0) + awarded,
                streak: member.streak ?? 0,
              }
            : member
        ),
        tasks,
      };
      return nextHouseholdSnapshot;
    });

    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    await poppinsNotifications.taskCompleted(pushNotification, prefs, {
      title: currentTask.title,
      assignee: currentTask.assignee,
      awardedXp: awarded,
      penalty,
      late,
      taskId,
    });
    if (nextHouseholdSnapshot) {
      await finishTrophyAndStreakHooks(currentTask.assignee, awarded, nextHouseholdSnapshot);
    }
    const nextMetrics = calculateMetrics({
      ...household,
      tasks: household.tasks.map((item) => (item.id === taskId ? completedTask : item)),
    });
    await persistHouseholdScore(household.id, nextMetrics);
    await trackAnalytics(
      'task.completed',
      { taskId, awarded, late, needsProof },
      analyticsContext
    );
    return { awarded, penalty, late, needsProof };
  };

  const penalizeSplitAssignee = async (taskId: string, assigneeName: string) => {
    if (!permissions.canManageHousehold) {
      return null;
    }
    const currentTask = household.tasks.find((item) => item.id === taskId);
    if (!currentTask || !isSplitTask(currentTask) || !currentTask.shares) {
      return null;
    }
    const share = getShare(currentTask, assigneeName);
    if (!share || share.status !== 'Pending') {
      return null;
    }

    const dock = splitPenaltyAmount(
      currentTask,
      normalizeRewardSettings({
        rewardMode: household.rewardMode,
        hygieneRewarded: household.hygieneRewarded,
        hygieneXp: household.hygieneXp,
      })
    );
    const nextShares = currentTask.shares.map((item) =>
      item.name === assigneeName
        ? { ...item, status: 'Penalized' as const, penalizedXp: dock }
        : item
    );
    const draft: HouseholdTask = { ...currentTask, shares: nextShares };
    const settled = allSharesSettled(draft);
    const saved = await taskRepository.updateTask({
      ...draft,
      status: settled ? 'Completed' : currentTask.status === 'Pending' ? 'In Progress' : currentTask.status,
    });

    setHousehold((current) => ({
      ...current,
      members: current.members.map((member) =>
        member.name === assigneeName
          ? {
              ...member,
              xp: Math.max(0, member.xp - dock),
              weekXp: Math.max(0, (member.weekXp ?? 0) - dock),
            }
          : member
      ),
      tasks: current.tasks.map((item) => (item.id === taskId ? saved : item)),
    }));

    await pushNotification({
      title: 'Split task · penalty',
      body: `${assigneeName} was docked ${dock} XP for not finishing “${currentTask.title}”.`,
      category: 'tasks',
      priority: 'medium',
      data: { kind: 'split_penalty', taskId, assigneeName, dock },
    });
    await trackAnalytics('task.share_penalized', { taskId, assigneeName, dock }, analyticsContext);
    return dock;
  };

  const reassignTask = async (taskId: string, newAssigneeName: string) => {
    const currentTask = household.tasks.find((item) => item.id === taskId);
    if (!currentTask || currentTask.status === 'Completed' || currentTask.status === 'Cancelled') {
      return;
    }
    const trimmed = newAssigneeName.trim();
    if (!trimmed) return;

    const nextTask: HouseholdTask = {
      ...currentTask,
      assignee: trimmed,
      assignees: [trimmed],
      shares: undefined,
      splitXpEach: undefined,
      splitBonusXp: undefined,
      splitPenaltyXp: undefined,
    };
    const saved = await taskRepository.updateTask(nextTask);
    setHousehold((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === taskId ? saved : item)),
    }));
    await pushNotification({
      title: 'Task reassigned',
      body: `“${currentTask.title}” is now assigned to ${trimmed}. They earn the XP when finished.`,
      category: 'tasks',
      priority: 'medium',
      data: { kind: 'task_reassigned', taskId, assignee: trimmed },
    });
    await trackAnalytics('task.reassigned', { taskId, assignee: trimmed }, analyticsContext);
  };

  const awardDailyStreak = async () => {
    if (!currentMember || !household.id) return null;
    // Gate on the same today filter as Home counters.
    const mineToday = household.tasks.filter(
      (task) =>
        isTodayTask(task, new Date(), household.timezone) &&
        taskMatchesAssignee(task, currentMember.name)
    );
    if (mineToday.length === 0 || mineToday.some((task) => task.status !== 'Completed')) {
      return null;
    }
    const { awardDailyStreakIfNeeded } = await import('@/lib/streaks/daily-streak');
    const result = await awardDailyStreakIfNeeded({
      householdId: household.id,
      memberId: currentMember.id,
      currentStreak: currentMember.streak ?? 0,
      timeZone: household.timezone,
    });
    if (!result.awarded) return null;
    setHousehold((current) => {
      const next = {
        ...current,
        members: current.members.map((member) =>
          member.id === currentMember.id ? { ...member, streak: result.streak } : member
        ),
      };
      if (dataMode === 'mock') {
        void persistMockHouseholdSnapshot(next);
      }
      return next;
    });
    await taskRepository.updateMemberStreak({
      householdId: household.id,
      memberId: currentMember.id,
      streak: result.streak,
    });
    const { ensureMemberStreak, setMemberStreak } = await import('@/lib/streaks/mock-streak-store');
    const engine = ensureMemberStreak(currentMember.id);
    setMemberStreak({
      ...engine,
      current: result.streak,
      longest: Math.max(engine.longest, result.streak),
    });
    await trackAnalytics('streak.daily_awarded', { streak: result.streak }, analyticsContext);
    return result.streak;
  };

  /**
   * Streak Rescue — requires the member to press the confirmation prompt
   * (confirmedViaPrompt). Free first rescue still needs that tap.
   */
  const redeemStreak = async () => {
    if (!currentMember || !household.id) return false;
    const { acceptMemberRescue } = await import('@/lib/streaks/mock-streak-store');
    const { streak: restored, accrual } = acceptMemberRescue(currentMember.id, true);
    if (!accrual) return false;
    setHousehold((current) => {
      const next = {
        ...current,
        members: current.members.map((member) =>
          member.id === currentMember.id ? { ...member, streak: restored.current } : member
        ),
      };
      if (dataMode === 'mock') {
        void persistMockHouseholdSnapshot(next);
      }
      return next;
    });
    await taskRepository.updateMemberStreak({
      householdId: household.id,
      memberId: currentMember.id,
      streak: restored.current,
    });
    await trackAnalytics(
      'streak.redeemed',
      { memberId: currentMember.id, streak: restored.current },
      analyticsContext
    );
    return true;
  };

  const deleteTask = async (taskId: string) => {
    await taskRepository.deleteTask(taskId);
    setHousehold((current) => ({
      ...current,
      tasks: current.tasks.filter((item) => item.id !== taskId),
    }));
    await trackAnalytics('task.deleted', { taskId }, analyticsContext);
  };

  const cancelTask = async (taskId: string, scope: CancelTaskScope = 'this') => {
    if (!permissions.canManageHousehold) {
      return;
    }
    const currentTask = household.tasks.find((item) => item.id === taskId);
    if (!currentTask || currentTask.status === 'Completed' || currentTask.status === 'Cancelled') {
      return;
    }

    const cancelled = await taskRepository.updateTask({
      ...currentTask,
      status: 'Cancelled',
      // Stopping the series: clear repeat so nothing new spawns from this row.
      repeat: scope === 'future' ? 'None' : currentTask.repeat,
      due:
        scope === 'future' && currentTask.repeat !== 'None'
          ? 'Cancelled · series stopped'
          : 'Cancelled',
    });

    let nextTasks = household.tasks.map((item) => (item.id === taskId ? cancelled : item));

    if (scope === 'future' && currentTask.repeat !== 'None') {
      const siblings = nextTasks.filter(
        (item) =>
          item.id !== taskId &&
          isSameTaskSeries(item, currentTask) &&
          isOpenTask(item)
      );
      for (const sibling of siblings) {
        const updated = await taskRepository.updateTask({
          ...sibling,
          status: 'Cancelled',
          repeat: 'None',
          due: 'Cancelled · series stopped',
        });
        nextTasks = nextTasks.map((item) => (item.id === sibling.id ? updated : item));
      }
    }

    // v2 §5.2: cancel never spawns the next occurrence — time-based catch-up does.

    setHousehold((current) => ({ ...current, tasks: nextTasks }));
    await pushNotification({
      title: 'Poppins · Task cancelled',
      body:
        scope === 'future' && currentTask.repeat !== 'None'
          ? `${currentTask.title} cancelled for this and all future occurrences.`
          : `${currentTask.title} cancelled${currentTask.status === 'Overdue' ? ' (was overdue)' : ''}.`,
      category: 'tasks',
      priority: 'medium',
      data: { taskId, kind: 'task_cancelled', scope },
    });
    await trackAnalytics('task.cancelled', { taskId, scope }, analyticsContext);
  };

  const addMissingGrocery = async (input: CreateGroceryInput) => {
    const caps = resolveMemberCapabilities(household);
    const canAdd =
      permissions.canManageGroceries ||
      caps.allowGroceryAdd ||
      (currentMember?.role === 'child' && (currentMember?.xp ?? 0) >= CHILD_GROCERY_WISHLIST_XP);
    if (!canAdd) {
      return;
    }
    const grocery = await groceryRepository.addGroceryItem(household.id, {
      ...input,
      storeId: input.storeId ?? household.preferredStoreId,
      requestedBy: input.requestedBy ?? currentMember?.name,
    });
    setHousehold((current) => ({
      ...current,
      groceries: [grocery, ...current.groceries],
    }));
    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    await poppinsNotifications.groceryAdded(pushNotification, prefs, {
      name: grocery.name,
      onSale: grocery.salePrice != null && (grocery.typicalPrice ?? 0) > grocery.salePrice,
      groceryId: grocery.id,
    });
    await trackAnalytics('grocery.added', { groceryId: grocery.id }, analyticsContext);
  };

  const setPreferredStore = (storeId: string) => {
    if (!permissions.canManageGroceries && currentMember?.role === 'child') {
      return;
    }
    setHousehold((current) => ({ ...current, preferredStoreId: storeId }));
  };

  const markGroceryPurchased = async (itemId: string) => {
    const currentItem = household.groceries.find((item) => item.id === itemId);

    if (!currentItem) {
      return;
    }

    const purchasedItem = await groceryRepository.markGroceryPurchased(currentItem, household.id);

    setHousehold((current) => ({
      ...current,
      groceries: current.groceries.map((item) => (item.id === itemId ? purchasedItem : item)),
    }));
    await trackAnalytics('grocery.purchased', { groceryId: itemId }, analyticsContext);
    const nextMetrics = calculateMetrics({
      ...household,
      groceries: household.groceries.map((item) =>
        item.id === itemId ? { ...item, status: 'Purchased' as const } : item
      ),
    });
    await persistHouseholdScore(household.id, nextMetrics);
  };

  const markGroceryMissing = async (itemId: string) => {
    const currentItem = household.groceries.find((item) => item.id === itemId);
    if (!currentItem) {
      return;
    }

    const updated = await groceryRepository.markGroceryMissing(currentItem, household.id);
    setHousehold((current) => ({
      ...current,
      groceries: current.groceries.map((item) => (item.id === itemId ? updated : item)),
    }));
    await trackAnalytics('grocery.missing', { groceryId: itemId }, analyticsContext);
  };

  const markGroceryLow = async (itemId: string) => {
    const currentItem = household.groceries.find((item) => item.id === itemId);
    if (!currentItem) {
      return;
    }

    const updated = await groceryRepository.markGroceryLow(currentItem, household.id);
    setHousehold((current) => ({
      ...current,
      groceries: current.groceries.map((item) => (item.id === itemId ? updated : item)),
    }));
    await trackAnalytics('grocery.low', { groceryId: itemId }, analyticsContext);
  };

  const pushNotification = async (input: {
    title: string;
    body: string;
    category: NotificationItem['category'];
    priority?: NotificationItem['priority'];
    data?: Record<string, unknown>;
    userId?: string | null;
  }) => {
    if (!household.id) {
      return null;
    }

    const audienceRoles = input.data?.audienceRoles;
    const isAdminAudience =
      Array.isArray(audienceRoles) &&
      audienceRoles.some((role) => role === 'owner' || role === 'admin' || role === 'adult');

    // Admin-targeted notes stay household-scoped (null user) so they are not
    // attributed to the child/submitter in Supabase mode.
    const targetUserId = input.userId !== undefined ? input.userId : isAdminAudience ? null : currentUser?.id;

    const item = await notificationsRepository.create({
      householdId: household.id,
      title: input.title,
      body: input.body,
      category: input.category,
      priority: input.priority,
      data: input.data,
      userId: targetUserId,
    });
    setNotifications((current) => [item, ...current.filter((existing) => existing.id !== item.id)]);
    return item;
  };

  const createEvent = async (input: CreateEventInput) => {
    const caps = resolveMemberCapabilities(household);
    if (!permissions.canManageHousehold && !caps.allowCalendarCreate) {
      return;
    }
    const event = await calendarRepository.createEvent(household.id, input);
    setHousehold((current) => ({
      ...current,
      events: [event, ...current.events.filter((item) => item.id !== event.id)],
    }));
    await pushNotification({
      title: event.title,
      body: `${event.date} at ${event.time}${event.location ? ` · ${event.location}` : ''}. ${event.responsible} is responsible.`,
      category: 'events',
      priority: 'medium',
      data: { eventId: event.id },
    });
    if (input.remindMe) {
      await scheduleLocalReminder(
        event.title,
        `${event.time} · ${event.responsible}`,
        20
      ).catch((error) => console.warn('Local reminder skipped', error));
    }
    await trackAnalytics('event.created', { eventId: event.id }, analyticsContext);
  };

  const updateEvent = async (event: HouseholdEvent) => {
    const updated = await calendarRepository.updateEvent(event);
    setHousehold((current) => ({
      ...current,
      events: current.events.map((item) => (item.id === updated.id ? updated : item)),
    }));
    await trackAnalytics('event.updated', { eventId: updated.id }, analyticsContext);
  };

  const deleteEvent = async (eventId: string) => {
    await calendarRepository.deleteEvent(eventId);
    setHousehold((current) => ({
      ...current,
      events: current.events.filter((item) => item.id !== eventId),
    }));
    await trackAnalytics('event.deleted', { eventId }, analyticsContext);
  };

  const remindAboutEvent = async (eventId: string) => {
    const event = household.events.find((item) => item.id === eventId);
    if (!event) {
      return;
    }

    await pushNotification({
      title: `Reminder: ${event.title}`,
      body: `${event.date} at ${event.time}. Assigned to ${event.responsible}.`,
      category: 'events',
      priority: 'high',
      data: { eventId: event.id },
    });
    await scheduleLocalReminder(event.title, `${event.time} · ${event.responsible}`, 15).catch((error) =>
      console.warn('Local reminder skipped', error)
    );
    await trackAnalytics('event.reminded', { eventId }, analyticsContext);
  };

  const createItinerary = async (input: CreateItineraryInput) => {
    if (!household.id) {
      return null;
    }
    const itinerary = await itineraryRepository.create(household.id, input);
    setHousehold((current) => ({
      ...current,
      itineraries: [itinerary, ...(current.itineraries ?? [])],
    }));
    await trackAnalytics('itinerary.created', { itineraryId: itinerary.id }, analyticsContext);
    return itinerary;
  };

  const suggestPoppinsItinerary = async (options?: {
    date?: string;
    mode?: 'efficient' | 'spread';
    eventIds?: string[];
  }) => {
    const suggestion = suggestItineraryFromHousehold(household, options);
    return createItinerary(suggestion);
  };

  const advanceItineraryStop = async (itineraryId: string, stopId: string) => {
    const before = household.itineraries?.find((item) => item.id === itineraryId);
    const stop = before?.stops.find((item) => item.id === stopId);
    const updated = await itineraryRepository.advanceStop(itineraryId, stopId);
    if (!updated) {
      return;
    }
    setHousehold((current) => ({
      ...current,
      itineraries: (current.itineraries ?? []).map((item) => (item.id === itineraryId ? updated : item)),
    }));

    const ordered = [...updated.stops].sort((a, b) => a.sortOrder - b.sortOrder);
    const nextActive = ordered.find((item) => item.status === 'active');
    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    await poppinsNotifications.itineraryNextLeg(pushNotification, prefs, {
      itinerary: updated,
      stopLabel: stop?.label ?? 'Stop',
      nextLabel: nextActive?.label,
    });

    if (nextActive) {
      const previous = ordered.find((item) => item.id === stopId);
      await openDirections(
        previous
          ? {
              address: previous.address,
              placeQuery: previous.placeQuery,
              lat: previous.lat,
              lng: previous.lng,
            }
          : undefined,
        {
          address: nextActive.address,
          placeQuery: nextActive.placeQuery,
          lat: nextActive.lat,
          lng: nextActive.lng,
        },
        preferredMapsApp
      );
    }
    await trackAnalytics('itinerary.stop_advanced', { itineraryId, stopId }, analyticsContext);
  };

  const openStopInMaps = async (itineraryId: string, stopId: string) => {
    const itinerary = household.itineraries?.find((item) => item.id === itineraryId);
    if (!itinerary) {
      return;
    }
    const ordered = [...itinerary.stops].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = ordered.findIndex((item) => item.id === stopId);
    const to = ordered[index];
    if (!to) {
      return;
    }
    const from = index > 0 ? ordered[index - 1] : undefined;
    await openDirections(
      from
        ? { address: from.address, placeQuery: from.placeQuery, lat: from.lat, lng: from.lng }
        : undefined,
      { address: to.address, placeQuery: to.placeQuery, lat: to.lat, lng: to.lng },
      preferredMapsApp
    );
  };

  const reorderItineraryStops = async (itineraryId: string, stopIds: string[]) => {
    const updated = await itineraryRepository.reorderStops(itineraryId, stopIds);
    if (!updated) {
      return;
    }
    setHousehold((current) => ({
      ...current,
      itineraries: (current.itineraries ?? []).map((item) => (item.id === itineraryId ? updated : item)),
    }));
  };

  const updateNotificationPrefs = (prefs: Partial<PoppinsNotificationPrefs>) => {
    setHousehold((current) => {
      const next = {
        ...(current.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS),
        ...prefs,
      };
      void savePoppinsNotificationPrefs(current.id, next);
      return {
        ...current,
        notificationPrefs: next,
      };
    });
  };

  const updateMemberCapabilities = (prefs: Partial<MemberCapabilities>) => {
    if (!permissions.canManageHousehold) {
      return;
    }
    setHousehold((current) => {
      const memberCapabilities = {
        ...resolveMemberCapabilities(current),
        ...prefs,
      };
      void saveMemberCapabilitiesPrefs(current.id, memberCapabilities);
      const next: HouseholdSnapshot = { ...current, memberCapabilities };
      if (dataMode === 'mock') {
        void persistMockHouseholdSnapshot(next);
      }
      const householdId = current.id;
      if (dataMode === 'supabase' && householdId) {
        void import('@/repositories/repository-utils').then(async ({ getConfiguredSupabase, mapDbError }) => {
          try {
            const supabase = getConfiguredSupabase('updateMemberCapabilities');
            const { error } = await supabase
              .from('households')
              .update({ member_capabilities: memberCapabilities })
              .eq('id', householdId);
            mapDbError('updateMemberCapabilities', error);
          } catch (error) {
            console.warn('updateMemberCapabilities supabase skipped', error);
          }
        });
      }
      return next;
    });
  };

  const canEditHouseholdRewardLogic = (snapshot: HouseholdSnapshot) => {
    const actor =
      (activeMemberId
        ? snapshot.members.find((member) => member.id === activeMemberId)
        : undefined) ??
      snapshot.members.find((member) => member.name === currentUser?.name) ??
      snapshot.members[0];
    const role = actor?.status === 'pending' ? 'guest' : (actor?.role ?? 'guest');
    return role === 'owner' || role === 'admin';
  };

  const updateHouseholdRewardSettings = (prefs: {
    rewardMode?: 'weighted' | 'flat';
    hygieneRewarded?: boolean;
    hygieneXp?: 5 | 10;
  }) => {
    // Permission checked against the latest household snapshot (not a stale
    // guest role from the pre-createHousehold render during onboarding).
    setHousehold((current) => {
      if (!canEditHouseholdRewardLogic(current)) {
        return current;
      }
      const next: HouseholdSnapshot = {
        ...current,
        rewardMode: prefs.rewardMode ?? current.rewardMode,
        hygieneRewarded: prefs.hygieneRewarded ?? current.hygieneRewarded,
        hygieneXp:
          prefs.hygieneXp != null
            ? prefs.hygieneXp === 10
              ? 10
              : 5
            : current.hygieneXp,
      };
      void saveRewardSettings(current.id, {
        rewardMode: next.rewardMode ?? 'weighted',
        hygieneRewarded: next.hygieneRewarded ?? false,
        hygieneXp: next.hygieneXp === 10 ? 10 : 5,
      });
      if (dataMode === 'mock') {
        void persistMockHouseholdSnapshot(next);
      }
      const householdId = current.id;
      if (dataMode === 'supabase' && householdId) {
        void import('@/repositories/repository-utils').then(async ({ getConfiguredSupabase, mapDbError }) => {
          try {
            const supabase = getConfiguredSupabase('updateHouseholdRewardSettings');
            const { error } = await supabase
              .from('households')
              .update({
                reward_mode: next.rewardMode ?? 'weighted',
                hygiene_rewarded: next.hygieneRewarded ?? false,
                hygiene_xp: next.hygieneXp === 10 ? 10 : 5,
              })
              .eq('id', householdId);
            mapDbError('updateHouseholdRewardSettings', error);
          } catch (error) {
            console.warn('updateHouseholdRewardSettings supabase skipped', error);
          }
        });
      }
      return next;
    });
  };

  const updateHouseholdRewardModel = (model: RewardModel) => {
    setHousehold((current) => {
      if (!canEditHouseholdRewardLogic(current)) {
        return current;
      }
      const next: HouseholdSnapshot = {
        ...current,
        rewardModel: model,
      };
      if (dataMode === 'mock') {
        void persistMockHouseholdSnapshot(next);
      }
      const householdId = current.id;
      if (dataMode === 'supabase' && householdId) {
        void import('@/repositories/repository-utils').then(async ({ getConfiguredSupabase, mapDbError }) => {
          try {
            const supabase = getConfiguredSupabase('updateHouseholdRewardModel');
            const { error } = await supabase
              .from('households')
              .update({ reward_model: model })
              .eq('id', householdId);
            mapDbError('updateHouseholdRewardModel', error);
          } catch (error) {
            console.warn('updateHouseholdRewardModel supabase skipped', error);
          }
        });
      }
      return next;
    });
  };

  const resolvedPaletteId = useMemo<ColorPaletteId>(() => {
    if (currentMember?.accentThemeId) {
      return migrateColorPaletteId(currentMember.accentThemeId);
    }
    if (household.accentThemeId) {
      return migrateColorPaletteId(household.accentThemeId);
    }
    return migrateColorPaletteId(paletteId ?? DEFAULT_COLOR_PALETTE_ID);
  }, [currentMember?.accentThemeId, household.accentThemeId, paletteId]);

  const accentTheme = useMemo(
    () => getAccentTheme(resolvedPaletteId),
    [resolvedPaletteId]
  );

  const updateAccentTheme = (themeId: AccentThemeId) => {
    const memberId = currentMember?.id;
    setPaletteId(themeId);
    if (!memberId) {
      setHousehold((current) => ({ ...current, accentThemeId: themeId }));
      void saveAccentThemeId(household.id, themeId);
      void savePaletteId(household.id, null, themeId);
      void import('@/lib/brand/sync-app-icon').then(({ syncHomeScreenIcon }) =>
        syncHomeScreenIcon(themeId)
      );
      return;
    }
    setHousehold((current) => ({
      ...current,
      members: current.members.map((member) =>
        member.id === memberId ? { ...member, accentThemeId: themeId } : member
      ),
    }));
    void saveMemberAccentThemeId(household.id, memberId, themeId);
    void savePaletteId(household.id, memberId, themeId);
    void import('@/lib/brand/sync-app-icon').then(({ syncHomeScreenIcon }) =>
      syncHomeScreenIcon(themeId)
    );
  };

  const updatePalette = (next: ColorPaletteId) => {
    updateAccentTheme(next);
  };

  // Keep home-screen icon aligned after hydrate / persona switch (native builds only).
  useEffect(() => {
    void import('@/lib/brand/sync-app-icon').then(({ syncHomeScreenIcon }) =>
      syncHomeScreenIcon(resolvedPaletteId)
    );
  }, [resolvedPaletteId]);

  const updateHouseholdAccentTheme = (themeId: AccentThemeId) => {
    if (!permissions.canManageHousehold) {
      return;
    }
    setHousehold((current) => ({ ...current, accentThemeId: themeId }));
    void saveAccentThemeId(household.id, themeId);
    void savePaletteId(household.id, null, themeId);
  };

  const updateAppearanceMode = (mode: AppearanceMode) => {
    setAppearanceMode(mode);
    void saveAppearanceMode(mode);
  };

  const updateBackgroundTheme = (themeId: BackgroundThemeId) => {
    // Legacy: map light packs → light mode, dark packs → dark mode.
    setBackgroundThemeId(themeId);
    void saveBackgroundThemeId(household.id, currentMember?.id, themeId);
    if (themeId === 'paper' || themeId === 'mist') {
      setAppearanceMode('light');
      void saveAppearanceMode('light');
    } else {
      setAppearanceMode('dark');
      void saveAppearanceMode('dark');
    }
  };

  const updatePreferredMapsApp = (app: PreferredMapsApp) => {
    setPreferredMapsApp(app);
    void savePreferredMapsApp(app);
  };

  const orbitPalette = useMemo(
    () => resolveTheme(appearanceMode, resolvedPaletteId),
    [appearanceMode, resolvedPaletteId]
  );

  const upsertSavedPlace = (place: SavedPlace) => {
    setHousehold((current) => {
      const places = current.savedPlaces ?? [];
      const exists = places.some((item) => item.id === place.id);
      return {
        ...current,
        savedPlaces: exists
          ? places.map((item) => (item.id === place.id ? place : item))
          : [...places, place],
      };
    });
  };

  const removeSavedPlace = (placeId: string) => {
    setHousehold((current) => ({
      ...current,
      savedPlaces: (current.savedPlaces ?? []).filter((item) => item.id !== placeId),
    }));
  };

  const toggleItineraryFavorite = async (itineraryId: string) => {
    const itinerary = household.itineraries.find((item) => item.id === itineraryId);
    if (!itinerary) return;
    const next = { ...itinerary, favorite: !itinerary.favorite };
    await itineraryRepository.update(next);
    setHousehold((current) => {
      const itineraries = current.itineraries.map((item) =>
        item.id === itineraryId ? next : item
      );
      const favoriteIds = itineraries.filter((item) => item.favorite).map((item) => item.id);
      void import('@/lib/itinerary/favorites-store').then(({ saveFavoriteItineraryIds }) =>
        saveFavoriteItineraryIds(current.id, favoriteIds)
      );
      return { ...current, itineraries };
    });
  };

  const rerunItinerary = async (itineraryId: string) => {
    const source = household.itineraries.find((item) => item.id === itineraryId);
    if (!source || !household.id) return null;
    const input: CreateItineraryInput = {
      title: source.title,
      date: new Date().toISOString().slice(0, 10),
      stops: source.stops.map((stop, index) => ({
        label: stop.label,
        kind: stop.kind,
        address: stop.address,
        placeQuery: stop.placeQuery,
        lat: stop.lat,
        lng: stop.lng,
        eventId: stop.eventId,
        groceryListId: stop.groceryListId,
        etaMinutes: stop.etaMinutes,
        sortOrder: index,
        savedPlaceId: stop.savedPlaceId,
      })),
    };
    const created = await itineraryRepository.create(household.id, input);
    setHousehold((current) => ({
      ...current,
      itineraries: [created, ...current.itineraries],
    }));
    return created;
  };

  const openFullItineraryInMaps = async (itineraryId: string) => {
    const itinerary = household.itineraries.find((item) => item.id === itineraryId);
    if (!itinerary) return;
    const stops = itinerary.stops
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((stop) => ({
        address: stop.address,
        placeQuery: stop.placeQuery,
        lat: stop.lat,
        lng: stop.lng,
      }));
    const result = await openMultiStopRoute(stops, preferredMapsApp);
    if (result.sequentialOnly && result.app === 'waze') {
      await pushNotification({
        title: 'Waze · one stop at a time',
        body: 'Waze opened the first stop. Use Arrived → next in Choremaxx for the rest.',
        category: 'events',
        priority: 'low',
        data: { kind: 'waze_sequential', itineraryId },
      });
    }
  };

  const updateMemberAvatar = async (memberId: string, avatar: string) => {
    const member = household.members.find((item) => item.id === memberId);
    if (!member) {
      return;
    }
    const updated = await householdRepository.updateMemberAvatar(member, avatar);
    setHousehold((current) => ({
      ...current,
      members: current.members.map((item) => (item.id === memberId ? updated : item)),
    }));
    void saveMemberAvatarOverride(household.id, memberId, avatar);
    if (currentUser?.name === member.name) {
      setCurrentUser((prev) => (prev ? { ...prev, avatar } : prev));
    }
  };

  const upsertRoom = (room: HouseholdRoom) => {
    setHousehold((current) => {
      const rooms = current.rooms ?? [];
      const exists = rooms.some((item) => item.id === room.id);
      const nextRooms = exists
        ? rooms.map((item) => (item.id === room.id ? room : item))
        : [...rooms, room];
      void saveHouseholdRooms(current.id, nextRooms);
      return {
        ...current,
        rooms: nextRooms,
      };
    });
  };

  const removeRoom = (roomId: string) => {
    setHousehold((current) => {
      const nextRooms = (current.rooms ?? []).filter((item) => item.id !== roomId);
      void saveHouseholdRooms(current.id, nextRooms);
      return {
        ...current,
        rooms: nextRooms,
      };
    });
  };

  const runPoppinsMonitor = useCallback(async () => {
    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    const result = runMonitorPass(household, metrics, prefs);

    setPoppinsMonitorActions(result.actions);
    setPoppinsRecommendations((current) => {
      const ids = new Set(result.recommendations.map((item) => item.id));
      return [...result.recommendations, ...current.filter((item) => !ids.has(item.id))];
    });

    const existing = await notificationsRepository.list(household.id);
    for (const note of result.notifications) {
      const kind = String(note.data?.kind ?? '');
      const already = existing.some(
        (item) =>
          item.category === 'ai' &&
          !item.isRead &&
          String(item.data?.kind ?? '') === kind &&
          (kind !== 'task_overdue' || item.data?.taskId === note.data?.taskId)
      );
      if (already) continue;
      const created = await pushNotification(note);
      if (created) {
        existing.unshift(created);
      }
    }

    await trackAnalytics('poppins.monitor_pass', { actions: result.actions.length }, analyticsContext);
    return result.actions;
  }, [analyticsContext, household, metrics]);

  // Initial Monitor Agent pass once household + metrics are ready (mock-first).
  useEffect(() => {
    if (isLoading || !household.id || poppinsMonitorActions.length > 0) {
      return;
    }
    const timer = setTimeout(() => {
      void runPoppinsMonitor().catch((error) => console.warn('Poppins monitor pass skipped', error));
    }, 800);
    return () => clearTimeout(timer);
  }, [household.id, isLoading, poppinsMonitorActions.length, runPoppinsMonitor]);

  const askPoppins = async (question: string) => {
    setPoppinsAskCount((count) => count + 1);
    const answer = await poppinsRepository.askPoppins(
      question,
      household,
      metrics,
      poppinsConversation,
      currentUser?.id
    );
    setPoppinsConversation((current) => [
      ...current,
      { role: 'user', content: answer.question },
      { role: 'assistant', content: answer.answer },
    ]);
    await trackAnalytics('poppins.asked', { questionLength: question.length }, analyticsContext);
    return answer;
  };

  const askPoppinsVoice = async (audioUri: string | null) => {
    const { transcribeAndAskPoppins } = await import('@/lib/voice/poppins-voice');
    setPoppinsAskCount((count) => count + 1);
    const answer = await transcribeAndAskPoppins(audioUri, household, metrics);
    setPoppinsConversation((current) => [
      ...current,
      { role: 'user', content: answer.question },
      { role: 'assistant', content: answer.answer },
    ]);
    await poppinsRepository.appendConversationTurn(
      household.id,
      currentUser?.id ?? null,
      answer.question,
      answer.answer
    );
    await trackAnalytics('poppins.voice_asked', {}, analyticsContext);
    return answer;
  };

  const appendPoppinsTurn = (question: string, answer: string) => {
    setPoppinsAskCount((count) => count + 1);
    setPoppinsConversation((current) => [
      ...current,
      { role: 'user', content: question },
      { role: 'assistant', content: answer },
    ]);
    void poppinsRepository.appendConversationTurn(
      household.id,
      currentUser?.id ?? null,
      question,
      answer
    );
  };

  const switchPersona = (memberId: string) => {
    const member = household.members.find((m) => m.id === memberId);
    if (!member) return;

    // Shared tablet is a device shell — land on a linked account (Josh/Todd) so XP/redeem work.
    let target = member;
    if (member.role === 'shared-device') {
      const linked = (member.sharedWithMemberIds ?? [])
        .map((id) => household.members.find((item) => item.id === id))
        .filter((item): item is HouseholdMember => Boolean(item && item.status === 'active'));
      if (linked[0]) {
        target = linked[0];
      }
    }

    setActiveMemberId(target.id);
    const nextUser = {
      id: currentUser?.id?.startsWith('persona-') || currentUser?.id?.startsWith('child-local-') || currentUser?.id?.startsWith('tablet-local-')
        ? `persona-${target.id}`
        : currentUser?.id ?? `persona-${target.id}`,
      email:
        currentUser?.email && !currentUser.email.includes('@kids.choremaxx.local')
          ? currentUser.email
          : `${target.name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'member'}@orbit.test`,
      name: target.name,
      avatar: target.avatar,
      profileComplete: true,
    };
    setCurrentUser((prev) =>
      prev
        ? {
            ...prev,
            name: target.name,
            avatar: target.avatar,
            profileComplete: true,
          }
        : nextUser
    );
    setHousehold((current) => ({ ...current, greetingName: target.name }));
    void authRepository.persistLocalSession(
      currentUser
        ? { ...currentUser, name: target.name, avatar: target.avatar, profileComplete: true }
        : nextUser,
      target.id,
    );
    void saveActiveMemberId(target.id);
    void import('@/lib/device/device-session').then(({ loadDeviceSession, selectDeviceProfile }) =>
      loadDeviceSession().then((session) => {
        if (session.mode === 'shared') {
          void selectDeviceProfile(target.id);
        }
      })
    );
  };

  const approveMember = async (memberId: string) => {
    const member = household.members.find((item) => item.id === memberId);
    await householdRepository.approveMember(memberId);
    if (dataMode === 'supabase') {
      await reloadHouseholdDomains();
    } else {
      setHousehold((current) => ({
        ...current,
        members: current.members.map((item) =>
          item.id === memberId ? { ...item, status: 'active' } : item
        ),
      }));
      setActiveMemberId(null);
    }
    await pushNotification({
      title: 'Welcome to the household',
      body: `${member?.name ?? 'A member'} was approved and now has full access.`,
      category: 'members',
      priority: 'medium',
      data: { memberId },
    });
    await trackAnalytics('member.approved', { memberId }, analyticsContext);
  };

  const declineMember = async (memberId: string) => {
    await householdRepository.declineMember(memberId);
    setHousehold((current) => ({
      ...current,
      members: current.members.filter((item) => item.id !== memberId),
    }));
    await trackAnalytics('member.declined', { memberId }, analyticsContext);
  };

  const markNotificationRead = async (notificationId: string) => {
    await notificationsRepository.markRead(notificationId);
    setNotifications((current) =>
      current.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item))
    );
    await trackAnalytics('notification.read', { notificationId }, analyticsContext);
  };

  const markAllNotificationsRead = async () => {
    await notificationsRepository.markAllRead(household.id);
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    await trackAnalytics('notification.read_all', {}, analyticsContext);
  };

  const requestRewardRedemption = async (rewardId: string, note?: string) => {
    if (!household.id || !currentMember) {
      return;
    }
    const caps = resolveMemberCapabilities(household);
    // Users redeem; admins may also redeem for testing.
    if (!permissions.canManageHousehold && !caps.allowRewardRedeem) {
      return;
    }

    const reward = household.rewards.find((item) => item.id === rewardId);
    const redemption = await rewardsRepository.requestRedemption({
      householdId: household.id,
      rewardId,
      memberId: currentMember.id,
      note,
    });
    setPendingRedemptions((current) => [redemption, ...current.filter((item) => item.id !== redemption.id)]);
    setRedemptions((current) => [redemption, ...current.filter((item) => item.id !== redemption.id)]);
    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    const created = await poppinsNotifications.rewardRequested(pushNotification, prefs, {
      title: reward?.title ?? 'a reward',
      memberName: currentMember.name,
      redemptionId: redemption.id,
      audienceRoles: [...REWARD_REVIEW_ROLES],
    });
    if (created) {
      await scheduleLocalReminder(created.title, created.body, 2).catch((error) =>
        console.warn('Reward request reminder skipped', error)
      );
    }
    await trackAnalytics('reward.redemption_requested', { rewardId }, analyticsContext);
  };

  const claimReward = async (rewardId: string): Promise<'claimed' | 'requested' | null> => {
    if (!household.id || !currentMember) {
      return null;
    }
    const caps = resolveMemberCapabilities(household);
    if (!permissions.canManageHousehold && !caps.allowRewardRedeem) {
      return null;
    }
    const reward = household.rewards.find((item) => item.id === rewardId && !item.archived);
    if (!reward) {
      return null;
    }
    if (
      reward.assignedMemberId &&
      reward.assignedMemberId !== currentMember.id &&
      !permissions.canManageHousehold
    ) {
      return null;
    }
    // v2 §6.1: rewards are not purchased with XP — no affordability gate / debit.

    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;

    if (reward.approvalRequired) {
      await requestRewardRedemption(rewardId);
      return 'requested';
    }

    const redemption = await rewardsRepository.requestRedemption({
      householdId: household.id,
      rewardId,
      memberId: currentMember.id,
      note: 'Instant claim',
    });
    const updated = await rewardsRepository.approveRedemption(redemption.id);
    setPendingRedemptions((current) => current.filter((item) => item.id !== redemption.id));
    setRedemptions((current) => [
      updated,
      ...current.filter((item) => item.id !== redemption.id),
    ]);
    if (dataMode !== 'mock') {
      await reloadHouseholdDomains();
    }
    // Assigned one-shots leave the catalog after instant claim; shared catalog stays.
    if (reward.assignedMemberId) {
      await archiveReward(rewardId);
    }
    await poppinsNotifications.rewardClaimed(pushNotification, prefs, {
      title: reward.title,
      memberName: currentMember.name,
      cost: reward.cost ?? 0,
      redemptionId: redemption.id,
      audienceRoles: [...REWARD_REVIEW_ROLES],
    });
    await trackAnalytics('reward.claimed_instant', { rewardId }, analyticsContext);
    return 'claimed';
  };

  const requestSpecialReward = async (title: string, note?: string, cost = 150) => {
    if (!household.id || !currentMember) {
      return;
    }
    const caps = resolveMemberCapabilities(household);
    if (!permissions.canManageHousehold && !caps.allowSpecialRewardRequest) {
      return;
    }
    const reward = await rewardsRepository.createReward(household.id, {
      title,
      cost,
      approvalRequired: true,
      emoji: '✨',
      specialRequest: true,
      category: 'Special',
      origin: 'special-request',
      createdByMemberId: currentMember.id,
      createdByName: currentMember.name,
    });
    setHousehold((current) => ({
      ...current,
      rewards: [reward, ...current.rewards.filter((item) => item.id !== reward.id)],
    }));
    await requestRewardRedemption(reward.id, note || 'Special request');
  };

  const createReward = async (
    input: CreateRewardInput,
    options?: { householdId?: string | null }
  ) => {
    const targetHouseholdId = options?.householdId ?? household.id;
    const allowOnboardingWrite = Boolean(options?.householdId && currentUser);
    if (!allowOnboardingWrite && !permissions.canManageHousehold) {
      return;
    }
    const reward = await rewardsRepository.createReward(targetHouseholdId, {
      ...input,
      origin: input.origin ?? 'minted',
      createdByMemberId: input.createdByMemberId ?? currentMember?.id,
      createdByName: input.createdByName ?? currentMember?.name ?? currentUser?.name,
    });
    setHousehold((current) => ({
      ...current,
      rewards: [reward, ...current.rewards.filter((item) => item.id !== reward.id)],
    }));
    if (reward.assignedMemberId && reward.assignedMemberId !== currentMember?.id) {
      const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
      await poppinsNotifications.rewardAssigned(pushNotification, prefs, {
        title: reward.title,
        cost: reward.cost ?? 0,
        rewardId: reward.id,
        assignedByName: currentMember?.name ?? 'Admin',
        audienceMemberIds: [reward.assignedMemberId],
      });
    }
    await trackAnalytics('reward.created', { rewardId: reward.id }, analyticsContext);
  };

  const archiveReward = async (rewardId: string) => {
    await rewardsRepository.archiveReward(rewardId);
    setHousehold((current) => ({
      ...current,
      rewards: current.rewards.map((item) =>
        item.id === rewardId ? { ...item, archived: true } : item
      ),
    }));
    await trackAnalytics('reward.archived', { rewardId }, analyticsContext);
  };

  const approveRedemption = async (redemptionId: string) => {
    const pending =
      pendingRedemptions.find((item) => item.id === redemptionId) ??
      redemptions.find((item) => item.id === redemptionId);
    const reward = household.rewards.find((item) => item.id === pending?.rewardId);
    const updated = await rewardsRepository.approveRedemption(redemptionId);
    setPendingRedemptions((current) => current.filter((item) => item.id !== redemptionId));
    setRedemptions((current) =>
      current.map((item) => (item.id === redemptionId ? updated : item))
    );
    if (pending && reward) {
      // v2 §6.1: approving a reward never deducts XP.
      if (reward.assignedMemberId) {
        await archiveReward(reward.id);
      }
    }
    if (dataMode !== 'mock') {
      await reloadHouseholdDomains();
    }
    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    await poppinsNotifications.rewardApproved(pushNotification, prefs, {
      title: reward?.title ?? 'Reward',
      redemptionId,
      audienceMemberIds: pending?.memberId ? [pending.memberId] : undefined,
    });
    await trackAnalytics('reward.redemption_approved', { redemptionId, status: updated.status }, analyticsContext);
  };

  const rejectRedemption = async (redemptionId: string) => {
    const updated = await rewardsRepository.rejectRedemption(redemptionId);
    setPendingRedemptions((current) => current.filter((item) => item.id !== redemptionId));
    setRedemptions((current) =>
      current.map((item) => (item.id === redemptionId ? updated : item))
    );
    await trackAnalytics('reward.redemption_rejected', { redemptionId, status: updated.status }, analyticsContext);
  };

  const grantAllowance = async (input: Omit<CreateAllowanceInput, 'kind'>) => {
    if (!permissions.canManageHousehold || !household.id) {
      return null;
    }
    const grant = await rewardsRepository.createAllowance(household.id, {
      ...input,
      kind: 'admin-grant',
      createdByMemberId: currentMember?.id,
      createdByName: currentMember?.name,
    });
    setAllowances((current) => [grant, ...current.filter((item) => item.id !== grant.id)]);
    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    await poppinsNotifications.allowanceGranted(pushNotification, prefs, {
      amountLabel: grant.amountLabel,
      allowanceId: grant.id,
      audienceMemberIds: [grant.memberId],
    });
    await trackAnalytics('allowance.granted', { allowanceId: grant.id }, analyticsContext);
    return grant;
  };

  const requestAllowance = async (
    input: Omit<CreateAllowanceInput, 'kind' | 'memberId' | 'memberName'>
  ) => {
    if (!household.id || !currentMember) {
      return null;
    }
    // Members request; admins may also request for testing.
    const grant = await rewardsRepository.createAllowance(household.id, {
      ...input,
      memberId: currentMember.id,
      memberName: currentMember.name,
      kind: 'member-request',
      createdByMemberId: currentMember.id,
      createdByName: currentMember.name,
    });
    setAllowances((current) => [grant, ...current.filter((item) => item.id !== grant.id)]);
    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    const created = await poppinsNotifications.allowanceRequested(pushNotification, prefs, {
      amountLabel: grant.amountLabel,
      memberName: currentMember.name,
      allowanceId: grant.id,
    });
    if (created) {
      await scheduleLocalReminder(created.title, created.body, 2).catch((error) =>
        console.warn('Allowance request reminder skipped', error)
      );
    }
    await trackAnalytics('allowance.requested', { allowanceId: grant.id }, analyticsContext);
    return grant;
  };

  const approveAllowance = async (allowanceId: string) => {
    if (!permissions.canApproveReward && !permissions.canManageHousehold) {
      return;
    }
    const pending = allowances.find((item) => item.id === allowanceId);
    const updated = await rewardsRepository.approveAllowance(allowanceId);
    setAllowances((current) =>
      current.map((item) => (item.id === allowanceId ? updated : item))
    );
    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    await poppinsNotifications.allowanceApproved(pushNotification, prefs, {
      amountLabel: updated.amountLabel,
      allowanceId,
      audienceMemberIds: pending?.memberId ? [pending.memberId] : [updated.memberId],
    });
    await trackAnalytics('allowance.approved', { allowanceId }, analyticsContext);
  };

  const rejectAllowance = async (allowanceId: string) => {
    if (!permissions.canApproveReward && !permissions.canManageHousehold) {
      return;
    }
    const updated = await rewardsRepository.rejectAllowance(allowanceId);
    setAllowances((current) =>
      current.map((item) => (item.id === allowanceId ? updated : item))
    );
    await trackAnalytics('allowance.rejected', { allowanceId }, analyticsContext);
  };

  const updateMemberRole = async (memberId: string, role: HouseholdRole) => {
    const member = household.members.find((item) => item.id === memberId);
    if (!member) {
      return;
    }
    if (role === 'admin' && !canPromoteToAdmin(household, memberId)) {
      console.warn('Family admin seats are full (max 2).');
      return;
    }

    const updated = await householdRepository.updateMemberRole(member, role);
    const nextMember: HouseholdMember =
      role === 'shared-device'
        ? { ...updated, sharedWithMemberIds: updated.sharedWithMemberIds ?? [] }
        : { ...updated, sharedWithMemberIds: undefined };
    setHousehold((current) => ({
      ...current,
      members: current.members.map((item) => (item.id === memberId ? nextMember : item)),
    }));
    await trackAnalytics('member.role_updated', { memberId, role }, analyticsContext);
  };

  const createSharedDevice = async (name?: string) => {
    if (!permissions.canManageHousehold) {
      return null;
    }
    const created = await householdRepository.createSharedDevice(
      household.id,
      name?.trim() || 'Shared device'
    );
    setHousehold((current) => ({
      ...current,
      members: [...current.members, created],
    }));
    await trackAnalytics('member.shared_device_created', { memberId: created.id }, analyticsContext);
    return created;
  };

  const updateSharedDeviceLinks = async (deviceId: string, memberIds: string[]) => {
    if (!permissions.canManageHousehold) {
      return;
    }
    const device = household.members.find((item) => item.id === deviceId);
    if (!device || device.role !== 'shared-device') {
      return;
    }
    const updated = await householdRepository.updateSharedDeviceLinks(device, memberIds);
    setHousehold((current) => ({
      ...current,
      members: current.members.map((item) => (item.id === deviceId ? updated : item)),
    }));
    await trackAnalytics(
      'member.shared_device_links_updated',
      { memberId: deviceId, count: memberIds.length },
      analyticsContext
    );
  };

  const createChildInvites = async (
    names: string[],
    options?: { householdId?: string | null; householdName?: string }
  ) => {
    const householdId = options?.householdId ?? household.id;
    const householdName = options?.householdName ?? household.householdName;
    if (!currentUser || !householdId) {
      throw new Error('Create your household first, then invite kids.');
    }
    const onboardingWrite = Boolean(options?.householdId);
    if (
      !onboardingWrite &&
      !permissions.canInviteMembers &&
      !permissions.canManageHousehold
    ) {
      throw new Error('Only a parent/admin can create kid invites.');
    }

    const trimmed = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(0, 12);
    if (trimmed.length === 0) {
      throw new Error('Add at least one kid name.');
    }

    const existingMembers = onboardingWrite
      ? // Prefer latest snapshot from state updater path; fall back to closure.
        household.id === householdId
        ? household.members
        : household.members
      : household.members;

    const created: HouseholdMember[] = [];
    for (const name of trimmed) {
      const already = existingMembers.find(
        (member) =>
          member.role === 'child' &&
          member.name.trim().toLowerCase() === name.toLowerCase() &&
          member.status === 'active',
      );
      if (already) {
        await saveChildInviteRecord({
          member: already,
          householdId,
          householdName,
          code: already.profileInviteCode,
        });
        created.push(already);
        continue;
      }

      const member = await householdRepository.createChildMember(householdId, name);
      await saveChildInviteRecord({
        member,
        householdId,
        householdName,
        code: member.profileInviteCode,
      });
      created.push(member);
    }

    setHousehold((current) => {
      const ids = new Set(current.members.map((member) => member.id));
      const additions = created.filter((member) => !ids.has(member.id));
      const next = additions.length
        ? { ...current, members: [...current.members, ...additions] }
        : current;
      if (dataMode === 'mock' && additions.length) {
        void persistMockHouseholdSnapshot(next);
      }
      return next;
    });

    await trackAnalytics(
      'member.child_invites_created',
      { count: created.length },
      analyticsContext,
    );
    return created;
  };

  const addOnboardingMembers = async (
    householdId: string,
    drafts: { name: string; role: 'admin' | 'member' }[],
    options?: { householdName?: string }
  ) => {
    if (!currentUser || !householdId) {
      throw new Error('Create your household first, then add members.');
    }
    const householdName = options?.householdName ?? household.householdName;
    const created: HouseholdMember[] = [];

    for (const draft of drafts) {
      const name = draft.name.trim();
      if (!name) continue;
      const role = draft.role === 'admin' ? 'admin' : 'child';
      const already = household.members.find(
        (member) =>
          member.name.trim().toLowerCase() === name.toLowerCase() &&
          member.status === 'active' &&
          member.role !== 'owner'
      );
      if (already) {
        created.push(already);
        continue;
      }
      const member = await householdRepository.createOnboardingMember(householdId, {
        name,
        role,
      });
      if (member.role === 'child') {
        await saveChildInviteRecord({
          member,
          householdId,
          householdName,
          code: member.profileInviteCode,
        });
      }
      created.push(member);
    }

    setHousehold((current) => {
      const ids = new Set(current.members.map((member) => member.id));
      const additions = created.filter((member) => !ids.has(member.id));
      const next = additions.length
        ? { ...current, members: [...current.members, ...additions] }
        : current;
      if (dataMode === 'mock') {
        void persistMockHouseholdSnapshot(next);
      }
      return next;
    });

    await trackAnalytics(
      'member.onboarding_roster_persisted',
      { count: created.length },
      { ...analyticsContext, householdId }
    );
    return created;
  };

  const redeemChildInvite = async (rawCode: string) => {
    const code =
      parseInvitePayload(rawCode) ?? (rawCode.trim() ? normalizeInviteCode(rawCode) : null);
    if (!code) {
      throw new Error('Enter or scan a valid kid invite code.');
    }

    const record = await loadChildInviteRecord(code);
    const fromHousehold =
      resolveMemberByProfileCode(code, household.members) ??
      resolveMemberByProfileCode(code, mockHousehold.members);
    const member = record?.member ?? fromHousehold;

    if (!member || member.role !== 'child' || member.status !== 'active') {
      throw new Error('Ask a parent to AirDrop or send your kid invite. No sign-in needed.');
    }

    const user: OrbitUser = {
      id: `child-local-${member.id}`,
      email: `${member.name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'kid'}@kids.choremaxx.local`,
      name: member.name,
      avatar: member.avatar,
      profileComplete: true,
    };

    // Prefer the admin household snapshot when we know it; otherwise keep demo Rivera data.
    if (record?.householdId && household.id === record.householdId) {
      setHousehold((current) => {
        const exists = current.members.some((item) => item.id === member.id);
        return {
          ...current,
          greetingName: member.name,
          members: exists
            ? current.members.map((item) => (item.id === member.id ? { ...item, ...member } : item))
            : [...current.members, member],
        };
      });
    } else if (mockHousehold.members.some((item) => item.id === member.id)) {
      setHousehold({
        ...mockHousehold,
        greetingName: member.name,
        members: mockHousehold.members.map((item) =>
          item.id === member.id ? { ...item, ...member } : item,
        ),
      });
    } else {
      setHousehold((current) => {
        const base =
          current.id && current.members.some((item) => item.role === 'owner')
            ? current
            : mockHousehold;
        const exists = base.members.some((item) => item.id === member.id);
        return {
          ...base,
          greetingName: member.name,
          members: exists
            ? base.members.map((item) => (item.id === member.id ? { ...item, ...member } : item))
            : [...base.members, member],
        };
      });
    }

    setCurrentUser(user);
    setActiveMemberId(member.id);
    await authRepository.persistLocalSession(user, member.id);

    const { setupSharedDeviceSession, selectDeviceProfile } = await import(
      '@/lib/device/device-session'
    );
    await setupSharedDeviceSession({
      profileMemberIds: [member.id],
      deviceLabel: `${member.name}'s device`,
    });
    await selectDeviceProfile(member.id);

    await trackAnalytics(
      'member.child_invite_redeemed',
      { memberId: member.id },
      { householdId: record?.householdId ?? household.id, userId: user.id },
    );
    return member;
  };

  const connectSharedTabletProfiles = async (rawCodes: string[], deviceLabel?: string) => {
    const codes = [
      ...new Set(
        rawCodes
          .map((raw) => parseInvitePayload(raw) ?? (raw.trim() ? normalizeInviteCode(raw) : null))
          .filter((code): code is string => Boolean(code)),
      ),
    ];
    if (codes.length === 0) {
      throw new Error('Add at least one invite code or scan an AirDrop QR.');
    }

    const resolved: HouseholdMember[] = [];
    for (const code of codes) {
      const record = await loadChildInviteRecord(code);
      const member =
        record?.member ??
        resolveMemberByProfileCode(code, household.members) ??
        resolveMemberByProfileCode(code, mockHousehold.members);
      if (!member || member.status !== 'active' || member.role === 'shared-device') {
        throw new Error(`No profile for ${code}. Ask an admin to AirDrop or send that invite.`);
      }
      if (!resolved.some((item) => item.id === member.id)) {
        resolved.push(member);
      }
    }

    // Prefer Rivera/demo household when profiles live there; otherwise merge onto current.
    const fromDemo = resolved.every((member) =>
      mockHousehold.members.some((item) => item.id === member.id),
    );
    if (fromDemo) {
      setHousehold({
        ...mockHousehold,
        greetingName: resolved[0]?.name ?? mockHousehold.greetingName,
      });
    } else {
      setHousehold((current) => {
        const ids = new Set(current.members.map((item) => item.id));
        const additions = resolved.filter((member) => !ids.has(member.id));
        return {
          ...current,
          greetingName: resolved[0]?.name ?? current.greetingName,
          members: additions.length ? [...current.members, ...additions] : current.members,
        };
      });
    }

    const primary = resolved[0]!;
    const user: OrbitUser = {
      id: `tablet-local-${primary.id}`,
      email: `tablet-${primary.id}@kids.choremaxx.local`,
      name: primary.name,
      avatar: primary.avatar,
      profileComplete: true,
    };
    setCurrentUser(user);
    setActiveMemberId(primary.id);
    await authRepository.persistLocalSession(user, primary.id);

    const { setupSharedDeviceSession, selectDeviceProfile } = await import(
      '@/lib/device/device-session'
    );
    const session = await setupSharedDeviceSession({
      profileMemberIds: resolved.map((member) => member.id),
      deviceLabel: deviceLabel?.trim() || 'Shared tablet',
    });

    const needsProfilePick = resolved.length > 1;
    if (!needsProfilePick) {
      await selectDeviceProfile(primary.id);
    }

    await trackAnalytics(
      'device.shared_tablet_connected',
      { count: resolved.length },
      { householdId: household.id, userId: user.id },
    );

    return { members: resolved, needsProfilePick: needsProfilePick || session.needsProfilePick };
  };

  const splitAllTasksBetweenTwo = async (nameA?: string, nameB?: string) => {
    let left = nameA?.trim();
    let right = nameB?.trim();
    if (!left || !right) {
      const pair = resolveSplitPair(household.members);
      if (!pair) {
        return;
      }
      left = pair[0].name;
      right = pair[1].name;
    }
    if (left === right) {
      return;
    }

    const nextTasks = splitOpenTasksBetweenTwo(household.tasks, left, right);
    const changed = nextTasks.filter((task, index) => task.assignee !== household.tasks[index]?.assignee);
    for (const task of changed) {
      await taskRepository.updateTask(task);
    }
    setHousehold((current) => ({
      ...current,
      tasks: splitOpenTasksBetweenTwo(current.tasks, left!, right!),
    }));
    await pushNotification({
      title: 'Poppins · Tasks split',
      body: `Open tasks are now shared between ${left} and ${right}.`,
      category: 'tasks',
      priority: 'medium',
      data: { kind: 'tasks_split', nameA: left, nameB: right },
    });
    await trackAnalytics('task.split_between_two', { nameA: left, nameB: right }, analyticsContext);
  };

  const removeMember = async (memberId: string) => {
    if (!permissions.canManageHousehold) {
      return;
    }
    const target = household.members.find((item) => item.id === memberId);
    if (!target || target.role === 'owner') {
      return;
    }
    await householdRepository.removeMember(memberId);
    setHousehold((current) => ({
      ...current,
      members: current.members
        .filter((item) => item.id !== memberId)
        .map((item) =>
          item.role === 'shared-device'
            ? {
                ...item,
                sharedWithMemberIds: (item.sharedWithMemberIds ?? []).filter((id) => id !== memberId),
              }
            : item
        ),
    }));
    if (activeMemberId === memberId) {
      setActiveMemberId(null);
    }
    await trackAnalytics('member.removed', { memberId }, analyticsContext);
  };

  const deleteAccount = async () => {
    await authRepository.deleteAccount();
    await trackAnalytics('auth.account_deleted', {}, analyticsContext);
    setCurrentUser(null);
    setHousehold(mockHousehold);
    setPendingRedemptions([]);
    setRedemptions([]);
    setNotifications([]);
  };

  const exportUserData = async () => {
    const payload = await authRepository.exportUserData();
    await trackAnalytics('auth.data_exported', {}, analyticsContext);
    return payload;
  };

  const toggleSmartDevice = async (deviceId: string) => {
    const updated = await smartHomeRepository.toggleDevice(deviceId);
    if (updated) {
      setSmartHomeDevices((current) => current.map((device) => (device.id === deviceId ? updated : device)));
    }
    await trackAnalytics('smart_home.device_toggled', { deviceId }, analyticsContext);
  };

  const activateSmartScene = async (sceneId: string) => {
    await smartHomeRepository.activateScene(sceneId);
    const devices = await smartHomeRepository.listDevices(household.id);
    setSmartHomeDevices(devices);
    await trackAnalytics('smart_home.scene_activated', { sceneId }, analyticsContext);
  };

  useEffect(() => {
    let isMounted = true;

    async function refreshPoppins() {
      const [briefing, weeklyBriefing, recommendations] = await Promise.all([
        poppinsRepository.getPoppinsBriefing(household, metrics),
        poppinsRepository.getWeeklyBriefing(household, metrics),
        poppinsRepository.getRecommendations(household, metrics),
      ]);
      if (isMounted) {
        setHousehold((current) => ({
          ...current,
          poppins: briefing,
        }));
        setPoppinsWeeklyBriefing(weeklyBriefing);
        setPoppinsRecommendations(recommendations);
      }
    }

    refreshPoppins().catch((error) => {
      console.warn('Failed to refresh Poppins briefing', error);
    });

    return () => {
      isMounted = false;
    };
  }, [
    household.events,
    household.groceries,
    household.members,
    household.tasks,
    metrics.calendarCoverage,
    metrics.groceryReadiness,
    metrics.momentum,
    metrics.openTasks,
    metrics.missingGroceries,
    metrics.upcomingEvents,
  ]);

  const value = useMemo(
    () => ({
      currentUser,
      currentMember,
      activeMemberId,
      household: {
        ...household,
        momentum: metrics.momentum,
        completionRate: metrics.taskCompletionRate,
        missingGroceries: metrics.missingGroceries,
        upcomingEvents: metrics.upcomingEvents,
        poppins: poppinsBriefing,
      },
      hasHousehold,
      isPendingMember,
      isLoading,
      isSignedIn: Boolean(currentUser),
      metrics,
      membersWithProgress,
      achievements,
      poppinsAskCount,
      poppinsConversation,
      poppinsBriefing,
      poppinsRecommendations,
      poppinsMonitorActions,
      poppinsWeeklyBriefing,
      permissions,
      v2Permissions,
      rewardCapabilities,
      notifications: visibleNotifications,
      unreadNotificationCount,
      pendingRedemptions,
      redemptions,
      allowances,
      pendingAllowances,
      smartHomeDevices,
      smartHomeScenes,
      storeRecommendations,
      inviteLinks,
      preferredStore: getPreferredStore(household.preferredStoreId),
      canAddGroceryWishlist:
        permissions.canManageGroceries ||
        resolveMemberCapabilities(household).allowGroceryAdd ||
        (currentMember?.role === 'child' && (currentMember?.xp ?? 0) >= CHILD_GROCERY_WISHLIST_XP),
      askPoppins,
      askPoppinsVoice,
      appendPoppinsTurn,
      switchPersona,
      approveMember,
      declineMember,
      createHousehold,
      createProfile,
      updateDisplayName,
      updateMemberDisplayName,
      createTask,
      updateTask,
      forgotPassword,
      completeTask,
      submitTaskProof,
      approveTaskProof,
      confirmVerification,
      requestAnotherProof,
      markNotDone,
      runOccurrenceCatchUp,
      penalizeSplitAssignee,
      reassignTask,
      awardDailyStreak,
      redeemStreak,
      deleteTask,
      cancelTask,
      splitAllTasksBetweenTwo,
      addMissingGrocery,
      setPreferredStore,
      joinHousehold,
      markGroceryPurchased,
      markGroceryMissing,
      markGroceryLow,
      createEvent,
      updateEvent,
      deleteEvent,
      remindAboutEvent,
      createItinerary,
      suggestPoppinsItinerary,
      advanceItineraryStop,
      openStopInMaps,
      reorderItineraryStops,
      signIn,
      hydrateFromSession,
      signOut,
      signUp,
      suggestedPoppinsQuestions,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      pushNotification,
      updateNotificationPrefs,
      updateMemberCapabilities,
      updateHouseholdRewardSettings,
      updateHouseholdRewardModel,
      updateAccentTheme,
      updatePalette,
      updateHouseholdAccentTheme,
      accentTheme,
      paletteId: resolvedPaletteId,
      appearanceMode,
      updateAppearanceMode,
      backgroundThemeId,
      updateBackgroundTheme,
      orbitPalette,
      preferredMapsApp,
      updatePreferredMapsApp,
      openFullItineraryInMaps,
      toggleItineraryFavorite,
      rerunItinerary,
      upsertSavedPlace,
      removeSavedPlace,
      updateMemberAvatar,
      upsertRoom,
      removeRoom,
      runPoppinsMonitor,
      requestRewardRedemption,
      claimReward,
      requestSpecialReward,
      createReward,
      archiveReward,
      approveRedemption,
      rejectRedemption,
      grantAllowance,
      requestAllowance,
      approveAllowance,
      rejectAllowance,
      updateMemberRole,
      createSharedDevice,
      updateSharedDeviceLinks,
      createChildInvites,
      addOnboardingMembers,
      redeemChildInvite,
      connectSharedTabletProfiles,
      removeMember,
      deleteAccount,
      exportUserData,
      toggleSmartDevice,
      activateSmartScene,
      refreshStoreRecommendations,
      refreshInviteLinks,
      refreshSmartHome,
      refreshHousehold: reloadHouseholdDomains,
    }),
    [
      currentUser,
      currentMember,
      activeMemberId,
      household,
      hasHousehold,
      isPendingMember,
      isLoading,
      metrics,
      membersWithProgress,
      achievements,
      poppinsAskCount,
      poppinsConversation,
      poppinsBriefing,
      poppinsRecommendations,
      poppinsMonitorActions,
      poppinsWeeklyBriefing,
      permissions,
      visibleNotifications,
      unreadNotificationCount,
      pendingRedemptions,
      redemptions,
      allowances,
      pendingAllowances,
      smartHomeDevices,
      smartHomeScenes,
      storeRecommendations,
      inviteLinks,
      refreshNotifications,
      refreshStoreRecommendations,
      refreshInviteLinks,
      refreshSmartHome,
      runPoppinsMonitor,
      accentTheme,
      resolvedPaletteId,
      updateAccentTheme,
      updatePalette,
      updateHouseholdAccentTheme,
      appearanceMode,
      updateAppearanceMode,
      backgroundThemeId,
      updateBackgroundTheme,
      orbitPalette,
      preferredMapsApp,
      updatePreferredMapsApp,
      openFullItineraryInMaps,
      toggleItineraryFavorite,
      rerunItinerary,
      upsertSavedPlace,
      removeSavedPlace,
      updateMemberAvatar,
      upsertRoom,
      removeRoom,
      updateMemberCapabilities,
      updateHouseholdRewardSettings,
      updateHouseholdRewardModel,
      updateDisplayName,
      updateMemberDisplayName,
      addOnboardingMembers,
      redeemStreak,
    ]
  );

  return <OrbitContext.Provider value={value}>{children}</OrbitContext.Provider>;
}

async function hydrateHousehold(baseHousehold: HouseholdSnapshot): Promise<HouseholdSnapshot> {
  const householdId = baseHousehold.id;
  const [tasks, groceries, events, rewards, badges, itineraries, themeId, savedRooms, avatarOverrides] =
    await Promise.all([
      taskRepository.getTasks(householdId),
      groceryRepository.getGroceries(householdId),
      calendarRepository.getEvents(householdId),
      rewardsRepository.getRewards(householdId),
      rewardsRepository.getBadges(householdId),
      itineraryRepository.list(householdId),
      loadAccentThemeId(householdId),
      loadHouseholdRooms(householdId),
      loadMemberAvatarOverrides(householdId),
    ]);
  const withAvatars = baseHousehold.members.map((member) =>
    avatarOverrides[member.id] ? { ...member, avatar: avatarOverrides[member.id] } : member,
  );
  const members = await applyStoredMemberThemes(householdId, withAvatars);
  const initialHousehold: HouseholdSnapshot = await applyStoredHouseholdLogicPrefs({
    ...baseHousehold,
    members,
    badges,
    events,
    groceries,
    rewards,
    tasks,
    itineraries: itineraries.length > 0 ? itineraries : baseHousehold.itineraries ?? [],
    taskTemplates: baseHousehold.taskTemplates ?? [],
    notificationPrefs: baseHousehold.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS,
    preferredStoreId: baseHousehold.preferredStoreId ?? 'store-freshmart',
    accentThemeId: themeId || baseHousehold.accentThemeId || DEFAULT_ACCENT_THEME_ID,
    rooms:
      savedRooms?.length
        ? savedRooms
        : baseHousehold.rooms?.length
          ? baseHousehold.rooms
          : DEFAULT_HOUSEHOLD_ROOMS.map((room) => ({ ...room })),
  });
  const briefing = await poppinsRepository.getPoppinsBriefing(initialHousehold, calculateMetrics(initialHousehold));

  return {
    ...initialHousehold,
    poppins: briefing,
  };
}

export function useOrbitOptional() {
  return useContext(OrbitContext);
}

export function useOrbit() {
  const context = useContext(OrbitContext);

  if (!context) {
    throw new Error('useOrbit must be used within OrbitProvider');
  }

  return context;
}

function calculateMetrics(household: HouseholdSnapshot): OrbitMetrics {
  const completedTasks = household.tasks.filter((task) => task.status === 'Completed').length;
  const taskCompletionRate =
    household.tasks.length > 0 ? Math.round((completedTasks / household.tasks.length) * 100) : 100;

  const readyGroceries = household.groceries.filter(
    (item) => item.status === 'Available' || item.status === 'Purchased'
  ).length;
  const groceryReadiness =
    household.groceries.length > 0 ? Math.round((readyGroceries / household.groceries.length) * 100) : 100;

  const coveredEvents = household.events.filter((event) => event.responsible.length > 0).length;
  const calendarCoverage =
    household.events.length > 0 ? Math.round((coveredEvents / household.events.length) * 100) : 100;

  const activeMembers = household.members.filter(
    (member) => member.status === 'active' && member.role !== 'guest' && !isSharedDeviceRole(member.role),
  );
  let fairnessScore = 100;
  if (activeMembers.length >= 2) {
    const xp = activeMembers.map((member) => member.weekXp ?? 0);
    const total = xp.reduce((a, b) => a + b, 0);
    if (total > 0) {
      const ideal = total / xp.length;
      const variance = xp.reduce((sum, v) => sum + Math.abs(v - ideal), 0) / (ideal * xp.length || 1);
      fairnessScore = Math.max(0, Math.min(100, Math.round(100 - variance * 50)));
    }
  }
  const householdStreak = activeMembers.length
    ? Math.max(...activeMembers.map((member) => member.streak ?? 0))
    : 0;

  return {
    taskCompletionRate,
    groceryReadiness,
    calendarCoverage,
    momentum: Math.round(taskCompletionRate * 0.45 + groceryReadiness * 0.35 + calendarCoverage * 0.2),
    openTasks: household.tasks.filter((task) => isOpenTask(task)).length,
    missingGroceries: household.groceries.filter((item) => item.status === 'Missing').length,
    purchasedGroceries: household.groceries.filter((item) => item.status === 'Purchased').length,
    upcomingEvents: countUpcomingSoon(household.events),
    fairnessScore,
    householdStreak,
  };
}

function calculateMemberProgress(member: HouseholdMember, tasks: HouseholdTask[]): MemberProgress {
  const gameLevel = getLevel(member.xp);
  const levelIndex = LEVELS.findIndex((level) => level.name === gameLevel.name);
  const level = levelIndex >= 0 ? levelIndex + 1 : 1;
  const levelProgress = xpProgress(member.xp);
  const nextLevelXp = gameLevel.maxXP + 1;
  const accent = MEMBER_ACCENTS[member.name] ?? { color: '#38BDF8', emoji: member.avatar };
  const tasksCompleted = tasks.filter(
    (task) => task.assignee === member.name && task.status === 'Completed',
  ).length;

  return {
    ...member,
    level,
    levelProgress,
    nextLevelXp,
    levelName: gameLevel.name,
    levelEmoji: gameLevel.emoji,
    levelColor: gameLevel.color,
    weekXp: member.weekXp ?? Math.max(10, Math.round(member.xp * 0.08)),
    streak: member.streak ?? 0,
    accentColor: accent.color,
    avatarEmoji: memberDisplayEmoji(member),
    tasksCompleted,
  };
}

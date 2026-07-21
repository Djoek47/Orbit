import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { dataMode } from '@/config/data-mode';
import { createEmptyHousehold, mockHousehold } from '@/data/mock-household';
import type { NovaChatMessage } from '@/lib/ai/ai-provider';
import { trackAnalytics } from '@/lib/analytics';
import { evaluateAchievements, getLevel, LEVELS, MEMBER_ACCENTS, memberDisplayEmoji, xpProgress } from '@/lib/game-levels';
import { getLocationAwareGrocerySuggestions } from '@/lib/grocery/location-suggestions';
import { buildStoreRecommendations } from '@/lib/grocery/recommendations';
import { countUpcomingSoon } from '@/lib/calendar/event-groups';
import {
  loadHouseholdRooms,
  loadMemberAvatarOverrides,
  saveHouseholdRooms,
  saveMemberAvatarOverride,
} from '@/lib/household/local-prefs';
import { buildInviteLinks } from '@/lib/invites/parse-invite';
import { suggestItineraryFromHousehold } from '@/lib/calendar/suggest-itinerary';
import { isNotificationVisibleToRole, PROOF_REVIEW_ROLES } from '@/lib/notifications/audience';
import { registerForPushNotifications, scheduleLocalReminder } from '@/lib/notifications/push';
import { getPermissionsForRole, type HouseholdPermissions } from '@/lib/permissions';
import { persistHouseholdScore } from '@/lib/momentum/score-writer';
import { subscribeHouseholdRealtime } from '@/lib/realtime/household-realtime';
import { spawnNextOccurrence } from '@/lib/tasks/recurring';
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
import { isTaskLate, resolveCompletionXp } from '@/lib/tasks/xp';
import {
  canPromoteToAdmin,
  resolveSplitPair,
} from '@/lib/household/admins';
import {
  authRepository,
  calendarRepository,
  groceryRepository,
  householdRepository,
  itineraryRepository,
  notificationsRepository,
  novaRepository,
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
import { loadNovaNotificationPrefs, saveNovaNotificationPrefs } from '@/lib/nova/prefs-store';
import {
  applyStoredMemberThemes,
  loadAccentThemeId,
  saveAccentThemeId,
  saveMemberAccentThemeId,
} from '@/lib/theme/accent-prefs';
import {
  loadAppearanceMode,
  loadBackgroundThemeId,
  loadPreferredMapsApp,
  resolveOrbitPalette,
  saveAppearanceMode,
  saveBackgroundThemeId,
  savePreferredMapsApp,
  type AppearanceMode,
  type PreferredMapsApp,
} from '@/lib/theme/appearance-prefs';
import {
  DEFAULT_BACKGROUND_THEME_ID,
  type BackgroundThemeId,
} from '@/constants/background-themes';
import type { OrbitColorPalette } from '@/constants/orbit-theme';
import { openDirections, openMultiStopRoute } from '@/lib/maps/directions';
import { DEFAULT_NOVA_NOTIFICATION_PREFS, novaNotifications } from '@/services/nova-notifications';
import { runMonitorPass } from '@/services/nova-monitor';
import { novaService, suggestedNovaQuestions } from '@/services/nova-service';
import type {
  AuthSession,
  CancelTaskScope,
  CreateEventInput,
  CreateGroceryInput,
  CreateHouseholdInput,
  CreateItineraryInput,
  CreateProfileInput,
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
  MemberProgress,
  NotificationItem,
  NovaBriefing,
  NovaConversationAnswer,
  NovaMonitorAction,
  NovaNotificationPrefs,
  NovaRecommendation,
  NovaWeeklyBriefing,
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
  novaAskCount: number;
  novaConversation: NovaChatMessage[];
  novaBriefing: NovaBriefing;
  novaRecommendations: NovaRecommendation[];
  novaMonitorActions: NovaMonitorAction[];
  novaWeeklyBriefing: NovaWeeklyBriefing;
  permissions: HouseholdPermissions;
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  pendingRedemptions: RewardRedemption[];
  /** Full redeem ledger (pending + decided) for the tally subpage. */
  redemptions: RewardRedemption[];
  smartHomeDevices: SmartHomeDevice[];
  smartHomeScenes: SmartHomeScene[];
  storeRecommendations: StoreRecommendation[];
  inviteLinks: InviteLinks | null;
  askNova: (question: string) => Promise<NovaConversationAnswer>;
  askNovaVoice: (audioUri: string | null) => Promise<NovaConversationAnswer>;
  appendNovaTurn: (question: string, answer: string) => void;
  switchPersona: (memberId: string) => void;
  approveMember: (memberId: string) => Promise<void>;
  declineMember: (memberId: string) => Promise<void>;
  createHousehold: (input: CreateHouseholdInput) => Promise<void>;
  createProfile: (input: CreateProfileInput) => Promise<void>;
  createTask: (input: CreateTaskInput) => void;
  updateTask: (task: HouseholdTask) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  completeTask: (
    taskId: string,
    options?: { forAssignee?: string }
  ) => Promise<{ awarded: number; penalty: number; late: boolean; bonus?: number } | null>;
  submitTaskProof: (taskId: string, proofUri: string, options?: { forAssignee?: string }) => Promise<void>;
  approveTaskProof: (taskId: string, options?: { forAssignee?: string }) => Promise<void>;
  /** Admin: dock XP from someone who did not finish their share of a split task. */
  penalizeSplitAssignee: (taskId: string, assigneeName: string) => Promise<number | null>;
  /** Reassign overdue / unfinished work — new assignee earns XP on complete. */
  reassignTask: (taskId: string, newAssigneeName: string) => Promise<void>;
  /** Award daily streak once when today's tasks are all done. */
  awardDailyStreak: () => Promise<number | null>;
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
  suggestNovaItinerary: () => Promise<Itinerary | null>;
  advanceItineraryStop: (itineraryId: string, stopId: string) => Promise<void>;
  openStopInMaps: (itineraryId: string, stopId: string) => Promise<void>;
  reorderItineraryStops: (itineraryId: string, stopIds: string[]) => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  hydrateFromSession: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  suggestedNovaQuestions: readonly string[];
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
  updateNotificationPrefs: (prefs: Partial<NovaNotificationPrefs>) => void;
  /** Updates the current member’s personal look (follows persona switches). */
  updateAccentTheme: (themeId: AccentThemeId) => void;
  /** Owner/admin: household fallback theme for members without a personal pick. */
  updateHouseholdAccentTheme: (themeId: AccentThemeId) => void;
  accentTheme: AccentTheme;
  appearanceMode: AppearanceMode;
  updateAppearanceMode: (mode: AppearanceMode) => void;
  backgroundThemeId: BackgroundThemeId;
  updateBackgroundTheme: (themeId: BackgroundThemeId) => void;
  /** Resolved surface palette (light/dark + background pack). */
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
  runNovaMonitor: () => Promise<NovaMonitorAction[]>;
  requestRewardRedemption: (rewardId: string, note?: string) => Promise<void>;
  requestSpecialReward: (title: string, note?: string, cost?: number) => Promise<void>;
  createReward: (input: CreateRewardInput) => Promise<void>;
  archiveReward: (rewardId: string) => Promise<void>;
  approveRedemption: (redemptionId: string) => Promise<void>;
  rejectRedemption: (redemptionId: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: HouseholdRole) => Promise<void>;
  /** Create a shared-device profile (phone/tablet) that multiple people can use. */
  createSharedDevice: (name?: string) => Promise<HouseholdMember | null>;
  /** Link / unlink household people on a shared-device profile. */
  updateSharedDeviceLinks: (deviceId: string, memberIds: string[]) => Promise<void>;
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
  const [smartHomeDevices, setSmartHomeDevices] = useState<SmartHomeDevice[]>([]);
  const [smartHomeScenes, setSmartHomeScenes] = useState<SmartHomeScene[]>([]);
  const [storeRecommendations, setStoreRecommendations] = useState<StoreRecommendation[]>([]);
  const [inviteLinks, setInviteLinks] = useState<InviteLinks | null>(null);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [novaAskCount, setNovaAskCount] = useState(0);
  const [novaConversation, setNovaConversation] = useState<NovaChatMessage[]>([]);
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>('dark');
  const [backgroundThemeId, setBackgroundThemeId] = useState<BackgroundThemeId>(
    DEFAULT_BACKGROUND_THEME_ID
  );
  const [preferredMapsApp, setPreferredMapsApp] = useState<PreferredMapsApp>('auto');
  const initialMetrics = useMemo(() => calculateMetrics(mockHousehold), []);
  const [novaWeeklyBriefing, setNovaWeeklyBriefing] = useState<NovaWeeklyBriefing>(() =>
    novaService.generateWeeklyBriefing(mockHousehold, initialMetrics)
  );
  const [novaRecommendations, setNovaRecommendations] = useState<NovaRecommendation[]>(() =>
    novaService.generateRecommendations(mockHousehold, initialMetrics)
  );
  const [novaMonitorActions, setNovaMonitorActions] = useState<NovaMonitorAction[]>([]);

  const currentMember = useMemo(() => {
    if (activeMemberId) {
      return household.members.find((m) => m.id === activeMemberId) ?? household.members[0];
    }
    return household.members.find((m) => m.name === currentUser?.name) ?? household.members[0];
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
  const metrics = useMemo(() => calculateMetrics(household), [household]);
  const membersWithProgress = useMemo(
    () => household.members.map((member) => calculateMemberProgress(member, household.tasks)),
    [household.members, household.tasks]
  );
  const achievements = useMemo(
    () => evaluateAchievements(household, { novaAskCount, focusMemberName: currentMember?.name }),
    [household, novaAskCount, currentMember?.name]
  );
  const novaBriefing = useMemo(() => household.nova, [household.nova]);
  const visibleNotifications = useMemo(
    () => notifications.filter((item) => isNotificationVisibleToRole(item, currentMember?.role)),
    [currentMember?.role, notifications]
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
          const [prefs, themeId, savedRooms, avatarOverrides, appearance, bgTheme, mapsApp] =
            await Promise.all([
              loadNovaNotificationPrefs(mockHousehold.id),
              loadAccentThemeId(mockHousehold.id),
              loadHouseholdRooms(mockHousehold.id),
              loadMemberAvatarOverrides(mockHousehold.id),
              loadAppearanceMode(),
              loadBackgroundThemeId(mockHousehold.id),
              loadPreferredMapsApp(),
            ]);
          setAppearanceMode(appearance);
          setBackgroundThemeId(bgTheme);
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
        const [prefs, themeId, appearance, bgTheme, mapsApp] = await Promise.all([
          loadNovaNotificationPrefs(hydratedHousehold.id),
          loadAccentThemeId(hydratedHousehold.id),
          loadAppearanceMode(),
          loadBackgroundThemeId(hydratedHousehold.id, session.user.id),
          loadPreferredMapsApp(),
        ]);
        setAppearanceMode(appearance);
        setBackgroundThemeId(bgTheme);
        setPreferredMapsApp(mapsApp);
        setCurrentUser(session.user);
        setHousehold({
          ...hydratedHousehold,
          notificationPrefs: prefs,
          accentThemeId: themeId,
          rooms: hydratedHousehold.rooms?.length
            ? hydratedHousehold.rooms
            : DEFAULT_HOUSEHOLD_ROOMS.map((r) => ({ ...r })),
        });
        const history = await novaRepository.getConversationHistory(
          hydratedHousehold.id,
          session.user.id
        );
        setNovaConversation(history);
        setStoreRecommendations(buildStoreRecommendations(hydratedHousehold.id, hydratedHousehold.groceries));
        const [items, redemptions, devices, scenes, links] = await Promise.all([
          notificationsRepository.list(hydratedHousehold.id),
          rewardsRepository.getRedemptions(hydratedHousehold.id),
          smartHomeRepository.listDevices(hydratedHousehold.id),
          smartHomeRepository.listScenes(hydratedHousehold.id),
          hydratedHousehold.id
            ? householdRepository.getInviteLink(hydratedHousehold.id)
            : Promise.resolve(null),
        ]);
        setNotifications(items);
        setRedemptions(redemptions);
        setPendingRedemptions(redemptions.filter((item) => item.status === 'pending'));
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
    setHousehold(hydratedHousehold);
    await trackAnalytics(
      'auth.session_hydrate',
      { email: session.user.email },
      { householdId: hydratedHousehold.id, userId: session.user.id }
    );
    const [items, redemptions, devices, scenes] = await Promise.all([
      notificationsRepository.list(hydratedHousehold.id),
      rewardsRepository.getRedemptions(hydratedHousehold.id),
      smartHomeRepository.listDevices(hydratedHousehold.id),
      smartHomeRepository.listScenes(hydratedHousehold.id),
    ]);
    setNotifications(items);
    setRedemptions(redemptions);
    setPendingRedemptions(redemptions.filter((item) => item.status === 'pending'));
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
    const session = await authRepository.signUp(input);

    setCurrentUser(session.user);
    setHousehold(createEmptyHousehold(session.user));
    await trackAnalytics('auth.sign_up', { email: input.email }, { userId: session.user.id });
  };

  const forgotPassword = async (email: string) => {
    await authRepository.forgotPassword(email);
    await trackAnalytics('auth.forgot_password', { email }, analyticsContext);
  };

  const createProfile = async (input: CreateProfileInput) => {
    if (!currentUser) {
      return;
    }

    const user = await authRepository.createProfile(currentUser, input);
    setCurrentUser(user);
    setHousehold((current) => ({
      ...current,
      greetingName: user.name,
    }));
    await trackAnalytics('profile.created', { name: user.name }, { ...analyticsContext, userId: user.id });
  };

  const createHousehold = async (input: CreateHouseholdInput) => {
    if (!currentUser) {
      return;
    }

    const createdHousehold = await householdRepository.createHousehold(input, currentUser);
    const rooms =
      input.rooms && input.rooms.length > 0
        ? input.rooms.map((room) => ({ ...room }))
        : createdHousehold.rooms?.length
          ? createdHousehold.rooms
          : DEFAULT_HOUSEHOLD_ROOMS.map((room) => ({ ...room }));
    setHousehold({
      ...createdHousehold,
      rooms,
    });
    void saveHouseholdRooms(createdHousehold.id, rooms);
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
    if (joinedHousehold.id) {
      await novaNotifications.joinPending(pushNotification, {
        memberName: currentUser.name,
        inviteCode: input.inviteCode,
      });
    }
    await trackAnalytics('household.joined', { inviteCode: input.inviteCode }, { householdId: joinedHousehold.id, userId: currentUser.id });
  };

  const signOut = async () => {
    await authRepository.signOut();
    await trackAnalytics('auth.sign_out', {}, analyticsContext);
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

  const createTask = async (input: CreateTaskInput) => {
    const task = await taskRepository.createTask(household.id, input);
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
      return {
        ...current,
        tasks: [task, ...current.tasks],
        taskTemplates: nextTemplates,
      };
    });
    await trackAnalytics('task.created', { taskId: task.id }, analyticsContext);
  };

  const updateTask = async (task: HouseholdTask) => {
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

    let updated: HouseholdTask;
    if (isSplitTask(currentTask) && currentTask.shares) {
      updated = await taskRepository.updateTask({
        ...currentTask,
        shares: currentTask.shares.map((share) =>
          share.name === forAssignee
            ? { ...share, proofUri, proofStatus: 'submitted' }
            : share
        ),
        status: currentTask.status === 'Pending' ? 'In Progress' : currentTask.status,
      });
    } else {
      updated = await taskRepository.updateTask({
        ...currentTask,
        proofUri,
        proofStatus: 'submitted',
      });
    }

    setHousehold((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === taskId ? updated : item)),
    }));
    const prefs = household.notificationPrefs ?? DEFAULT_NOVA_NOTIFICATION_PREFS;
    const created = await novaNotifications.proofSubmitted(pushNotification, prefs, {
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
    const currentTask = household.tasks.find((item) => item.id === taskId);
    if (!currentTask) {
      return;
    }

    const forAssignee =
      options?.forAssignee?.trim() ||
      (isSplitTask(currentTask) ? currentMember?.name : undefined) ||
      currentTask.assignee;

    let updated: HouseholdTask;
    if (isSplitTask(currentTask) && currentTask.shares) {
      updated = await taskRepository.updateTask({
        ...currentTask,
        shares: currentTask.shares.map((share) =>
          share.name === forAssignee ? { ...share, proofStatus: 'approved' } : share
        ),
      });
    } else {
      updated = await taskRepository.updateTask({
        ...currentTask,
        proofStatus: 'approved',
      });
    }

    setHousehold((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === taskId ? updated : item)),
    }));
    const prefs = household.notificationPrefs ?? DEFAULT_NOVA_NOTIFICATION_PREFS;
    const assigneeMember = household.members.find((member) => member.name === forAssignee);
    await novaNotifications.proofApproved(pushNotification, prefs, {
      title: currentTask.title,
      taskId,
      audienceRoles: assigneeMember ? [assigneeMember.role] : undefined,
    });
    await trackAnalytics('task.proof_approved', { taskId, forAssignee }, analyticsContext);
  };

  const completeTask = async (taskId: string, options?: { forAssignee?: string }) => {
    const currentTask = household.tasks.find((item) => item.id === taskId);

    if (!currentTask || currentTask.status === 'Completed' || currentTask.status === 'Cancelled') {
      return null;
    }

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
      if (
        currentTask.proofRequired &&
        share.proofStatus !== 'submitted' &&
        share.proofStatus !== 'approved'
      ) {
        return null;
      }

      const late = isTaskLate(currentTask);
      const baseShare = splitShareXp(currentTask);
      const latePenalty = late ? Math.floor(baseShare * 0.25) : 0;
      const awarded = Math.max(0, baseShare - latePenalty);

      const nextShares = currentTask.shares.map((item) =>
        item.name === forAssignee
          ? { ...item, status: 'Completed' as const, awardedXp: awarded }
          : item
      );
      const draft: HouseholdTask = { ...currentTask, shares: nextShares };
      const everyoneDone = allSharesCompleted(draft);
      const settled = allSharesSettled(draft);
      const bonus = everyoneDone ? splitAllDoneBonus(currentTask) : 0;

      let nextTask: HouseholdTask = {
        ...draft,
        status: settled || everyoneDone ? 'Completed' : 'In Progress',
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

      let nextOccurrence: HouseholdTask | null = null;
      if (saved.status === 'Completed') {
        const spawned = spawnNextOccurrence(currentTask);
        if (spawned) {
          nextOccurrence = await taskRepository.createTask(household.id, {
            title: spawned.title,
            description: spawned.description,
            category: spawned.category,
            assignee: getTaskAssignees(spawned)[0] ?? spawned.assignee,
            assignees: isSplitTask(spawned) ? getTaskAssignees(spawned) : undefined,
            due: spawned.due,
            xp: spawned.xp,
            repeat: spawned.repeat,
            weight: spawned.weight,
            difficulty: spawned.difficulty,
            proofRequired: spawned.proofRequired,
            roomId: spawned.roomId,
            splitXpEach: spawned.splitXpEach,
            splitBonusXp: spawned.splitBonusXp,
            splitPenaltyXp: spawned.splitPenaltyXp,
          });
        }
      }

      setHousehold((current) => {
        const tasks = current.tasks.map((item) => (item.id === taskId ? saved : item));
        const members = current.members.map((member) => {
          if (member.name === forAssignee) {
            return {
              ...member,
              xp: member.xp + awarded + (everyoneDone ? bonus : 0),
              weekXp: (member.weekXp ?? 0) + awarded + (everyoneDone ? bonus : 0),
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
        return {
          ...current,
          members,
          tasks: nextOccurrence ? [nextOccurrence, ...tasks] : tasks,
        };
      });

      const prefs = household.notificationPrefs ?? DEFAULT_NOVA_NOTIFICATION_PREFS;
      await novaNotifications.taskCompleted(pushNotification, prefs, {
        title: currentTask.title,
        assignee: forAssignee,
        awardedXp: awarded + (everyoneDone ? bonus : 0),
        penalty: latePenalty,
        late,
        taskId,
      });
      await trackAnalytics(
        'task.share_completed',
        { taskId, forAssignee, awarded, bonus, everyoneDone },
        analyticsContext
      );
      return { awarded, penalty: latePenalty, late, bonus: everyoneDone ? bonus : 0 };
    }

    // --- Single-assignee task ---
    if (currentTask.proofRequired && currentTask.proofStatus !== 'submitted' && currentTask.proofStatus !== 'approved') {
      return null;
    }

    const { awarded, penalty, late } = resolveCompletionXp(currentTask);
    const completedTask = await taskRepository.completeTask(currentTask, household.id);
    const spawned = spawnNextOccurrence(currentTask);
    let nextOccurrence: HouseholdTask | null = null;
    if (spawned) {
      nextOccurrence = await taskRepository.createTask(household.id, {
        title: spawned.title,
        description: spawned.description,
        category: spawned.category,
        assignee: getTaskAssignees(spawned)[0] ?? spawned.assignee,
        assignees: isSplitTask(spawned) ? getTaskAssignees(spawned) : undefined,
        due: spawned.due,
        xp: spawned.xp,
        repeat: spawned.repeat,
        weight: spawned.weight,
        difficulty: spawned.difficulty,
        proofRequired: spawned.proofRequired,
        roomId: spawned.roomId,
      });
    }

    setHousehold((current) => {
      const task = current.tasks.find((item) => item.id === taskId);

      if (!task || task.status === 'Completed') {
        return current;
      }

      const tasks = current.tasks.map((item) => (item.id === taskId ? completedTask : item));
      return {
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
        tasks: nextOccurrence ? [nextOccurrence, ...tasks] : tasks,
      };
    });

    const prefs = household.notificationPrefs ?? DEFAULT_NOVA_NOTIFICATION_PREFS;
    await novaNotifications.taskCompleted(pushNotification, prefs, {
      title: currentTask.title,
      assignee: currentTask.assignee,
      awardedXp: awarded,
      penalty,
      late,
      taskId,
    });
    const nextMetrics = calculateMetrics({
      ...household,
      tasks: household.tasks.map((item) => (item.id === taskId ? completedTask : item)),
    });
    await persistHouseholdScore(household.id, nextMetrics);
    await trackAnalytics('task.completed', { taskId, awarded, late }, analyticsContext);
    return { awarded, penalty, late };
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

    const dock = splitPenaltyAmount(currentTask);
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
    const { awardDailyStreakIfNeeded } = await import('@/lib/streaks/daily-streak');
    const result = await awardDailyStreakIfNeeded({
      householdId: household.id,
      memberId: currentMember.id,
      currentStreak: currentMember.streak ?? 0,
    });
    if (!result.awarded) return null;
    setHousehold((current) => ({
      ...current,
      members: current.members.map((member) =>
        member.id === currentMember.id ? { ...member, streak: result.streak } : member
      ),
    }));
    await trackAnalytics('streak.daily_awarded', { streak: result.streak }, analyticsContext);
    return result.streak;
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

    if (scope === 'this' && currentTask.repeat !== 'None') {
      const spawned = spawnNextOccurrence({ ...currentTask, status: 'Pending' });
      if (spawned) {
        const nextOccurrence = await taskRepository.createTask(household.id, {
          title: spawned.title,
          description: spawned.description,
          category: spawned.category,
          assignee: spawned.assignee,
          due: spawned.due,
          xp: spawned.xp,
          weight: spawned.weight,
          difficulty: spawned.difficulty,
          proofRequired: spawned.proofRequired,
          repeat: spawned.repeat,
          roomId: spawned.roomId,
        });
        nextTasks = [nextOccurrence, ...nextTasks];
      }
    }

    setHousehold((current) => ({ ...current, tasks: nextTasks }));
    await pushNotification({
      title: 'Nova · Task cancelled',
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
    const grocery = await groceryRepository.addGroceryItem(household.id, {
      ...input,
      storeId: input.storeId ?? household.preferredStoreId,
      requestedBy: input.requestedBy ?? currentMember?.name,
    });
    setHousehold((current) => ({
      ...current,
      groceries: [grocery, ...current.groceries],
    }));
    const prefs = household.notificationPrefs ?? DEFAULT_NOVA_NOTIFICATION_PREFS;
    await novaNotifications.groceryAdded(pushNotification, prefs, {
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

  const suggestNovaItinerary = async () => {
    const suggestion = suggestItineraryFromHousehold(household);
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
    const prefs = household.notificationPrefs ?? DEFAULT_NOVA_NOTIFICATION_PREFS;
    await novaNotifications.itineraryNextLeg(pushNotification, prefs, {
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

  const updateNotificationPrefs = (prefs: Partial<NovaNotificationPrefs>) => {
    setHousehold((current) => {
      const next = {
        ...(current.notificationPrefs ?? DEFAULT_NOVA_NOTIFICATION_PREFS),
        ...prefs,
      };
      void saveNovaNotificationPrefs(current.id, next);
      return {
        ...current,
        notificationPrefs: next,
      };
    });
  };

  const accentTheme = useMemo(
    () =>
      getAccentTheme(
        currentMember?.accentThemeId ?? household.accentThemeId ?? DEFAULT_ACCENT_THEME_ID
      ),
    [currentMember?.accentThemeId, household.accentThemeId]
  );

  const updateAccentTheme = (themeId: AccentThemeId) => {
    const memberId = currentMember?.id;
    if (!memberId) {
      setHousehold((current) => ({ ...current, accentThemeId: themeId }));
      void saveAccentThemeId(household.id, themeId);
      return;
    }
    setHousehold((current) => ({
      ...current,
      members: current.members.map((member) =>
        member.id === memberId ? { ...member, accentThemeId: themeId } : member
      ),
    }));
    void saveMemberAccentThemeId(household.id, memberId, themeId);
  };

  const updateHouseholdAccentTheme = (themeId: AccentThemeId) => {
    if (!permissions.canManageHousehold) {
      return;
    }
    setHousehold((current) => ({ ...current, accentThemeId: themeId }));
    void saveAccentThemeId(household.id, themeId);
  };

  const updateAppearanceMode = (mode: AppearanceMode) => {
    setAppearanceMode(mode);
    void saveAppearanceMode(mode);
  };

  const updateBackgroundTheme = (themeId: BackgroundThemeId) => {
    setBackgroundThemeId(themeId);
    void saveBackgroundThemeId(household.id, currentMember?.id, themeId);
  };

  const updatePreferredMapsApp = (app: PreferredMapsApp) => {
    setPreferredMapsApp(app);
    void savePreferredMapsApp(app);
  };

  const orbitPalette = useMemo(
    () => resolveOrbitPalette(appearanceMode, backgroundThemeId),
    [appearanceMode, backgroundThemeId]
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

  const runNovaMonitor = useCallback(async () => {
    const prefs = household.notificationPrefs ?? DEFAULT_NOVA_NOTIFICATION_PREFS;
    const result = runMonitorPass(household, metrics, prefs);

    setNovaMonitorActions(result.actions);
    setNovaRecommendations((current) => {
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

    await trackAnalytics('nova.monitor_pass', { actions: result.actions.length }, analyticsContext);
    return result.actions;
  }, [analyticsContext, household, metrics]);

  // Initial Monitor Agent pass once household + metrics are ready (mock-first).
  useEffect(() => {
    if (isLoading || !household.id || novaMonitorActions.length > 0) {
      return;
    }
    const timer = setTimeout(() => {
      void runNovaMonitor().catch((error) => console.warn('Nova monitor pass skipped', error));
    }, 800);
    return () => clearTimeout(timer);
  }, [household.id, isLoading, novaMonitorActions.length, runNovaMonitor]);

  const askNova = async (question: string) => {
    setNovaAskCount((count) => count + 1);
    const answer = await novaRepository.askNova(
      question,
      household,
      metrics,
      novaConversation,
      currentUser?.id
    );
    setNovaConversation((current) => [
      ...current,
      { role: 'user', content: answer.question },
      { role: 'assistant', content: answer.answer },
    ]);
    await trackAnalytics('nova.asked', { questionLength: question.length }, analyticsContext);
    return answer;
  };

  const askNovaVoice = async (audioUri: string | null) => {
    const { transcribeAndAskNova } = await import('@/lib/voice/nova-voice');
    setNovaAskCount((count) => count + 1);
    const answer = await transcribeAndAskNova(audioUri, household, metrics);
    setNovaConversation((current) => [
      ...current,
      { role: 'user', content: answer.question },
      { role: 'assistant', content: answer.answer },
    ]);
    await novaRepository.appendConversationTurn(
      household.id,
      currentUser?.id ?? null,
      answer.question,
      answer.answer
    );
    await trackAnalytics('nova.voice_asked', {}, analyticsContext);
    return answer;
  };

  const appendNovaTurn = (question: string, answer: string) => {
    setNovaAskCount((count) => count + 1);
    setNovaConversation((current) => [
      ...current,
      { role: 'user', content: question },
      { role: 'assistant', content: answer },
    ]);
    void novaRepository.appendConversationTurn(
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
    setCurrentUser((prev) =>
      prev
        ? {
            ...prev,
            name: target.name,
            avatar: target.avatar,
            profileComplete: true,
          }
        : {
            id: `persona-${target.id}`,
            email: `${target.name.toLowerCase()}@orbit.test`,
            name: target.name,
            avatar: target.avatar,
            profileComplete: true,
          }
    );
    setHousehold((current) => ({ ...current, greetingName: target.name }));
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

    const reward = household.rewards.find((item) => item.id === rewardId);
    const redemption = await rewardsRepository.requestRedemption({
      householdId: household.id,
      rewardId,
      memberId: currentMember.id,
      note,
    });
    setPendingRedemptions((current) => [redemption, ...current.filter((item) => item.id !== redemption.id)]);
    setRedemptions((current) => [redemption, ...current.filter((item) => item.id !== redemption.id)]);
    const prefs = household.notificationPrefs ?? DEFAULT_NOVA_NOTIFICATION_PREFS;
    await novaNotifications.rewardRequested(pushNotification, prefs, {
      title: reward?.title ?? 'a reward',
      memberName: currentMember.name,
      redemptionId: redemption.id,
    });
    await trackAnalytics('reward.redemption_requested', { rewardId }, analyticsContext);
  };

  const requestSpecialReward = async (title: string, note?: string, cost = 150) => {
    if (!household.id || !currentMember) {
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

  const createReward = async (input: CreateRewardInput) => {
    if (!permissions.canManageHousehold) {
      return;
    }
    const reward = await rewardsRepository.createReward(household.id, {
      ...input,
      origin: input.origin ?? 'minted',
      createdByMemberId: input.createdByMemberId ?? currentMember?.id,
      createdByName: input.createdByName ?? currentMember?.name,
    });
    setHousehold((current) => ({
      ...current,
      rewards: [reward, ...current.rewards.filter((item) => item.id !== reward.id)],
    }));
    await trackAnalytics('reward.created', { rewardId: reward.id }, analyticsContext);
  };

  const archiveReward = async (rewardId: string) => {
    await rewardsRepository.archiveReward(rewardId);
    setHousehold((current) => ({
      ...current,
      rewards: current.rewards.filter((item) => item.id !== rewardId),
    }));
    await trackAnalytics('reward.archived', { rewardId }, analyticsContext);
  };

  const approveRedemption = async (redemptionId: string) => {
    const pending = pendingRedemptions.find((item) => item.id === redemptionId);
    const reward = household.rewards.find((item) => item.id === pending?.rewardId);
    const updated = await rewardsRepository.approveRedemption(redemptionId);
    setPendingRedemptions((current) => current.filter((item) => item.id !== redemptionId));
    setRedemptions((current) =>
      current.map((item) => (item.id === redemptionId ? updated : item))
    );
    if (pending && reward) {
      setHousehold((current) => ({
        ...current,
        members: current.members.map((member) =>
          member.id === pending.memberId
            ? { ...member, xp: Math.max(0, member.xp - reward.cost) }
            : member
        ),
      }));
    }
    await reloadHouseholdDomains();
    const prefs = household.notificationPrefs ?? DEFAULT_NOVA_NOTIFICATION_PREFS;
    await novaNotifications.rewardApproved(pushNotification, prefs, {
      title: reward?.title ?? 'Reward',
      redemptionId,
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
      title: 'Nova · Tasks split',
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

    async function refreshNova() {
      const [briefing, weeklyBriefing, recommendations] = await Promise.all([
        novaRepository.getNovaBriefing(household, metrics),
        novaRepository.getWeeklyBriefing(household, metrics),
        novaRepository.getRecommendations(household, metrics),
      ]);
      if (isMounted) {
        setHousehold((current) => ({
          ...current,
          nova: briefing,
        }));
        setNovaWeeklyBriefing(weeklyBriefing);
        setNovaRecommendations(recommendations);
      }
    }

    refreshNova().catch((error) => {
      console.warn('Failed to refresh Nova briefing', error);
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
        nova: novaBriefing,
      },
      hasHousehold,
      isPendingMember,
      isLoading,
      isSignedIn: Boolean(currentUser),
      metrics,
      membersWithProgress,
      achievements,
      novaAskCount,
      novaConversation,
      novaBriefing,
      novaRecommendations,
      novaMonitorActions,
      novaWeeklyBriefing,
      permissions,
      notifications: visibleNotifications,
      unreadNotificationCount,
      pendingRedemptions,
      redemptions,
      smartHomeDevices,
      smartHomeScenes,
      storeRecommendations,
      inviteLinks,
      preferredStore: getPreferredStore(household.preferredStoreId),
      canAddGroceryWishlist:
        permissions.canManageGroceries ||
        (currentMember?.role === 'child' && (currentMember?.xp ?? 0) >= CHILD_GROCERY_WISHLIST_XP),
      askNova,
      askNovaVoice,
      appendNovaTurn,
      switchPersona,
      approveMember,
      declineMember,
      createHousehold,
      createProfile,
      createTask,
      updateTask,
      forgotPassword,
      completeTask,
      submitTaskProof,
      approveTaskProof,
      penalizeSplitAssignee,
      reassignTask,
      awardDailyStreak,
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
      suggestNovaItinerary,
      advanceItineraryStop,
      openStopInMaps,
      reorderItineraryStops,
      signIn,
      hydrateFromSession,
      signOut,
      signUp,
      suggestedNovaQuestions,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      pushNotification,
      updateNotificationPrefs,
      updateAccentTheme,
      updateHouseholdAccentTheme,
      accentTheme,
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
      runNovaMonitor,
      requestRewardRedemption,
      requestSpecialReward,
      createReward,
      archiveReward,
      approveRedemption,
      rejectRedemption,
      updateMemberRole,
      createSharedDevice,
      updateSharedDeviceLinks,
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
      novaAskCount,
      novaConversation,
      novaBriefing,
      novaRecommendations,
      novaMonitorActions,
      novaWeeklyBriefing,
      permissions,
      visibleNotifications,
      unreadNotificationCount,
      pendingRedemptions,
      redemptions,
      smartHomeDevices,
      smartHomeScenes,
      storeRecommendations,
      inviteLinks,
      refreshNotifications,
      refreshStoreRecommendations,
      refreshInviteLinks,
      refreshSmartHome,
      runNovaMonitor,
      accentTheme,
      updateAccentTheme,
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
  const initialHousehold: HouseholdSnapshot = {
    ...baseHousehold,
    members,
    badges,
    events,
    groceries,
    rewards,
    tasks,
    itineraries: itineraries.length > 0 ? itineraries : baseHousehold.itineraries ?? [],
    taskTemplates: baseHousehold.taskTemplates ?? [],
    notificationPrefs: baseHousehold.notificationPrefs ?? DEFAULT_NOVA_NOTIFICATION_PREFS,
    preferredStoreId: baseHousehold.preferredStoreId ?? 'store-freshmart',
    accentThemeId: themeId || baseHousehold.accentThemeId || DEFAULT_ACCENT_THEME_ID,
    rooms:
      savedRooms?.length
        ? savedRooms
        : baseHousehold.rooms?.length
          ? baseHousehold.rooms
          : DEFAULT_HOUSEHOLD_ROOMS.map((room) => ({ ...room })),
  };
  const briefing = await novaRepository.getNovaBriefing(initialHousehold, calculateMetrics(initialHousehold));

  return {
    ...initialHousehold,
    nova: briefing,
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

  return {
    taskCompletionRate,
    groceryReadiness,
    calendarCoverage,
    momentum: Math.round(taskCompletionRate * 0.45 + groceryReadiness * 0.35 + calendarCoverage * 0.2),
    openTasks: household.tasks.filter((task) => isOpenTask(task)).length,
    missingGroceries: household.groceries.filter((item) => item.status === 'Missing').length,
    purchasedGroceries: household.groceries.filter((item) => item.status === 'Purchased').length,
    upcomingEvents: countUpcomingSoon(household.events),
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

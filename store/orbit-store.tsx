import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { dataMode } from '@/config/data-mode';
import { createEmptyHousehold, mockHousehold } from '@/data/mock-household';
import { trackAnalytics } from '@/lib/analytics';
import { getLevel, LEVELS, MEMBER_ACCENTS, xpProgress } from '@/lib/game-levels';
import { getLocationAwareGrocerySuggestions } from '@/lib/grocery/location-suggestions';
import { buildStoreRecommendations } from '@/lib/grocery/recommendations';
import { registerForPushNotifications } from '@/lib/notifications/push';
import { getPermissionsForRole, type HouseholdPermissions } from '@/lib/permissions';
import { subscribeHouseholdRealtime } from '@/lib/realtime/household-realtime';
import {
  authRepository,
  calendarRepository,
  groceryRepository,
  householdRepository,
  notificationsRepository,
  novaRepository,
  rewardsRepository,
  smartHomeRepository,
  taskRepository,
} from '@/repositories';
import { novaService, suggestedNovaQuestions } from '@/services/nova-service';
import type {
  AuthSession,
  CreateEventInput,
  CreateGroceryInput,
  CreateHouseholdInput,
  CreateProfileInput,
  CreateTaskInput,
  HouseholdMember,
  HouseholdRole,
  HouseholdSnapshot,
  InviteLinks,
  JoinHouseholdInput,
  MemberProgress,
  NotificationItem,
  NovaBriefing,
  NovaConversationAnswer,
  NovaRecommendation,
  NovaWeeklyBriefing,
  OrbitUser,
  OrbitMetrics,
  RewardRedemption,
  SignInInput,
  SignUpInput,
  SmartHomeDevice,
  SmartHomeScene,
  StoreRecommendation,
} from '@/types/orbit';

type OrbitContextValue = {
  currentUser: OrbitUser | null;
  household: HouseholdSnapshot;
  hasHousehold: boolean;
  isLoading: boolean;
  isSignedIn: boolean;
  metrics: OrbitMetrics;
  membersWithProgress: MemberProgress[];
  novaBriefing: NovaBriefing;
  novaRecommendations: NovaRecommendation[];
  novaWeeklyBriefing: NovaWeeklyBriefing;
  permissions: HouseholdPermissions;
  notifications: NotificationItem[];
  pendingRedemptions: RewardRedemption[];
  smartHomeDevices: SmartHomeDevice[];
  smartHomeScenes: SmartHomeScene[];
  storeRecommendations: StoreRecommendation[];
  inviteLinks: InviteLinks | null;
  askNova: (question: string) => Promise<NovaConversationAnswer>;
  createHousehold: (input: CreateHouseholdInput) => Promise<void>;
  createProfile: (input: CreateProfileInput) => Promise<void>;
  createTask: (input: CreateTaskInput) => void;
  forgotPassword: (email: string) => Promise<void>;
  completeTask: (taskId: string) => void;
  addMissingGrocery: (input: CreateGroceryInput) => void;
  joinHousehold: (input: JoinHouseholdInput) => Promise<void>;
  markGroceryPurchased: (itemId: string) => void;
  createEvent: (input: CreateEventInput) => void;
  signIn: (input: SignInInput) => Promise<void>;
  hydrateFromSession: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  suggestedNovaQuestions: readonly string[];
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  requestRewardRedemption: (rewardId: string, note?: string) => Promise<void>;
  approveRedemption: (redemptionId: string) => Promise<void>;
  rejectRedemption: (redemptionId: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: HouseholdRole) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  exportUserData: () => Promise<string>;
  toggleSmartDevice: (deviceId: string) => Promise<void>;
  activateSmartScene: (sceneId: string) => Promise<void>;
  refreshStoreRecommendations: () => Promise<void>;
  refreshInviteLinks: () => Promise<InviteLinks | null>;
  refreshSmartHome: () => Promise<void>;
};

const OrbitContext = createContext<OrbitContextValue | null>(null);

export function OrbitProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<OrbitUser | null>(null);
  const [household, setHousehold] = useState<HouseholdSnapshot>(mockHousehold);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pendingRedemptions, setPendingRedemptions] = useState<RewardRedemption[]>([]);
  const [smartHomeDevices, setSmartHomeDevices] = useState<SmartHomeDevice[]>([]);
  const [smartHomeScenes, setSmartHomeScenes] = useState<SmartHomeScene[]>([]);
  const [storeRecommendations, setStoreRecommendations] = useState<StoreRecommendation[]>([]);
  const [inviteLinks, setInviteLinks] = useState<InviteLinks | null>(null);
  const initialMetrics = useMemo(() => calculateMetrics(mockHousehold), []);
  const [novaWeeklyBriefing, setNovaWeeklyBriefing] = useState<NovaWeeklyBriefing>(() =>
    novaService.generateWeeklyBriefing(mockHousehold, initialMetrics)
  );
  const [novaRecommendations, setNovaRecommendations] = useState<NovaRecommendation[]>(() =>
    novaService.generateRecommendations(mockHousehold, initialMetrics)
  );

  const currentMember = useMemo(
    () => household.members.find((member) => member.name === currentUser?.name) ?? household.members[0],
    [currentUser?.name, household.members]
  );
  const hasHousehold = Boolean(currentUser && household.id);
  const permissions = useMemo(
    () => getPermissionsForRole(currentMember?.role ?? 'guest'),
    [currentMember?.role]
  );
  const metrics = useMemo(() => calculateMetrics(household), [household]);
  const membersWithProgress = useMemo(
    () => household.members.map((member) => calculateMemberProgress(member)),
    [household.members]
  );
  const novaBriefing = useMemo(() => household.nova, [household.nova]);

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
      rewardsRepository.getRedemptions(hydratedHousehold.id).then((items) =>
        setPendingRedemptions(items.filter((item) => item.status === 'pending'))
      ),
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
      const hydratedHousehold = await hydrateHousehold(baseHousehold);

      if (isMounted) {
        setCurrentUser(session.user);
        setHousehold(hydratedHousehold);
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
    setHousehold(createdHousehold);
    if (createdHousehold.id) {
      const links = await householdRepository.getInviteLink(createdHousehold.id);
      setInviteLinks(links);
    }
    await trackAnalytics('household.created', { name: input.name }, { householdId: createdHousehold.id, userId: currentUser.id });
  };

  const joinHousehold = async (input: JoinHouseholdInput) => {
    if (!currentUser) {
      return;
    }

    const joinedHousehold = await householdRepository.joinHousehold(input, currentUser);
    setHousehold(joinedHousehold);
    await trackAnalytics('household.joined', { inviteCode: input.inviteCode }, { householdId: joinedHousehold.id, userId: currentUser.id });
  };

  const signOut = async () => {
    await authRepository.signOut();
    await trackAnalytics('auth.sign_out', {}, analyticsContext);
    setCurrentUser(null);
    setHousehold(mockHousehold);
    setPendingRedemptions([]);
    setInviteLinks(null);
  };

  const createTask = async (input: CreateTaskInput) => {
    const task = await taskRepository.createTask(household.id, input);
    setHousehold((current) => ({
      ...current,
      tasks: [task, ...current.tasks],
    }));
    await trackAnalytics('task.created', { taskId: task.id }, analyticsContext);
  };

  const completeTask = async (taskId: string) => {
    const currentTask = household.tasks.find((item) => item.id === taskId);

    if (!currentTask || currentTask.status === 'Completed') {
      return;
    }

    const completedTask = await taskRepository.completeTask(currentTask, household.id);

    setHousehold((current) => {
      const task = current.tasks.find((item) => item.id === taskId);

      if (!task || task.status === 'Completed') {
        return current;
      }

      return {
        ...current,
        members: current.members.map((member) =>
          member.name === task.assignee ? { ...member, xp: member.xp + task.xp } : member
        ),
        tasks: current.tasks.map((item) => (item.id === taskId ? completedTask : item)),
      };
    });
    await trackAnalytics('task.completed', { taskId }, analyticsContext);
  };

  const addMissingGrocery = async (input: CreateGroceryInput) => {
    const grocery = await groceryRepository.addGroceryItem(household.id, input);
    setHousehold((current) => ({
      ...current,
      groceries: [grocery, ...current.groceries],
    }));
    await trackAnalytics('grocery.added', { groceryId: grocery.id }, analyticsContext);
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
  };

  const createEvent = async (input: CreateEventInput) => {
    const event = await calendarRepository.createEvent(household.id, input);
    setHousehold((current) => ({
      ...current,
      events: [event, ...current.events],
    }));
    await trackAnalytics('event.created', { eventId: event.id }, analyticsContext);
  };

  const askNova = async (question: string) => {
    const answer = await novaRepository.askNova(question, household, metrics);
    await trackAnalytics('nova.asked', { questionLength: question.length }, analyticsContext);
    return answer;
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

    const redemption = await rewardsRepository.requestRedemption({
      householdId: household.id,
      rewardId,
      memberId: currentMember.id,
      note,
    });
    setPendingRedemptions((current) => [redemption, ...current.filter((item) => item.id !== redemption.id)]);
    await trackAnalytics('reward.redemption_requested', { rewardId }, analyticsContext);
  };

  const approveRedemption = async (redemptionId: string) => {
    const updated = await rewardsRepository.approveRedemption(redemptionId);
    setPendingRedemptions((current) => current.filter((item) => item.id !== redemptionId));
    await trackAnalytics('reward.redemption_approved', { redemptionId, status: updated.status }, analyticsContext);
  };

  const rejectRedemption = async (redemptionId: string) => {
    const updated = await rewardsRepository.rejectRedemption(redemptionId);
    setPendingRedemptions((current) => current.filter((item) => item.id !== redemptionId));
    await trackAnalytics('reward.redemption_rejected', { redemptionId, status: updated.status }, analyticsContext);
  };

  const updateMemberRole = async (memberId: string, role: HouseholdRole) => {
    const member = household.members.find((item) => item.id === memberId);
    if (!member) {
      return;
    }

    const updated = await householdRepository.updateMemberRole(member, role);
    setHousehold((current) => ({
      ...current,
      members: current.members.map((item) => (item.id === memberId ? updated : item)),
    }));
    await trackAnalytics('member.role_updated', { memberId, role }, analyticsContext);
  };

  const removeMember = async (memberId: string) => {
    await householdRepository.removeMember(memberId);
    setHousehold((current) => ({
      ...current,
      members: current.members.filter((item) => item.id !== memberId),
    }));
    await trackAnalytics('member.removed', { memberId }, analyticsContext);
  };

  const deleteAccount = async () => {
    await authRepository.deleteAccount();
    await trackAnalytics('auth.account_deleted', {}, analyticsContext);
    setCurrentUser(null);
    setHousehold(mockHousehold);
    setPendingRedemptions([]);
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
      household: {
        ...household,
        momentum: metrics.momentum,
        completionRate: metrics.taskCompletionRate,
        missingGroceries: metrics.missingGroceries,
        upcomingEvents: metrics.upcomingEvents,
        nova: novaBriefing,
      },
      hasHousehold,
      isLoading,
      isSignedIn: Boolean(currentUser),
      metrics,
      membersWithProgress,
      novaBriefing,
      novaRecommendations,
      novaWeeklyBriefing,
      permissions,
      notifications,
      pendingRedemptions,
      smartHomeDevices,
      smartHomeScenes,
      storeRecommendations,
      inviteLinks,
      askNova,
      createHousehold,
      createProfile,
      createTask,
      forgotPassword,
      completeTask,
      addMissingGrocery,
      joinHousehold,
      markGroceryPurchased,
      createEvent,
      signIn,
      hydrateFromSession,
      signOut,
      signUp,
      suggestedNovaQuestions,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      requestRewardRedemption,
      approveRedemption,
      rejectRedemption,
      updateMemberRole,
      removeMember,
      deleteAccount,
      exportUserData,
      toggleSmartDevice,
      activateSmartScene,
      refreshStoreRecommendations,
      refreshInviteLinks,
      refreshSmartHome,
    }),
    [
      currentUser,
      household,
      hasHousehold,
      isLoading,
      metrics,
      membersWithProgress,
      novaBriefing,
      novaRecommendations,
      novaWeeklyBriefing,
      permissions,
      notifications,
      pendingRedemptions,
      smartHomeDevices,
      smartHomeScenes,
      storeRecommendations,
      inviteLinks,
      refreshNotifications,
      refreshStoreRecommendations,
      refreshInviteLinks,
      refreshSmartHome,
    ]
  );

  return <OrbitContext.Provider value={value}>{children}</OrbitContext.Provider>;
}

async function hydrateHousehold(baseHousehold: HouseholdSnapshot): Promise<HouseholdSnapshot> {
  const householdId = baseHousehold.id;
  const [tasks, groceries, events, rewards, badges] = await Promise.all([
    taskRepository.getTasks(householdId),
    groceryRepository.getGroceries(householdId),
    calendarRepository.getEvents(householdId),
    rewardsRepository.getRewards(householdId),
    rewardsRepository.getBadges(householdId),
  ]);
  const initialHousehold = {
    ...baseHousehold,
    badges,
    events,
    groceries,
    rewards,
    tasks,
  };
  const briefing = await novaRepository.getNovaBriefing(initialHousehold, calculateMetrics(initialHousehold));

  return {
    ...initialHousehold,
    nova: briefing,
  };
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
    openTasks: household.tasks.filter((task) => task.status !== 'Completed').length,
    missingGroceries: household.groceries.filter((item) => item.status === 'Missing').length,
    purchasedGroceries: household.groceries.filter((item) => item.status === 'Purchased').length,
    upcomingEvents: household.events.length,
  };
}

function calculateMemberProgress(member: HouseholdMember): MemberProgress {
  const gameLevel = getLevel(member.xp);
  const levelIndex = LEVELS.findIndex((level) => level.name === gameLevel.name);
  const level = levelIndex >= 0 ? levelIndex + 1 : 1;
  const levelProgress = xpProgress(member.xp);
  const nextLevelXp = gameLevel.maxXP + 1;
  const accent = MEMBER_ACCENTS[member.name] ?? { color: '#38BDF8', emoji: member.avatar };

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
    avatarEmoji: accent.emoji,
  };
}

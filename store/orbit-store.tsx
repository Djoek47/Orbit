import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { createEmptyHousehold, mockHousehold } from '@/data/mock-household';
import { getLevel, LEVELS, MEMBER_ACCENTS, xpProgress } from '@/lib/game-levels';
import { getPermissionsForRole, type HouseholdPermissions } from '@/lib/permissions';
import {
  authRepository,
  calendarRepository,
  groceryRepository,
  householdRepository,
  novaRepository,
  rewardsRepository,
  taskRepository,
} from '@/repositories';
import { novaService, suggestedNovaQuestions } from '@/services/nova-service';
import type {
  CreateEventInput,
  CreateGroceryInput,
  CreateHouseholdInput,
  CreateProfileInput,
  CreateTaskInput,
  HouseholdMember,
  HouseholdSnapshot,
  JoinHouseholdInput,
  MemberProgress,
  NovaBriefing,
  NovaConversationAnswer,
  NovaRecommendation,
  NovaWeeklyBriefing,
  OrbitUser,
  OrbitMetrics,
  SignInInput,
  SignUpInput,
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
  signOut: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  suggestedNovaQuestions: readonly string[];
};

const OrbitContext = createContext<OrbitContextValue | null>(null);

export function OrbitProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<OrbitUser | null>(null);
  const [household, setHousehold] = useState<HouseholdSnapshot>(mockHousehold);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      const session = await authRepository.getCurrentSession();

      if (!session) {
        setIsLoading(false);
        return;
      }

      const baseHousehold = await householdRepository.getHousehold();
      const hydratedHousehold = await hydrateHousehold(baseHousehold);

      if (isMounted) {
        setCurrentUser(session.user);
        setHousehold(hydratedHousehold);
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

  const signIn = async (input: SignInInput) => {
    const session = await authRepository.signIn(input);
    const baseHousehold = await householdRepository.getHousehold();
    const hydratedHousehold = await hydrateHousehold({
      ...baseHousehold,
      greetingName: session.user.name,
    });

    setCurrentUser(session.user);
    setHousehold(hydratedHousehold);
  };

  const signUp = async (input: SignUpInput) => {
    const session = await authRepository.signUp(input);

    setCurrentUser(session.user);
    setHousehold(createEmptyHousehold(session.user));
  };

  const forgotPassword = async (email: string) => {
    await authRepository.forgotPassword(email);
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
  };

  const createHousehold = async (input: CreateHouseholdInput) => {
    if (!currentUser) {
      return;
    }

    const createdHousehold = await householdRepository.createHousehold(input, currentUser);
    setHousehold(createdHousehold);
  };

  const joinHousehold = async (input: JoinHouseholdInput) => {
    if (!currentUser) {
      return;
    }

    const joinedHousehold = await householdRepository.joinHousehold(input, currentUser);
    setHousehold(joinedHousehold);
  };

  const signOut = async () => {
    await authRepository.signOut();
    setCurrentUser(null);
    setHousehold(mockHousehold);
  };

  const createTask = async (input: CreateTaskInput) => {
    const task = await taskRepository.createTask(input);
    setHousehold((current) => ({
      ...current,
      tasks: [task, ...current.tasks],
    }));
  };

  const completeTask = async (taskId: string) => {
    const currentTask = household.tasks.find((item) => item.id === taskId);

    if (!currentTask || currentTask.status === 'Completed') {
      return;
    }

    const completedTask = await taskRepository.completeTask(currentTask);

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
  };

  const addMissingGrocery = async (input: CreateGroceryInput) => {
    const grocery = await groceryRepository.addGroceryItem(input);
    setHousehold((current) => ({
      ...current,
      groceries: [grocery, ...current.groceries],
    }));
  };

  const markGroceryPurchased = async (itemId: string) => {
    const currentItem = household.groceries.find((item) => item.id === itemId);

    if (!currentItem) {
      return;
    }

    const purchasedItem = await groceryRepository.markGroceryPurchased(currentItem);

    setHousehold((current) => ({
      ...current,
      groceries: current.groceries.map((item) => (item.id === itemId ? purchasedItem : item)),
    }));
  };

  const createEvent = async (input: CreateEventInput) => {
    const event = await calendarRepository.createEvent(input);
    setHousehold((current) => ({
      ...current,
      events: [event, ...current.events],
    }));
  };

  const askNova = async (question: string) => novaRepository.askNova(question, household, metrics);

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
      signOut,
      signUp,
      suggestedNovaQuestions,
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
    ]
  );

  return <OrbitContext.Provider value={value}>{children}</OrbitContext.Provider>;
}

async function hydrateHousehold(baseHousehold: HouseholdSnapshot): Promise<HouseholdSnapshot> {
  const [tasks, groceries, events, rewards, badges] = await Promise.all([
    taskRepository.getTasks(baseHousehold.tasks),
    groceryRepository.getGroceries(baseHousehold.groceries),
    calendarRepository.getEvents(baseHousehold.events),
    rewardsRepository.getRewards(baseHousehold.rewards),
    rewardsRepository.getBadges(baseHousehold.badges),
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

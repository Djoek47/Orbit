import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { dataMode } from '@/config/data-mode';
import { useLivePoppinsAi } from '@/config/poppins-ai-mode';
import { createEmptyHousehold, mockHousehold } from '@/data/mock-household';
import { loadActiveMemberId, loadMockSession, saveActiveMemberId } from '@/lib/auth/mock-session';
import type { PoppinsChatMessage } from '@/lib/ai/ai-provider';
import {
  executePoppinsTool,
  toolResultToMonitorAction,
} from '@/lib/ai/execute-poppins-tool';
import { buildPoppinsHouseholdPayload } from '@/lib/ai/household-context';
import type { PoppinsToolName } from '@/lib/ai/poppins-tools';
import { attachIntentActions } from '@/lib/poppins/ui-intent';
import {
  isMajordomoProfileId,
  resolveMajordomoProfileId,
} from '@/lib/ai/majordomo-profiles';
import {
  applyStoredMajordomoProfiles,
  saveMajordomoProfileId,
  saveMemberMajordomoProfileId,
} from '@/lib/ai/majordomo-prefs';
import {
  POPPINS_PAUSED_COPY,
  buildUsageEvent,
  estimateTokensFromText,
  estimateVoiceUsd,
  summarizeAiUsage,
  type AiUsageEvent,
  type AiUsageKind,
} from '@/lib/ai/credits';
import { loadAiUsageEvents, saveAiUsageEvents } from '@/lib/ai/credit-ledger';
import { getSupabaseClient } from '@/lib/supabase/client';
import { trackAnalytics } from '@/lib/analytics';
import {
  buildDailyInsightCandidates,
  countAiInsightsToday,
  DAILY_INSIGHT_CAP,
  insightKindUsedToday,
  isDismissedNotification,
  isJunkMockInsight,
  shouldSkipKindToday,
  withMemberDismissed,
} from '@/lib/ai/daily-insight';
import { unreadInboxCount } from '@/lib/poppins/inbox-visibility';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { isValidDailyDeadline, queueDailyDeadlineChange, settleDeadlineState } from '@/lib/rules/deadline';
import { householdDueTimeLocal } from '@/lib/rules/household-view';
import { evaluateAchievements, getLevel, LEVELS, MEMBER_ACCENTS, memberDisplayEmoji, xpProgress } from '@/lib/game-levels';
import { hasChosenAvatar } from '@/lib/profile/chosen-avatar';
import { getLocationAwareGrocerySuggestions, buildStoreRecommendations } from '@/lib/grocery/location-suggestions';
import { countUpcomingSoon } from '@/lib/calendar/event-groups';
import { resolveEventApprovalStatus } from '@/lib/calendar/event-approval';
import { canCreateSelfHomework } from '@/lib/calendar/sidekick-homework';
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
import { newCustomHouseRuleId, validateCustomHouseRule } from '@/lib/rules/custom-house-rules';
import { saveActiveMockHousehold, loadActiveMockHousehold } from '@/lib/household/mock-active-household';
import {
  getActiveHouseholdPref,
  getPrimaryHouseholdPref,
  setActiveHouseholdPref,
  setPrimaryHouseholdPref,
} from '@/lib/household/active-household-pref';
import { getHouseholdAccentPref } from '@/lib/household/household-accent-pref';
import { isMemberFullyConnected } from '@/lib/household/member-connection';
import { plannedTasksForMember } from '@/lib/onboarding/planned-member-tasks';
import { resolveMemberByProfileCode } from '@/lib/household/profile-codes';
import { buildInviteLinks, normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';
import {
  classifyInviteCode,
  householdInviteWrongForKidMessage,
} from '@/lib/invites/invite-intent';
import { hrefAfterJoinApproval, joinSessionSignOutRequired } from '@/lib/invites/join-session';
import { isPendingJoinSnapshot } from '@/lib/invites/join-approval';
import { isPersistedHouseholdId } from '@/lib/household/persisted-household-id';
import { mapMemberRow, mapTaskRow } from '@/lib/mappers/orbit-mappers';
import { promoteMemberToAdmin } from '@/lib/household/admin-cap';
import { canRequestReward } from '@/lib/rewards/can-request-reward';
import { canProposeReward, type RewardProposal } from '@/lib/rewards/reward-proposals';
import { groceryAddAllowedForSidekick, isSidekickRole } from '@/lib/sidekick/permissions';
import { assigneeMemberIdsForTask } from '@/lib/sidekick/task-assigned-notify';
import {
  assigneeMemberForTask,
  notifyTaskAssigned,
} from '@/lib/notifications/notify-task-assigned';
import { isHomeworkCategory } from '@/lib/tasks/homework-subject';
import { needsProofOnComplete, proofRequiredForHomeworkAssign } from '@/lib/tasks/homework-proof';
import { canAdminRequestTaskProof } from '@/lib/tasks/proof-eligibility';
import {
  isSidekickLocalUserId,
  loadSidekickSession,
  saveSidekickSession,
  type SidekickSession,
  markSidekickSignedOut,
  clearSidekickSignedOut,
  touchSidekickSession,
  wasSidekickSignedOut,
} from '@/lib/sidekick/session';
import {
  fetchSidekickSync,
  mergeSidekickSyncIntoHousehold,
} from '@/lib/sidekick/sync-household';
import {
  sidekickCompleteTask,
  sidekickSubmitTaskProof,
  sidekickCreateHomework,
  sidekickAddGrocery,
  sidekickCreateEvent,
  usesProfileCodeAuth,
} from '@/lib/sidekick/task-action';
import {
  sidekickDismissNotification,
  sidekickMarkNotificationRead,
  sidekickNotificationAuth,
} from '@/lib/sidekick/notification-action';
import { adminMemberIds, resolveAudienceMemberIds } from '@/lib/household/admin-member-ids';
import {
  applyRedeemedMember,
  redeemMockMemberInvite,
} from '@/repositories/member-invite-repository';
import { consumeInviteCode, peekInviteCode, stashInviteCode } from '@/lib/invite/invite-code-store';
import {
  clearPendingJoinHouseholdId,
  peekPendingJoinHouseholdId,
  stashPendingJoinHouseholdId,
} from '@/lib/invite/pending-join-store';
import { suggestItineraryFromHousehold } from '@/lib/calendar/suggest-itinerary';
import {
  isNotificationVisibleToMember,
  PROOF_REVIEW_ROLES,
  REWARD_REVIEW_ROLES,
} from '@/lib/notifications/audience';
import { registerForPushNotifications, presentLocalBanner, syncAppBadge, scheduleLocalReminder } from '@/lib/notifications/push';
import { dispatchMemberPush, registerSidekickPushNotifications } from '@/lib/notifications/member-push';
import { isQuietHour } from '@/lib/poppins/notification-batch';
import { composeWithLuna } from '@/lib/poppins/notification-composer';
import {
  GLANCE_FLUSH_MS,
  coalesceFacts,
  factFromNotificationInput,
  laneForKind,
  type ComposeDecision,
  type HouseholdFact,
} from '@/lib/poppins/notification-policy';
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
import { isOnRecess } from '@/lib/recess/recess-engine';
import { formatLocalDate } from '@/lib/streaks/local-date';
import {
  applyHouseholdTaskExpiry,
  tasksWithExpiryStatusChange,
} from '@/lib/tasks/apply-household-expiry';
import { refreshStaleDueLabels } from '@/lib/tasks/due-label';
import {
  ensureOccurrencesForDay,
  isExpiredStatus,
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
import { applySeriesPatch, defaultSeriesScope } from '@/lib/tasks/series-edit';
import { isTodayTask } from '@/lib/tasks/today';
import { isTaskLate, resolveCompletionXp } from '@/lib/tasks/xp';
import { recordCompletionForTrophies } from '@/lib/trophies/runtime';
import {
  resolveSplitPair,
} from '@/lib/household/admins';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import {
  resolveMemberCapabilities,
} from '@/lib/member-capabilities';
import {
  clearMockHouseholdSnapshot,
  persistCustomHouseRulesRows,
  persistMockHouseholdSnapshot,
} from '@/repositories/household-repository';
import { mergeHydratedPlaces } from '@/lib/places/saved-places';
import {
  authRepository,
  calendarRepository,
  groceryRepository,
  householdRepository,
  itineraryRepository,
  notificationsRepository,
  placesRepository,
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
  /** Morning brief for the bell sheet; null after dismiss today. */
  inboxBriefing: PoppinsBriefing | null;
  poppinsRecommendations: PoppinsRecommendation[];
  poppinsMonitorActions: PoppinsMonitorAction[];
  poppinsActivityFacts: HouseholdFact[];
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
  /** Per-person Poppins spend. Admin surface; trips off at $4. */
  aiUsageEvents: import('@/lib/ai/credits').AiUsageEvent[];
  recordPoppinsUsage: (
    kind: import('@/lib/ai/credits').AiUsageKind,
    answer: {
      question: string;
      answer: string;
      usage?: { inputTokens?: number; outputTokens?: number; model?: string; usd?: number };
    }
  ) => Promise<void>;
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
    options?: { householdId?: string | null; selfHomework?: boolean }
  ) => Promise<HouseholdTask | null>;
  updateTask: (
    task: HouseholdTask,
    options?: { scope?: 'this' | 'future' }
  ) => Promise<void>;
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
  /** Foreground catch-up: auto-confirm, materialise occurrences, expire at 23:59. */
  runOccurrenceCatchUp: (snapshot?: HouseholdSnapshot) => Promise<void>;
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
  /** Add from Canada catalog product (aisle from product.categoryId). */
  addGroceryFromProduct: (productId: string) => Promise<void>;
  toggleGroceryFavorite: (productId: string) => void;
  listGroceryBuyAgain: () => string[];
  setPreferredStore: (storeId: string) => void;
  preferredStore: PreferredStore;
  joinHousehold: (input: JoinHouseholdInput) => Promise<'pending' | 'active' | 'signed_out' | void>;
  /** After sign-in: consume a stashed household invite. */
  applyStashedInvite: () => Promise<'pending' | 'active' | 'none'>;
  /** Pending adult: reload that join, not the oldest household. */
  checkJoinApproval: () => Promise<'approved' | 'pending' | 'missing'>;
  redeemMemberInviteToken: (
    token: string,
    clientRole?: string
  ) => Promise<{ ok: true; memberStatus: 'active' | 'pending' } | { ok: false; message: string }>;
  markGroceryPurchased: (itemId: string) => void;
  markGroceryMissing: (itemId: string) => void;
  markGroceryLow: (itemId: string) => void;
  /** Persist aisle correction + household override map (Rev C §4.3). */
  patchGroceryCategory: (
    itemId: string,
    categoryId: string,
    overrides: Record<string, string>
  ) => Promise<void>;
  /** Admin-only: remove Purchased rows from the list (Rev C §4.2 / §4.5). */
  clearCheckedGroceries: () => Promise<void>;
  /** Admin-only: wipe active shopping list. */
  clearGroceryList: () => Promise<void>;
  /** Mark groceries surface opened (clears "new since last open" badge). */
  markGroceriesOpened: () => void;
  createEvent: (input: CreateEventInput) => Promise<HouseholdEvent | null>;
  updateEvent: (event: HouseholdEvent) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  approveEvent: (eventId: string) => Promise<void>;
  rejectEvent: (eventId: string) => Promise<void>;
  remindAboutEvent: (eventId: string, memberIds: string[]) => Promise<boolean>;
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
  hydrateFromSession: (session: AuthSession) => Promise<HouseholdSnapshot>;
  signOut: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean; email: string }>;
  suggestedPoppinsQuestions: readonly string[];
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  /** Persist swipe-away so the card does not come back on reopen. */
  dismissInboxItem: (notificationId: string) => Promise<void>;
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
  /** Household default majordomo (Character → Personality → Voice). */
  updateMajordomoProfile: (profileId: string) => void;
  /** Optional personal majordomo override for the current member. */
  updateMemberMajordomoProfile: (profileId: string | null) => void;
  updateMemberCapabilities: (prefs: Partial<MemberCapabilities>) => void;
  /** Parent/admin: Meritocracy vs Equity + hygiene XP opt-in (household-scoped). */
  updateHouseholdRewardSettings: (prefs: {
    rewardMode?: 'weighted' | 'flat';
    hygieneRewarded?: boolean;
    hygieneXp?: 5 | 10;
  }) => void;
  /** Parent/admin: XP system (xp_only / allowance / rewards / full) — changeable in Settings. */
  updateHouseholdRewardModel: (model: RewardModel) => void;
  /** Admin: queue a daily deadline change for tomorrow (in-progress tasks keep today's hour). */
  queueDailyDeadline: (hhmm: string) => void;
  /** Admin: Hold & Request for allowance amounts. Hidden when the model has no allowance. */
  setAllowanceRequestsEnabled: (enabled: boolean) => void;
  /** Admin: require approval before invited members enter. Default true. */
  setJoinApprovalRequired: (required: boolean) => void;
  /** Admin: pre-approve a specific invited member so they skip the pending step. */
  setMemberJoinPreApproved: (memberId: string, preApproved: boolean) => Promise<void>;
  completeProfileJoin: (input: import('@/types/orbit').CompleteProfileJoinInput) => Promise<{
    status: 'pending' | 'active';
  }>;
  lookupProfileInvite: (
    code: string
  ) => Promise<{ member: HouseholdMember; householdName: string } | null>;
  householdMemberships: {
    householdId: string;
    householdName: string;
    role: HouseholdRole;
    status: string;
    accentThemeId: AccentThemeId;
    deletionScheduledFor?: string | null;
  }[];
  isGuestInActiveHousehold: boolean;
  switchHousehold: (householdId: string) => Promise<void>;
  /** Owner-only — schedules permanent deletion after a 15-day grace period. */
  deleteHousehold: () => Promise<{ scheduledFor: string }>;
  /** Owner-only — cancels a scheduled household deletion within the grace window. */
  cancelHouseholdDeletion: () => Promise<void>;
  /**
   * Custom house rules — display only; never alter scoring / XP / allowance.
   */
  addCustomHouseRule: (body: string) => { ok: true } | { ok: false; message: string };
  updateCustomHouseRule: (id: string, body: string) => { ok: true } | { ok: false; message: string };
  removeCustomHouseRule: (id: string) => void;
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
  /** Revision C §1 — per-child homework photo proof toggle. */
  updateMemberHomeworkProof: (memberId: string, required: boolean) => Promise<void>;
  upsertRoom: (room: HouseholdRoom) => void;
  removeRoom: (roomId: string) => void;
  runPoppinsMonitor: () => Promise<PoppinsMonitorAction[]>;
  /** Execute a Poppins tool from Realtime / chat and apply Activity + notifications. */
  executePoppinsToolCall: (
    name: PoppinsToolName,
    args: Record<string, unknown>,
    options?: { forceRiskyConfirmation?: boolean }
  ) => Promise<Record<string, unknown>>;
  requestRewardRedemption: (rewardId: string, note?: string) => Promise<void>;
  /** Hold-to-claim: Instant spends XP now; Approval submits a pending request. */
  claimReward: (rewardId: string) => Promise<'claimed' | 'requested' | null>;
  requestSpecialReward: (title: string, note?: string, cost?: number) => Promise<void>;
  approveRewardProposal: (proposalId: string) => Promise<void>;
  declineRewardProposal: (proposalId: string) => Promise<void>;
  updateSidekickGroceryAdd: (enabled: boolean) => void;
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
    drafts: {
      name: string;
      role: 'admin' | 'member';
      avatar?: string;
      plannedTaskLibraryIds?: string[];
      joinPreApproved?: boolean;
    }[],
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
  deleteAccount: (feedback?: { reason: string; detail?: string }) => Promise<void>;
  exportUserData: () => Promise<string>;
  toggleSmartDevice: (deviceId: string) => Promise<void>;
  activateSmartScene: (sceneId: string) => Promise<void>;
  refreshStoreRecommendations: () => Promise<void>;
  refreshInviteLinks: () => Promise<InviteLinks | null>;
  refreshSmartHome: () => Promise<void>;
  refreshHousehold: () => Promise<HouseholdSnapshot>;
  /** Re-enter a saved Sidekick profile after sign-out (same device). */
  restoreSidekickSession: () => Promise<boolean>;
  /** Admin nudge — remind assignee about an open task (inbox + push). */
  sendTaskReminder: (taskId: string, memberId?: string) => Promise<boolean>;
  canAddGroceryWishlist: boolean;
};

const OrbitContext = createContext<OrbitContextValue | null>(null);

export function OrbitProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<OrbitUser | null>(null);
  const [household, setHousehold] = useState<HouseholdSnapshot>(mockHousehold);
  const householdRef = useRef(household);
  householdRef.current = household;
  const currentMemberRef = useRef<HouseholdMember | null>(null);
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
  const [householdMemberships, setHouseholdMemberships] = useState<
    OrbitContextValue['householdMemberships']
  >([]);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [poppinsAskCount, setPoppinsAskCount] = useState(0);
  const [aiUsageEvents, setAiUsageEvents] = useState<AiUsageEvent[]>([]);
  const aiUsageRef = useRef<AiUsageEvent[]>([]);
  aiUsageRef.current = aiUsageEvents;
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
  const [poppinsActivityFacts, setPoppinsActivityFacts] = useState<HouseholdFact[]>([]);
  const glanceBufferRef = useRef<HouseholdFact[]>([]);
  const glanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glanceBannerMembersRef = useRef<Set<string>>(new Set());
  const notificationsRef = useRef<NotificationItem[]>([]);
  const monitorKickRef = useRef<string | null>(null);
  const [briefDismissedYmd, setBriefDismissedYmd] = useState<string | null>(null);
  notificationsRef.current = notifications;

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
  currentMemberRef.current = currentMember ?? null;
  const hasHousehold = Boolean(currentUser && household.id);

  useEffect(() => {
    let cancelled = false;
    void loadAiUsageEvents(household.id).then((events) => {
      if (cancelled) return;
      aiUsageRef.current = events;
      setAiUsageEvents(events);
    });
    return () => {
      cancelled = true;
    };
  }, [household.id]);

  const recordPoppinsUsage = useCallback(
    async (kind: AiUsageKind, answer: { question: string; answer: string; usage?: { inputTokens?: number; outputTokens?: number; model?: string; usd?: number } }) => {
      const member = currentMember;
      if (!member) return;
      const model =
        answer.usage?.model ||
        (kind === 'voice' ? 'gpt-realtime-2.1' : 'gpt-5.6-luna');
      const event = buildUsageEvent({
        memberId: member.id,
        memberName: member.name,
        kind,
        model,
        inputTokens: answer.usage?.inputTokens ?? estimateTokensFromText(answer.question),
        outputTokens: answer.usage?.outputTokens ?? estimateTokensFromText(answer.answer),
        usd:
          answer.usage?.usd ??
          (kind === 'voice' && !answer.usage?.inputTokens && !answer.usage?.outputTokens
            ? estimateVoiceUsd()
            : undefined),
      });
      const next = [...aiUsageRef.current, event];
      aiUsageRef.current = next;
      setAiUsageEvents(next);
      await saveAiUsageEvents(household.id, next);
    },
    [currentMember, household.id]
  );
  const isPendingMember = false;
  const permissions = useMemo(
    () => getPermissionsForRole(currentMember?.role ?? 'guest'),
    [currentMember?.role]
  );
  const v2Permissions = useMemo(
    () => getV2Permissions(currentMember?.role),
    [currentMember?.role]
  );
  const rewardCapabilities = useMemo(
    () => capabilitiesFor(household.rewardModel ?? DEFAULT_REWARD_MODEL),
    [household.rewardModel]
  );

  const persistHouseRulesHouseholdFields = (
    householdId: string | null,
    next: HouseholdSnapshot,
    patch: {
      daily_deadline?: string | null;
      daily_deadline_pending?: string | null;
      daily_deadline_applies_on?: string | null;
      allowance_requests_enabled?: boolean;
      join_approval_required?: boolean;
    }
  ) => {
    if (dataMode === 'mock') {
      void persistMockHouseholdSnapshot(next);
    }
    if (dataMode === 'supabase' && householdId) {
      void import('@/repositories/repository-utils').then(async ({ getConfiguredSupabase, mapDbError }) => {
        try {
          const supabase = getConfiguredSupabase('houseRulesSettings');
          const { error } = await supabase.from('households').update(patch).eq('id', householdId);
          mapDbError('houseRulesSettings', error);
        } catch (error) {
          console.warn('houseRulesSettings supabase skipped', error);
        }
      });
    }
  };

  const queueDailyDeadline = (hhmm: string) => {
    const doc = getHouseRulesDoc();
    if (!isValidDailyDeadline(hhmm, doc)) return;
    setHousehold((current) => {
      if (!permissions.canManageHousehold) return current;
      const queued = queueDailyDeadlineChange(hhmm, new Date(), doc);
      const next: HouseholdSnapshot = {
        ...current,
        dailyDeadlinePending: queued.dailyDeadlinePending,
        dailyDeadlineAppliesOn: queued.dailyDeadlineAppliesOn,
      };
      persistHouseRulesHouseholdFields(current.id, next, {
        daily_deadline_pending: queued.dailyDeadlinePending,
        daily_deadline_applies_on: queued.dailyDeadlineAppliesOn,
      });
      return next;
    });
  };

  const setAllowanceRequestsEnabled = (enabled: boolean) => {
    setHousehold((current) => {
      if (!permissions.canManageHousehold) return current;
      const next: HouseholdSnapshot = {
        ...current,
        allowanceRequestsEnabled: enabled,
      };
      persistHouseRulesHouseholdFields(current.id, next, {
        allowance_requests_enabled: enabled,
      });
      return next;
    });
  };

  const setJoinApprovalRequired = (required: boolean) => {
    setHousehold((current) => {
      if (!permissions.canManageHousehold) return current;
      const next: HouseholdSnapshot = {
        ...current,
        joinApprovalRequired: required,
      };
      persistHouseRulesHouseholdFields(current.id, next, {
        join_approval_required: required,
      });
      return next;
    });
  };

  const setMemberJoinPreApproved = async (memberId: string, preApproved: boolean) => {
    if (!permissions.canManageHousehold) return;
    const member = household.members.find((item) => item.id === memberId);
    if (!member || member.role === 'child') return;
    const updated = await householdRepository.setMemberJoinPreApproved(member, preApproved);
    setHousehold((current) => ({
      ...current,
      members: current.members.map((item) => (item.id === memberId ? updated : item)),
    }));
    await trackAnalytics(
      preApproved ? 'member.pre_approved' : 'member.pre_approval_removed',
      { memberId },
      analyticsContext
    );
  };

  const metrics = useMemo(() => calculateMetrics(household), [household]);
  const isGuestInActiveHousehold = useMemo(() => {
    if (!currentMember || !household.id) return false;
    return currentMember.role === 'guest';
  }, [currentMember, household.id]);
  const membersWithProgress = useMemo(
    () => household.members.map((member) => calculateMemberProgress(member, household.tasks)),
    [household.members, household.tasks]
  );
  const achievements = useMemo(
    () => evaluateAchievements(household, { poppinsAskCount, focusMemberName: currentMember?.name }),
    [household, poppinsAskCount, currentMember?.name]
  );
  const poppinsBriefing = useMemo(() => household.poppins, [household.poppins]);
  const inboxBriefing = useMemo(() => {
    const today = formatLocalDate(new Date());
    if (briefDismissedYmd === today) return null;
    return poppinsBriefing;
  }, [briefDismissedYmd, poppinsBriefing]);
  const visibleNotifications = useMemo(
    () =>
      notifications.filter(
        (item) =>
          !isDismissedNotification(item, currentMember?.id) &&
          !isJunkMockInsight(item) &&
          isNotificationVisibleToMember(
            item,
            currentMember ? { id: currentMember.id, role: currentMember.role } : null
          )
      ),
    [currentMember?.id, currentMember?.role, notifications]
  );
  const unreadNotificationCount = useMemo(
    () => unreadInboxCount(visibleNotifications, Date.now(), currentMember?.id),
    [currentMember?.id, visibleNotifications]
  );

  useEffect(() => {
    if (!household.id) {
      setBriefDismissedYmd(null);
      return;
    }
    const key = `orbit.poppins.brief-dismissed.${household.id}`;
    void AsyncStorage.getItem(key).then((stored) => {
      setBriefDismissedYmd(stored);
    });
  }, [household.id]);

  useEffect(() => {
    void syncAppBadge(unreadNotificationCount);
  }, [unreadNotificationCount]);

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

  const applySidekickSyncPayload = useCallback(
    async (
      sync: NonNullable<Awaited<ReturnType<typeof fetchSidekickSync>>>,
      options?: { announceNewTasks?: boolean; base?: HouseholdSnapshot }
    ) => {
      const base = options?.base ?? householdRef.current;
      const previousTaskIds = new Set(base.tasks.map((task) => task.id));
      const previousNotificationIds = new Set(notificationsRef.current.map((item) => item.id));
      const merged = mergeSidekickSyncIntoHousehold(base, sync);
      setHousehold(merged);
      setNotifications(sync.notifications);
      setStoreRecommendations(buildStoreRecommendations(merged.id, merged.groceries));

      void touchSidekickSession().catch(() => undefined);

      if (options?.announceNewTasks) {
        const prefs = merged.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
        if (prefs.tasks !== false) {
          const newTasks = sync.tasks.filter(
            (task) =>
              !previousTaskIds.has(task.id) &&
              taskMatchesAssignee(task, sync.member.name) &&
              task.status !== 'Completed' &&
              task.status !== 'Cancelled'
          );
          for (const task of newTasks.slice(0, 2)) {
            void presentLocalBanner('New task', `${task.title} was added to your list.`, {
              taskId: task.id,
              category: 'tasks',
              kind: 'task_assigned',
            }).catch(() => undefined);
          }
        }
        const newNotes = sync.notifications.filter((item) => !previousNotificationIds.has(item.id) && !item.isRead);
        for (const note of newNotes.slice(0, 2)) {
          void presentLocalBanner(note.title, note.body, {
            ...(note.data ?? {}),
            notificationId: note.id,
            category: note.category,
          }).catch(() => undefined);
        }
      }

      return merged;
    },
    []
  );

  const reloadSidekickDomains = useCallback(async () => {
    const session = await loadSidekickSession();
    if (!session?.profileInviteCode) return null;
    const sync = await fetchSidekickSync(session.profileInviteCode);
    if (!sync) return null;
    return applySidekickSyncPayload(sync, { announceNewTasks: true });
  }, [applySidekickSyncPayload]);

  const reloadHouseholdDomains = useCallback(async () => {
    const sidekickActive =
      isSidekickRole(currentMemberRef.current?.role) || Boolean(await loadSidekickSession());

    if (dataMode === 'supabase' && sidekickActive) {
      const synced = await reloadSidekickDomains();
      if (synced) return synced;
      console.warn('reloadHouseholdDomains: sidekick sync failed, keeping in-memory snapshot');
      return householdRef.current;
    }

    const baseHousehold = await householdRepository.getHousehold();
    const hydratedHousehold = await hydrateHousehold(baseHousehold);
    const withExpiry = {
      ...hydratedHousehold,
      tasks: refreshStaleDueLabels(
        applyHouseholdTaskExpiry(hydratedHousehold.tasks, hydratedHousehold),
        new Date()
      ),
    };
    setHousehold(withExpiry);
    await Promise.all([
      notificationsRepository.list(withExpiry.id).then(setNotifications),
      rewardsRepository.getRedemptions(withExpiry.id).then((items) => {
        setRedemptions(items);
        setPendingRedemptions(items.filter((item) => item.status === 'pending'));
      }),
      rewardsRepository.getAllowances(withExpiry.id).then(setAllowances),
      smartHomeRepository.listDevices(withExpiry.id).then(setSmartHomeDevices),
      smartHomeRepository.listScenes(withExpiry.id).then(setSmartHomeScenes),
    ]);
    setStoreRecommendations(buildStoreRecommendations(withExpiry.id, withExpiry.groceries));

    const expiryChanges = tasksWithExpiryStatusChange(hydratedHousehold.tasks, withExpiry.tasks);
    if (expiryChanges.length > 0) {
      await Promise.all(
        expiryChanges.map((task) =>
          taskRepository.updateTask(task).catch((error) => {
            console.warn('reloadHouseholdDomains expiry persist', task.id, error);
          })
        )
      );
    }

    return withExpiry;
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      const session = await authRepository.getCurrentSession();

      if (!session) {
        const sidekickSession = await loadSidekickSession();
        const signedOut = await wasSidekickSignedOut();
        if (sidekickSession && !signedOut && isMounted) {
          const restored = await restoreSidekickFromSession(sidekickSession);
          if (restored) {
            setIsLoading(false);
            return;
          }
        }

        if (sidekickSession && isMounted) {
          setHousehold(
            createEmptyHousehold({
              id: `child-local-${sidekickSession.memberId}`,
              email: `${sidekickSession.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'kid'}@kids.choremaxx.local`,
              name: sidekickSession.displayName,
              avatar: sidekickSession.avatar ?? sidekickSession.displayName.charAt(0).toUpperCase(),
              profileComplete: true,
            })
          );
          setIsLoading(false);
          return;
        }

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
          const majordomo = await applyStoredMajordomoProfiles(
            mockHousehold.id,
            themedMembers,
            mockHousehold.majordomoProfileId
          );
          setHousehold((current) => ({
            ...current,
            notificationPrefs: prefs,
            accentThemeId: themeId,
            majordomoProfileId: majordomo.householdProfileId,
            rooms: savedRooms?.length
              ? savedRooms
              : current.rooms?.length
                ? current.rooms
                : DEFAULT_HOUSEHOLD_ROOMS.map((r) => ({ ...r })),
            members: majordomo.members.length ? majordomo.members : current.members,
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
      let hydratedHousehold = isPendingJoinSnapshot(baseHousehold)
        ? baseHousehold
        : await hydrateHousehold(baseHousehold);

      const pendingJoinId = await peekPendingJoinHouseholdId();
      if (pendingJoinId && session.user) {
        const join = await householdRepository.checkJoinApproval(session.user, pendingJoinId);
        if (join.snapshot && (join.status === 'pending' || join.status === 'approved')) {
          hydratedHousehold = join.snapshot;
          if (join.status === 'approved') {
            await clearPendingJoinHouseholdId();
          }
        }
      } else if (!hydratedHousehold.id && session.user) {
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
        const majordomo = await applyStoredMajordomoProfiles(
          hydratedHousehold.id,
          hydratedHousehold.members,
          hydratedHousehold.majordomoProfileId
        );
        setHousehold({
          ...hydratedHousehold,
          greetingName: session.user.name || hydratedHousehold.greetingName,
          notificationPrefs: prefs,
          accentThemeId: themeId,
          majordomoProfileId: majordomo.householdProfileId,
          members: majordomo.members,
          rooms: hydratedHousehold.rooms?.length
            ? hydratedHousehold.rooms
            : DEFAULT_HOUSEHOLD_ROOMS.map((r) => ({ ...r })),
        });
        const resumeMemberId =
          mockStored?.activeMemberId ||
          storedMemberId ||
          hydratedHousehold.members.find(
            (member) =>
              member.status === 'pending' &&
              member.name.toLowerCase() === session.user.name.toLowerCase(),
          )?.id ||
          hydratedHousehold.members.find(
            (member) =>
              member.status === 'active' &&
              member.name.toLowerCase() === session.user.name.toLowerCase(),
          )?.id ||
          null;
        if (resumeMemberId) {
          setActiveMemberId(resumeMemberId);
        }
        const history = isPendingJoinSnapshot(hydratedHousehold)
          ? []
          : await poppinsRepository.getConversationHistory(
              hydratedHousehold.id,
              session.user.id
            );
        setPoppinsConversation(history);
        setStoreRecommendations(buildStoreRecommendations(hydratedHousehold.id, hydratedHousehold.groceries));
        const emptyDomains =
          isPendingJoinSnapshot(hydratedHousehold) ||
          (dataMode !== 'mock' && !isPersistedHouseholdId(hydratedHousehold.id));
        const [items, redemptions, allowanceItems, devices, scenes, links] = emptyDomains
          ? [[], [], [], [], [], null]
          : await Promise.all([
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

    hydrate().catch(async (error) => {
      console.warn('Failed to hydrate Orbit data', error);
      try {
        const session = await authRepository.getCurrentSession();
        if (isMounted && session?.user) {
          setCurrentUser(session.user);
          const pending = await householdRepository.getPendingHouseholdSnapshot(session.user);
          if (pending) {
            setHousehold(pending);
            const self = pending.members.find((member) => member.status === 'pending');
            if (self) setActiveMemberId(self.id);
            if (pending.id) await stashPendingJoinHouseholdId(pending.id);
          }
        }
      } catch (recoverError) {
        console.warn('Failed to recover pending session', recoverError);
      }
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

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const sidekickActive =
        isSidekickRole(currentMemberRef.current?.role) || Boolean(await loadSidekickSession());
      if (cancelled || sidekickActive) return;

      unsubscribe = subscribeHouseholdRealtime(household.id!, () => {
        reloadHouseholdDomains().catch((error) => {
          console.warn('Failed to reload after realtime change', error);
        });
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [household.id, reloadHouseholdDomains]);

  useEffect(() => {
    void refreshStoreRecommendations();
  }, [refreshStoreRecommendations]);

  const hydrateFromSession = useCallback(async (session: AuthSession) => {
    const { allowAuthStorageWrites } = await import('@/lib/auth/auth-storage');
    allowAuthStorageWrites();
    setCurrentUser(session.user);
    await authRepository.persistLocalSession(session.user);

    let hydratedHousehold = createEmptyHousehold(session.user);
    try {
      const baseHousehold = await householdRepository.getHousehold();
      hydratedHousehold = isPendingJoinSnapshot(baseHousehold)
        ? {
            ...baseHousehold,
            greetingName: session.user.name || baseHousehold.greetingName,
          }
        : await hydrateHousehold({
            ...baseHousehold,
            greetingName: session.user.name || baseHousehold.greetingName,
          });
    } catch (error) {
      console.warn('hydrateFromSession.household', error);
      try {
        const pending = await householdRepository.getPendingHouseholdSnapshot(session.user);
        if (pending) hydratedHousehold = pending;
      } catch (pendingError) {
        console.warn('hydrateFromSession.pending', pendingError);
      }
    }

    setHousehold(hydratedHousehold);
    const pendingSelf = hydratedHousehold.members.find((member) => member.status === 'pending');
    if (isPendingJoinSnapshot(hydratedHousehold)) {
      if (pendingSelf) setActiveMemberId(pendingSelf.id);
      if (hydratedHousehold.id) {
        await stashPendingJoinHouseholdId(hydratedHousehold.id);
      }
      await trackAnalytics(
        'auth.session_hydrate',
        { email: session.user.email, pending_join: true },
        { householdId: hydratedHousehold.id, userId: session.user.id }
      );
      return hydratedHousehold;
    }

    await trackAnalytics(
      'auth.session_hydrate',
      { email: session.user.email },
      { householdId: hydratedHousehold.id, userId: session.user.id }
    );
    try {
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
    } catch (domainError) {
      console.warn('hydrateFromSession.domains', domainError);
    }
    registerForPushNotifications(session.user.id).catch((error) => {
      console.warn('Push registration skipped', error);
    });
    await refreshHouseholdMemberships(session.user.id);
    return hydratedHousehold;
  }, []);

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
      throw new Error('Sign in to create your household.');
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

  const joinHousehold = async (
    input: JoinHouseholdInput
  ): Promise<'pending' | 'active' | 'signed_out'> => {
    const code = input.inviteCode.trim().toUpperCase();
    const hasActiveLiveHome =
      Boolean(household.id) &&
      !isPendingJoinSnapshot(household) &&
      household.members.some((member) => member.status === 'active');

    if (joinSessionSignOutRequired(hasActiveLiveHome, Boolean(code))) {
      await stashInviteCode(code);
      await signOut();
      return 'signed_out';
    }

    const user =
      currentUser ?? (await authRepository.getCurrentSession())?.user ?? null;
    if (!user) {
      return 'active';
    }

    const joinedHousehold = await householdRepository.joinHousehold(input, user);
    let nextHousehold = joinedHousehold;
    if (hasActiveLiveHome && nextHousehold.id && household.id && household.id !== nextHousehold.id) {
      const primary = (await getPrimaryHouseholdPref()) ?? household.id;
      if (!primary) {
        await setPrimaryHouseholdPref(household.id);
      }
      await setActiveHouseholdPref(nextHousehold.id);
    }
    const selfMember = nextHousehold.members.find((member) => member.userId === user.id);
    if (selfMember && hasChosenAvatar(user.avatar) && selfMember.avatar !== user.avatar) {
      const updated = await householdRepository.updateMemberAvatar(selfMember, user.avatar);
      nextHousehold = {
        ...joinedHousehold,
        members: joinedHousehold.members.map((member) =>
          member.id === selfMember.id ? updated : member
        ),
      };
      void saveMemberAvatarOverride(joinedHousehold.id, selfMember.id, user.avatar);
    }
    if (selfMember && selfMember.name.trim().toLowerCase() !== user.name.trim().toLowerCase()) {
      const renamed = await householdRepository.updateMemberDisplayName(
        selfMember.id,
        user.name,
        nextHousehold.id
      );
      if (renamed) {
        nextHousehold = {
          ...nextHousehold,
          members: nextHousehold.members.map((member) =>
            member.id === selfMember.id ? renamed : member
          ),
          greetingName: user.name,
        };
      }
    }
    const pendingSelf = nextHousehold.members.find(
      (member) => member.userId === user.id && member.status === 'pending'
    );
    const activeSelf =
      nextHousehold.members.find(
        (member) => member.userId === user.id && member.status === 'active'
      ) ??
      (pendingSelf
        ? { ...pendingSelf, status: 'active' as const }
        : undefined);
    if (pendingSelf && activeSelf) {
      try {
        const approved = await householdRepository.approveMember(pendingSelf.id);
        nextHousehold = {
          ...nextHousehold,
          members: nextHousehold.members.map((member) =>
            member.id === pendingSelf.id ? approved : member
          ),
        };
      } catch (error) {
        console.warn('joinHousehold.autoApprove', error);
      }
    }
    setHousehold(nextHousehold);
    if (activeSelf) {
      setActiveMemberId(activeSelf.id);
      await clearPendingJoinHouseholdId();
    }
    if (dataMode === 'mock') {
      await persistMockHouseholdSnapshot(nextHousehold);
    }
    await refreshHouseholdMemberships(user.id);
    await trackAnalytics('household.joined', { inviteCode: input.inviteCode }, { householdId: nextHousehold.id, userId: user.id });
    if (activeSelf) {
      await applyPlannedTasksForMember(activeSelf.id, nextHousehold.id);
    }
    return 'active';
  };

  const refreshHouseholdMemberships = async (userId?: string | null) => {
    const id = userId ?? currentUser?.id;
    if (!id || id.startsWith('child-local-') || id.startsWith('tablet-local-')) {
      setHouseholdMemberships([]);
      return;
    }
    const rows = await householdRepository.listMemberships(id);
    const enriched = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        accentThemeId: (await getHouseholdAccentPref(row.householdId)) ?? 'coral',
      }))
    );
    setHouseholdMemberships(enriched);
  };

  const switchHousehold = async (householdId: string) => {
    const user = currentUser ?? (await authRepository.getCurrentSession())?.user ?? null;
    if (!user?.id) return;
    await setActiveHouseholdPref(householdId);
    const next = await householdRepository.loadHouseholdById(householdId, user.id);
    const accent = await getHouseholdAccentPref(householdId);
    const hydrated = await hydrateHousehold({
      ...next,
      accentThemeId: accent ?? next.accentThemeId,
    });
    setHousehold(hydrated);
    const self = hydrated.members.find((member) => member.userId === user.id);
    if (self) setActiveMemberId(self.id);
    if (dataMode === 'mock') {
      await persistMockHouseholdSnapshot(hydrated);
    }
    if (hydrated.id) {
      await Promise.all([
        notificationsRepository.list(hydrated.id).then(setNotifications),
        rewardsRepository.getRedemptions(hydrated.id).then((items) => {
          setRedemptions(items);
          setPendingRedemptions(items.filter((item) => item.status === 'pending'));
        }),
        rewardsRepository.getAllowances(hydrated.id).then(setAllowances),
        smartHomeRepository.listDevices(hydrated.id).then(setSmartHomeDevices),
        smartHomeRepository.listScenes(hydrated.id).then(setSmartHomeScenes),
      ]);
      setStoreRecommendations(
        buildStoreRecommendations(hydrated.id, hydrated.groceries)
      );
      const links = await householdRepository.getInviteLink(hydrated.id);
      setInviteLinks(links);
      setHousehold((current) => ({ ...current, inviteCode: links.code }));
    }
    await refreshHouseholdMemberships(user.id);
    await trackAnalytics('household.switched', { householdId }, { householdId, userId: user.id });
  };

  const deleteHousehold = async () => {
    const user = currentUser ?? (await authRepository.getCurrentSession())?.user ?? null;
    if (!user?.id || !household.id) {
      throw new Error('No active household to delete.');
    }
    if (currentMember?.role !== 'owner') {
      throw new Error('Only the household owner can delete this household.');
    }
    const result = await householdRepository.requestHouseholdDeletion(household.id, user.id);
    const scheduledSnapshot = { ...household, deletionScheduledFor: result.scheduledFor };
    setHousehold(scheduledSnapshot);
    if (dataMode === 'mock') {
      await persistMockHouseholdSnapshot(scheduledSnapshot);
    }
    await refreshHouseholdMemberships(user.id);
    await trackAnalytics(
      'household.deletion_scheduled',
      { scheduledFor: result.scheduledFor },
      { householdId: household.id, userId: user.id }
    );
    return result;
  };

  const cancelHouseholdDeletion = async () => {
    const user = currentUser ?? (await authRepository.getCurrentSession())?.user ?? null;
    if (!user?.id || !household.id) {
      throw new Error('No active household.');
    }
    if (currentMember?.role !== 'owner') {
      throw new Error('Only the household owner can cancel deletion.');
    }
    await householdRepository.cancelHouseholdDeletion(household.id, user.id);
    const restored = { ...household, deletionScheduledFor: null, deletedAt: null };
    setHousehold(restored);
    if (dataMode === 'mock') {
      await persistMockHouseholdSnapshot(restored);
    }
    await refreshHouseholdMemberships(user.id);
    await trackAnalytics('household.deletion_cancelled', {}, { householdId: household.id, userId: user.id });
  };

  const restoreSidekickFromSession = async (session: SidekickSession): Promise<boolean> => {
    const normalizedCode = normalizeInviteCode(session.profileInviteCode);
    const user: OrbitUser = {
      id: `child-local-${session.memberId}`,
      email: `${session.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'kid'}@kids.choremaxx.local`,
      name: session.displayName,
      avatar: session.avatar ?? session.displayName.charAt(0).toUpperCase(),
      profileComplete: true,
    };

    setCurrentUser(user);
    setActiveMemberId(session.memberId);
    await authRepository.persistLocalSession(user, session.memberId);
    await clearSidekickSignedOut();

    const { setupSharedDeviceSession, selectDeviceProfile } = await import('@/lib/device/device-session');
    await setupSharedDeviceSession({
      profileMemberIds: [session.memberId],
      deviceLabel: `${session.displayName}'s device`,
      hostKind: 'sidekick',
    });
    await selectDeviceProfile(session.memberId);

    if (dataMode === 'supabase') {
      const sync = await fetchSidekickSync(normalizedCode);
      if (!sync) return false;
      await applySidekickSyncPayload(sync, { announceNewTasks: true });
      registerSidekickPushNotifications(normalizedCode).catch((error) => {
        console.warn('Sidekick push registration skipped', error);
      });
      return true;
    }

    const snapshot = await householdRepository.loadHouseholdById(session.householdId, user.id).catch(
      async () => {
        const active = await loadActiveMockHousehold();
        return (
          active ?? {
            ...mockHousehold,
            id: session.householdId,
            householdName: session.householdName ?? 'Household',
            greetingName: session.displayName,
            members: [],
          }
        );
      }
    );
    const hydrated = await hydrateHousehold({
      ...snapshot,
      id: session.householdId,
      householdName: session.householdName ?? snapshot.householdName,
      greetingName: session.displayName,
    });
    setHousehold(hydrated);
    const items = await notificationsRepository.list(hydrated.id);
    setNotifications(items);
    await persistMockHouseholdSnapshot(hydrated);
    void applyPlannedTasksForMember(session.memberId, session.householdId);
    return true;
  };

  const restoreSidekickSession = async (): Promise<boolean> => {
    const session = await loadSidekickSession();
    if (!session) return false;
    try {
      return await restoreSidekickFromSession(session);
    } catch (error) {
      console.warn('restoreSidekickSession', error);
      return false;
    }
  };

  const lookupProfileInvite = async (rawCode: string) => {
    const code =
      parseInvitePayload(rawCode) ?? (rawCode.trim() ? normalizeInviteCode(rawCode) : null);
    if (!code) return null;
    const lookedUp = await householdRepository.findChildByProfileCode(code);
    if (!lookedUp?.member) return null;
    return { member: lookedUp.member, householdName: lookedUp.householdName };
  };

  const completeProfileJoin = async (
    input: import('@/types/orbit').CompleteProfileJoinInput
  ): Promise<{ status: 'pending' | 'active' }> => {
    const normalizedCode =
      parseInvitePayload(input.code) ?? (input.code.trim() ? normalizeInviteCode(input.code) : null);
    const result = await householdRepository.completeProfileJoin(input);
    const user: OrbitUser = {
      id: `child-local-${result.member.id}`,
      email: `${input.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'kid'}@kids.choremaxx.local`,
      name: result.member.name,
      avatar: result.member.avatar,
      profileComplete: true,
    };

    await saveSidekickSession({
      memberId: result.member.id,
      householdId: result.householdId,
      profileInviteCode: normalizedCode ?? input.code.trim().toUpperCase(),
      displayName: result.member.name,
      avatar: result.member.avatar,
      householdName: result.householdName,
    });
    await clearSidekickSignedOut();

    let mergedSnapshot: HouseholdSnapshot;
    if (dataMode === 'supabase' && normalizedCode) {
      const sync = await fetchSidekickSync(normalizedCode);
      const base: HouseholdSnapshot = {
        ...createEmptyHousehold(user),
        id: result.householdId,
        householdName: result.householdName,
        greetingName: result.member.name,
        members: sync?.members.length ? sync.members : [result.member],
      };
      mergedSnapshot = sync
        ? await applySidekickSyncPayload(sync, { announceNewTasks: true, base })
        : base;
    } else {
      const snapshot = await householdRepository.loadHouseholdById(result.householdId, user.id).catch(
        async () => {
          const active = await loadActiveMockHousehold();
          return (
            active ?? {
              ...mockHousehold,
              id: result.householdId,
              householdName: result.householdName,
              members: [result.member],
              greetingName: result.member.name,
            }
          );
        }
      );
      mergedSnapshot = {
        ...snapshot,
        id: result.householdId,
        householdName: result.householdName,
        greetingName: result.member.name,
        members: snapshot.members.some((item) => item.id === result.member.id)
          ? snapshot.members.map((item) => (item.id === result.member.id ? result.member : item))
          : [...snapshot.members, result.member],
      };
    }

    setHousehold(mergedSnapshot);
    setCurrentUser(user);
    setActiveMemberId(result.member.id);
    await authRepository.persistLocalSession(user, result.member.id);

    if (result.status === 'active') {
      const { setupSharedDeviceSession, selectDeviceProfile } = await import(
        '@/lib/device/device-session'
      );
      await setupSharedDeviceSession({
        profileMemberIds: [result.member.id],
        deviceLabel: `${result.member.name}'s device`,
        hostKind: 'sidekick',
      });
      await selectDeviceProfile(result.member.id);
    } else if (result.householdId) {
      await stashPendingJoinHouseholdId(result.householdId);
    }

    if (dataMode === 'mock') {
      await persistMockHouseholdSnapshot(mergedSnapshot);
    }

    if (result.status === 'active') {
      void applyPlannedTasksForMember(result.member.id, result.householdId);
      if (normalizedCode) {
        registerSidekickPushNotifications(normalizedCode).catch((error) => {
          console.warn('Sidekick push registration skipped', error);
        });
      }
    }

    return { status: result.status };
  };

  const applyStashedInvite = async (): Promise<'pending' | 'active' | 'none'> => {
    const raw = await peekInviteCode();
    if (!raw) return 'none';
    const kind = classifyInviteCode(raw);
    if (kind !== 'household') return 'none';
    try {
      const outcome = await joinHousehold({ inviteCode: raw });
      if (outcome === 'signed_out') {
        return 'none';
      }
      await consumeInviteCode();
      return outcome;
    } catch (error) {
      console.warn('applyStashedInvite', error);
      const pendingId = await peekPendingJoinHouseholdId();
      const user = currentUser ?? (await authRepository.getCurrentSession())?.user ?? null;
      if (user && pendingId) {
        try {
          const result = await householdRepository.checkJoinApproval(user, pendingId);
          if (result.status === 'pending' || result.status === 'approved') {
            await consumeInviteCode();
            if (result.snapshot) setHousehold(result.snapshot);
            return 'active';
          }
        } catch (checkError) {
          console.warn('applyStashedInvite.check', checkError);
        }
      }
      await consumeInviteCode();
      return 'none';
    }
  };

  const checkJoinApproval = async (): Promise<'approved' | 'pending' | 'missing'> => {
    if (!currentUser) return 'missing';
    const pendingId = (await peekPendingJoinHouseholdId()) ?? household.id;
    const result = await householdRepository.checkJoinApproval(currentUser, pendingId);
    if (result.status === 'approved' && result.snapshot) {
      setHousehold(result.snapshot);
      const self = result.snapshot.members.find(
        (member) =>
          member.status === 'active' &&
          (member.userId === currentUser.id ||
            member.name.toLowerCase() === currentUser.name.toLowerCase())
      );
      if (self) {
        setActiveMemberId(self.id);
        void applyPlannedTasksForMember(self.id, result.snapshot.id);
      }
      await clearPendingJoinHouseholdId();
      if (dataMode === 'mock') {
        await persistMockHouseholdSnapshot(result.snapshot);
      }
      return 'approved';
    }
    return 'missing';
  };

  const redeemMemberInviteToken = async (
    token: string,
    clientRole?: string
  ): Promise<{ ok: true; memberStatus: 'active' | 'pending' } | { ok: false; message: string }> => {
    const user = currentUser ?? (await authRepository.getCurrentSession())?.user ?? null;
    if (!user) {
      return { ok: false, message: 'This invite is no longer valid. Ask an admin for a new one.' };
    }

    if (dataMode === 'mock') {
      const roster = householdRef.current.members.length
        ? householdRef.current.members
        : mockHousehold.members;
      const result = redeemMockMemberInvite({
        token,
        clientRole,
        authUserHouseholdId: currentMember ? householdRef.current.id : null,
        authUserMemberId: currentMember?.id ?? null,
        members: roster,
      });
      if (!result.ok) return result;
      const base = householdRef.current.members.length ? householdRef.current : mockHousehold;
      const storageRole = result.invite.role === 'sidekick' ? 'child' : 'admin';
      const next = applyRedeemedMember(
        base,
        result.invite.memberId,
        result.memberStatus,
        storageRole,
        user.id
      );
      setHousehold(next);
      setActiveMemberId(result.invite.memberId);
      await saveActiveMemberId(result.invite.memberId);
      await persistMockHouseholdSnapshot(next);
      if (result.memberStatus === 'pending' && next.id) {
        await stashPendingJoinHouseholdId(next.id);
      } else {
        await clearPendingJoinHouseholdId();
      }
      return { ok: true, memberStatus: result.memberStatus };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, message: 'This invite is no longer valid. Ask an admin for a new one.' };
    }
    const { data, error } = await supabase.functions.invoke('redeem-member-invite', {
      body: { token },
    });
    if (error) {
      const message =
        (typeof data === 'object' && data && 'error' in data && typeof (data as { error?: string }).error === 'string'
          ? (data as { error: string }).error
          : error.message) || 'This invite is no longer valid. Ask an admin for a new one.';
      return { ok: false, message };
    }
    const payload = data as {
      bootstrap?: {
        member?: { id?: string; status?: string; displayName?: string; role?: string; avatar?: string };
        household?: {
          id?: string;
          name?: string;
          sidekickGroceryAdd?: boolean;
          dailyDeadline?: string | null;
          rewardModel?: string | null;
        };
        todaysTasks?: Parameters<typeof mapTaskRow>[0][];
        members?: Parameters<typeof mapMemberRow>[0][];
      };
    };
    const memberId = payload.bootstrap?.member?.id;
    const householdId = payload.bootstrap?.household?.id;
    const memberStatus =
      payload.bootstrap?.member?.status === 'pending' ? 'pending' : 'active';
    if (!memberId) {
      return { ok: false, message: 'This invite is no longer valid. Ask an admin for a new one.' };
    }
    // A3.1 — bootstrap from this invoke is the only client round-trip. Do not hydrate.
    const boot = payload.bootstrap;
    if (boot?.household?.id) {
      setHousehold((current) => {
        let tasks = current.tasks;
        let members = current.members;
        try {
          if (Array.isArray(boot.todaysTasks) && boot.todaysTasks.length) {
            tasks = boot.todaysTasks.map((row) => mapTaskRow(row));
          }
          if (Array.isArray(boot.members) && boot.members.length) {
            members = boot.members.map((row) => mapMemberRow(row));
          }
        } catch (mapError) {
          console.warn('redeemMemberInviteToken bootstrap map', mapError);
        }
        return {
          ...current,
          id: boot.household?.id ?? current.id,
          householdName: boot.household?.name ?? current.householdName,
          sidekickGroceryAdd:
            boot.household?.sidekickGroceryAdd ?? current.sidekickGroceryAdd,
          dailyDeadline: boot.household?.dailyDeadline ?? current.dailyDeadline,
          tasks,
          members,
        };
      });
    }
    setActiveMemberId(memberId);
    await saveActiveMemberId(memberId);
    if (memberStatus === 'pending' && householdId) {
      await stashPendingJoinHouseholdId(householdId);
    } else {
      await clearPendingJoinHouseholdId();
    }
    return { ok: true, memberStatus };
  };


  const clearSignedInState = (options?: { skipProfilePick?: boolean; sidekickSigningOut?: boolean }) => {
    setCurrentUser(null);
    setHousehold(
      options?.sidekickSigningOut
        ? createEmptyHousehold({
            id: 'signed-out-sidekick',
            email: '',
            name: '',
            avatar: '',
            profileComplete: false,
          })
        : mockHousehold
    );
    setPendingRedemptions([]);
    setRedemptions([]);
    setNotifications([]);
    setInviteLinks(null);
    setActiveMemberId(null);
    if (!options?.skipProfilePick) {
      void import('@/lib/device/device-session').then(({ markNeedsProfilePick }) =>
        markNeedsProfilePick()
      );
    }
  };

  const signOut = async () => {
    const sidekickSigningOut = isSidekickRole(currentMember?.role);
    try {
      await authRepository.signOut();
    } catch (error) {
      console.warn('orbit.signOut', error);
      try {
        const { signOutEverywhere } = await import('@/lib/auth/local-sign-out');
        await signOutEverywhere();
      } catch (fallbackError) {
        console.warn('orbit.signOut.fallback', fallbackError);
      }
    }
    try {
      await trackAnalytics('auth.sign_out', {}, analyticsContext);
    } catch {
      /* never block leaving */
    }
    if (sidekickSigningOut) {
      await touchSidekickSession();
      await markSidekickSignedOut();
    } else {
      await clearMockHouseholdSnapshot();
    }
    clearSignedInState({ skipProfilePick: sidekickSigningOut, sidekickSigningOut });
  };

  const createTask = async (
    input: CreateTaskInput,
    options?: { householdId?: string | null; selfHomework?: boolean }
  ): Promise<HouseholdTask | null> => {
    const targetHouseholdId = options?.householdId ?? household.id;
    // Explicit householdId = onboarding materialize (owner perms not flushed yet).
    const allowOnboardingWrite = Boolean(options?.householdId && currentUser);
    const allowSelfHomework =
      options?.selfHomework === true &&
      canCreateSelfHomework(currentMember, input);
    if (
      !allowOnboardingWrite &&
      !allowSelfHomework &&
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
      const profileAuth = await usesProfileCodeAuth();
      const assigneeMember = assigneeMemberForTask(householdRef.current.members, input);
      const normalizedInput: CreateTaskInput = {
        ...input,
        proofRequired: isHomeworkCategory(input.category, input.title)
          ? proofRequiredForHomeworkAssign(input.category, assigneeMember)
          : false,
      };

      if (profileAuth && allowSelfHomework) {
        const task = await sidekickCreateHomework({ code: profileAuth.code, task: normalizedInput });
        setHousehold((current) => ({
          ...current,
          tasks: current.tasks.some((item) => item.id === task.id)
            ? current.tasks
            : [task, ...current.tasks],
        }));
        await trackAnalytics('task.created', { taskId: task.id }, analyticsContext);
        return task;
      }

      // Upsert so re-assigning the same library task today is not a silent UNIQUE no-op.
      const { task, inserted } = await taskRepository.upsertOccurrence(targetHouseholdId, normalizedInput);
      const nextHousehold = await new Promise<HouseholdSnapshot>((resolve) => {
        setHousehold((current) => {
          const already = current.tasks.some((item) => item.id === task.id);
          const nextTemplates: TaskTemplate[] =
            inserted && input.saveAsTemplate
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
            tasks: already ? current.tasks : [task, ...current.tasks],
            taskTemplates: nextTemplates,
          };
          resolve(next);
          return next;
        });
      });
      // Persist so getHousehold() → seedMockDomains cannot wipe newly assigned tasks.
      await persistMockHouseholdSnapshot(nextHousehold);
      if (inserted) {
        await trackAnalytics('task.created', { taskId: task.id }, analyticsContext);
        const prefs = nextHousehold.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
        await notifyTaskAssigned(
          pushNotification,
          nextHousehold,
          normalizedInput,
          task,
          prefs.tasks !== false
        );
      }
      return task;
    } catch (error) {
      console.warn('createTask failed', error);
      throw error instanceof Error ? error : new Error('Could not save the task.');
    }
  };

  const applyPlannedTasksForMember = async (memberId: string, targetHouseholdId?: string | null) => {
    const live = householdRef.current;
    const householdId = targetHouseholdId ?? live.id;
    if (!householdId) return;
    const member = live.members.find((item) => item.id === memberId);
    if (!member || !isMemberFullyConnected(member)) return;
    const planned = plannedTasksForMember(member, live.rewardMode ?? 'weighted');
    if (!planned.length) return;

    for (const task of planned) {
      await createTask(task, { householdId });
    }
    await householdRepository.clearPlannedTasks(memberId, householdId);
    setHousehold((current) => ({
      ...current,
      members: current.members.map((item) =>
        item.id === memberId ? { ...item, plannedTaskLibraryIds: undefined } : item
      ),
    }));
    await trackAnalytics(
      'member.planned_tasks_applied',
      { memberId, count: planned.length },
      { ...analyticsContext, householdId }
    );
  };

  const updateTask = async (
    task: HouseholdTask,
    options?: { scope?: 'this' | 'future' }
  ) => {
    if (!v2Permissions.canAssignOrEditTask && !permissions.canAssignTask) {
      return;
    }
    const live = householdRef.current;
    const current = live.tasks.find((item) => item.id === task.id);
    const scope = options?.scope ?? defaultSeriesScope(current, task);
    const nextTasks = current
      ? applySeriesPatch(
          live.tasks,
          current,
          {
            ...(task.repeat !== current.repeat ? { repeat: task.repeat } : {}),
            ...(task.assignee !== current.assignee ? { assignee: task.assignee } : {}),
            ...(task.title !== current.title ? { title: task.title } : {}),
            ...(task.category !== current.category ? { category: task.category } : {}),
          },
          scope
        ).map((row) =>
          row.id === task.id ? { ...row, ...task, definitionId: row.definitionId } : row
        )
      : live.tasks.map((item) => (item.id === task.id ? task : item));

    const before = new Map(live.tasks.map((item) => [item.id, item]));
    const changed = nextTasks.filter((row) => {
      const prev = before.get(row.id);
      if (!prev) return true;
      return (
        prev.repeat !== row.repeat ||
        prev.assignee !== row.assignee ||
        prev.title !== row.title ||
        prev.status !== row.status ||
        prev.due !== row.due ||
        prev.category !== row.category ||
        prev.xp !== row.xp ||
        prev.difficulty !== row.difficulty ||
        prev.description !== row.description ||
        prev.definitionId !== row.definitionId
      );
    });

    let persisted = nextTasks;
    for (const row of changed) {
      const saved = await taskRepository.updateTask(row);
      persisted = persisted.map((item) => (item.id === saved.id ? saved : item));
    }

    const nextHousehold = { ...live, tasks: persisted };
    setHousehold(nextHousehold);
    if (dataMode === 'mock') {
      await persistMockHouseholdSnapshot(nextHousehold);
    }
    await trackAnalytics('task.updated', { taskId: task.id, scope }, analyticsContext);
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
    const profileAuth = await usesProfileCodeAuth();
    let updated: HouseholdTask;
    if (profileAuth) {
      updated = await sidekickSubmitTaskProof({
        code: profileAuth.code,
        taskId,
        task: withProof,
        proofUri,
      });
    } else if (isSplitTask(currentTask) && currentTask.shares) {
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
    if (!profileAuth) {
      const created = await poppinsNotifications.proofSubmitted(pushNotification, prefs, {
        title: currentTask.title,
        assignee: forAssignee,
        taskId,
        proofUri,
        audienceRoles: [...PROOF_REVIEW_ROLES],
        homework: isHomeworkCategory(currentTask.category, currentTask.title),
      });
      if (created) {
        await scheduleLocalReminder(created.title, created.body, 2).catch((error) =>
          console.warn('Proof admin reminder skipped', error)
        );
      }
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
    void prefs;
    // Confirmation is silent to the helper — XP already landed; no Rev E registry id for "proof approved".
    await trackAnalytics('task.verification_confirmed', { taskId }, analyticsContext);
    return true;
  };

  const requestAnotherProof = async (taskId: string, note?: string) => {
    if (!v2Permissions.canRequestProof) return false;
    const currentTask = household.tasks.find((item) => item.id === taskId);
    if (!currentTask || !currentMember) return false;
    const assigneeMember = assigneeMemberForTask(household.members, currentTask);
    if (!canAdminRequestTaskProof(currentTask, assigneeMember)) return false;
    const result = requestAnotherProofOnTask(currentTask, currentMember.id, note);
    if (!result.ok) return false;
    const updated = await taskRepository.updateTask(result.task);
    setHousehold((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === taskId ? updated : item)),
    }));
    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    await poppinsNotifications.proofRequested(pushNotification, prefs, {
      title: currentTask.title,
      adminName: currentMember.name,
      taskId,
      audienceMemberIds: assigneeMember ? [assigneeMember.id] : undefined,
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
        if (!isMemberFullyConnected(member)) return member;
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
    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    const assigneeMember = assigneeMemberForTask(household.members, currentTask);
    await poppinsNotifications.taskNotDone(pushNotification, prefs, {
      title: currentTask.title,
      adminName: currentMember.name,
      taskId,
      audienceMemberIds: assigneeMember ? [assigneeMember.id] : undefined,
    });
    await trackAnalytics('task.marked_not_done', { taskId, reversed }, analyticsContext);
    return true;
  };

  const sendTaskReminder = async (taskId: string, memberId?: string): Promise<boolean> => {
    if (!v2Permissions.canAssignOrEditTask && !permissions.canAssignTask) return false;
    const task = household.tasks.find((item) => item.id === taskId);
    if (!task || !currentMember) return false;
    const assigneeMember =
      (memberId ? household.members.find((item) => item.id === memberId) : null) ??
      assigneeMemberForTask(household.members, task);
    if (!assigneeMember) return false;

    const open =
      task.status !== 'Completed' &&
      task.status !== 'Cancelled' &&
      task.status !== 'Expired' &&
      task.status !== 'Missed';
    if (!open) return false;

    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    const streak = assigneeMember.streak ?? 0;
    await poppinsNotifications.taskReminder(pushNotification, prefs, {
      title: task.title,
      adminName: currentMember.name,
      taskId,
      streak,
      audienceMemberIds: [assigneeMember.id],
    });
    await trackAnalytics('task.reminder_sent', { taskId, memberId: assigneeMember.id }, analyticsContext);
    return true;
  };

  const recessSkipAssignees = (live: typeof household, dateKey: string) => {
    const periods = live.recessPeriods ?? [];
    return live.members
      .filter((member) => isOnRecess(periods, member.id, dateKey))
      .map((member) => member.name);
  };

  const runOccurrenceCatchUp = async (snapshot?: typeof household) => {
    const live = snapshot ?? householdRef.current;
    const now = new Date();
    const expiryHm = getHouseRulesDoc().constants.expiryTime;
    let nextTasks = autoConfirmUnreviewed(live.tasks, now);

    // Cold-start: resolve intervening days (up to 14) then materialise today.
    const LOOKBACK_DAYS = 7;
    for (let offset = LOOKBACK_DAYS; offset >= 1; offset -= 1) {
      const day = new Date(now);
      day.setDate(day.getDate() - offset);
      const dayKey = formatLocalDate(day);
      nextTasks = rolloverMissedOccurrences(nextTasks, dayKey, now, {
        expiryHm,
        skipAssigneeNames: recessSkipAssignees(live, dayKey),
      });
      const dayDrafts = ensureOccurrencesForDay(
        nextTasks,
        day,
        householdDueTimeLocal(live, day),
        { skipAssignees: recessSkipAssignees(live, dayKey) }
      );
      for (const draft of dayDrafts) {
        const exists = nextTasks.some(
          (t) =>
            t.definitionId === draft.definitionId &&
            t.occurrenceDate === draft.occurrenceDate
        );
        if (exists || !live.id) continue;
        const row = await taskRepository.createTask(live.id, {
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
        const prefs = live.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
        await notifyTaskAssigned(
          pushNotification,
          live,
          {
            title: row.title,
            category: row.category,
            assignee: row.assignee,
            assignees: row.assignees,
            due: row.due,
            xp: row.xp,
            repeat: row.repeat,
            proofRequired: row.proofRequired,
          },
          row,
          prefs.tasks !== false
        );
      }
      // After creating past-day open rows, mark them missed if still pending.
      nextTasks = rolloverMissedOccurrences(nextTasks, dayKey, now, {
        expiryHm,
        skipAssigneeNames: recessSkipAssignees(live, dayKey),
      });
    }

    const todayKey = formatLocalDate(now);
    const todayDrafts = ensureOccurrencesForDay(
      nextTasks,
      now,
      householdDueTimeLocal(live, now),
      { skipAssignees: recessSkipAssignees(live, todayKey) }
    );
    const created: HouseholdTask[] = [];
    for (const draft of todayDrafts) {
      const exists = nextTasks.some(
        (t) =>
          t.definitionId === draft.definitionId &&
          t.occurrenceDate === draft.occurrenceDate
      );
      if (exists || !live.id) continue;
      const row = await taskRepository.createTask(live.id, {
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
      const prefs = live.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
      await notifyTaskAssigned(
        pushNotification,
        live,
        {
          title: row.title,
          category: row.category,
          assignee: row.assignee,
          assignees: row.assignees,
          due: row.due,
          xp: row.xp,
          repeat: row.repeat,
          proofRequired: row.proofRequired,
        },
        row,
        prefs.tasks !== false
      );
    }

    const merged = applyHouseholdTaskExpiry([...created, ...nextTasks], live, now);
    const relabeled = refreshStaleDueLabels(merged, now);
    const profileAuth = await usesProfileCodeAuth().catch(() => null);

    if (!profileAuth) {
      for (const task of relabeled) {
        const prev = live.tasks.find((t) => t.id === task.id);
        if (!prev) {
          if (isExpiredStatus(task.status)) {
            await taskRepository.updateTask(task).catch((error) => {
              console.warn('runOccurrenceCatchUp persist new', task.id, error);
            });
          }
          continue;
        }
        if (
          prev.verification !== task.verification ||
          prev.status !== task.status ||
          prev.due !== task.due
        ) {
          await taskRepository.updateTask(task).catch((error) => {
            console.warn('runOccurrenceCatchUp persist', task.id, error);
          });
        }
      }
    }

    setHousehold((current) => ({ ...current, tasks: relabeled }));
  };

  useEffect(() => {
    if (!household.id || isLoading) return;
    void runOccurrenceCatchUp();
    // One catch-up per household session mount / id change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household.id, isLoading]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && householdRef.current.id) {
        void runOccurrenceCatchUp(householdRef.current);
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tickExpiry = () => {
      const live = householdRef.current;
      if (!live.id) return;
      const now = new Date();
      const nextTasks = applyHouseholdTaskExpiry(live.tasks, live, now);
      const changed = tasksWithExpiryStatusChange(live.tasks, nextTasks);
      if (changed.length === 0) return;

      setHousehold((current) => ({ ...current, tasks: nextTasks }));

      void (async () => {
        const profileAuth = await usesProfileCodeAuth().catch(() => null);
        if (profileAuth) return;
        for (const task of changed) {
          await taskRepository.updateTask(task).catch((error) => {
            console.warn('tickExpiry persist', task.id, error);
          });
        }
      })();
    };
    const id = setInterval(tickExpiry, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!household.dailyDeadlinePending || !household.dailyDeadlineAppliesOn) return;
    const settled = settleDeadlineState(getHouseRulesDoc(), household);
    if (settled.dailyDeadlinePending !== null) return;
    setHousehold((current) => {
      if (!current.dailyDeadlinePending) return current;
      const next: HouseholdSnapshot = {
        ...current,
        dailyDeadline: settled.dailyDeadline,
        dailyDeadlinePending: null,
        dailyDeadlineAppliesOn: null,
      };
      persistHouseRulesHouseholdFields(current.id, next, {
        daily_deadline: settled.dailyDeadline,
        daily_deadline_pending: null,
        daily_deadline_applies_on: null,
      });
      return next;
    });
  }, [household.dailyDeadlinePending, household.dailyDeadlineAppliesOn, household.id]);

  const completeTask = async (taskId: string, options?: { forAssignee?: string }) => {
    const currentTask = household.tasks.find((item) => item.id === taskId);

    if (
      !currentTask ||
      currentTask.status === 'Completed' ||
      currentTask.status === 'Cancelled' ||
      isExpiredStatus(currentTask.status)
    ) {
      return null;
    }

    // Rev F §12.1 — only the assignee may complete. Admins cannot tick for others.
    const actorName = options?.forAssignee?.trim() || currentMember?.name;
    if (!actorName || !taskMatchesAssignee(currentTask, actorName)) {
      console.warn('completeTask blocked: actor is not the assignee', {
        actorName,
        assignee: currentTask.assignee,
      });
      return null;
    }
    // Shared-device / admin viewing someone else: still require the actor be on the task.
    if (
      currentMember &&
      !taskMatchesAssignee(currentTask, currentMember.name) &&
      !options?.forAssignee
    ) {
      return null;
    }

    const profileAuth = await usesProfileCodeAuth();

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
        const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
        await poppinsNotifications.trophyUnlocked(pushNotification, prefs, {
          trophy: unlock.name,
          audienceMemberIds: [member.id],
          memberName: member.name,
          memberId: member.id,
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
      const assigneeMember = assigneeMemberForTask(householdRef.current.members, { assignee: forAssignee });
      const wantsProof = needsProofOnComplete(currentTask, assigneeMember);
      const needsProof =
        wantsProof &&
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

      const saved = profileAuth
        ? await sidekickCompleteTask({
            code: profileAuth.code,
            taskId,
            task: nextTask,
            awardedXp: totalAwarded,
            completedAt,
            completedLate: late,
            verification: initialVerification(wantsProof),
            taskStatus: settled || everyoneDone ? 'completed' : 'in_progress',
            dueLabel: settled || everyoneDone ? 'Completed today' : nextTask.due,
            bonusAwards:
              everyoneDone && bonus > 0
                ? nextShares
                    .filter((item) => item.name !== forAssignee && item.status === 'Completed')
                    .map((item) => {
                      const memberRow = householdRef.current.members.find(
                        (mem) => mem.name === item.name
                      );
                      return memberRow
                        ? {
                            memberId: memberRow.id,
                            amount: bonus,
                            reason: `Split all-done bonus: ${currentTask.title}`,
                          }
                        : null;
                    })
                    .filter(
                      (row): row is { memberId: string; amount: number; reason: string } =>
                        row !== null
                    )
                : [],
          })
        : await taskRepository.updateTask(nextTask);
      if (!profileAuth) {
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
      if (!profileAuth) {
        await poppinsNotifications.taskCompleted(pushNotification, prefs, {
          title: currentTask.title,
          assignee: forAssignee,
          awardedXp: totalAwarded,
          penalty: latePenalty,
          late,
          taskId,
          audienceMemberIds: adminMemberIds(household.members),
        });
      }
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
    const assigneeMember = assigneeMemberForTask(household.members, currentTask);
    const wantsProof = needsProofOnComplete(currentTask, assigneeMember);
    const needsProof =
      wantsProof &&
      currentTask.proofStatus !== 'submitted' &&
      currentTask.proofStatus !== 'approved';

    const { awarded, penalty, late } = resolveCompletionXp(currentTask, rewardSettings);
    const lateMeta = completedLateFlag(completedAt, currentTask.dueAt);
    const verification = initialVerification(wantsProof);
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
      proofStatus: wantsProof
        ? currentTask.proofStatus === 'submitted' || currentTask.proofStatus === 'approved'
          ? currentTask.proofStatus
          : 'none'
        : 'none',
    };
    const completedTask = profileAuth
      ? await sidekickCompleteTask({
          code: profileAuth.code,
          taskId,
          task: completedWithXp,
          awardedXp: awarded,
          completedAt,
          completedLate: lateMeta.completedLate || late,
          verification,
          taskStatus: 'completed',
        })
      : await taskRepository.completeTask(completedWithXp, household.id);
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
    if (!profileAuth) {
      await poppinsNotifications.taskCompleted(pushNotification, prefs, {
        title: currentTask.title,
        assignee: currentTask.assignee,
        awardedXp: awarded,
        penalty,
        late,
        taskId,
        audienceMemberIds: adminMemberIds(household.members),
      });
    }
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
    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    await notifyTaskAssigned(
      pushNotification,
      { members: household.members, notificationPrefs: household.notificationPrefs },
      {
        title: saved.title,
        category: saved.category,
        assignee: trimmed,
        assignees: [trimmed],
        due: saved.due,
        xp: saved.xp,
        repeat: saved.repeat,
      },
      saved,
      prefs.tasks !== false
    );
    await trackAnalytics('task.reassigned', { taskId, assignee: trimmed }, analyticsContext);
  };

  const awardDailyStreak = async () => {
    if (!currentMember || !household.id) return null;
    if (!isMemberFullyConnected(currentMember)) return null;
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
    await trackAnalytics('task.cancelled', { taskId, scope }, analyticsContext);
  };

  const addMissingGrocery = async (input: CreateGroceryInput) => {
    const caps = resolveMemberCapabilities(household);
    const householdAllows = household.sidekickGroceryAdd === true;
    const canAdd =
      permissions.canManageGroceries ||
      (!isSidekickRole(currentMember?.role) && caps.allowGroceryAdd) ||
      groceryAddAllowedForSidekick({
        role: currentMember?.role,
        householdAllows,
      });
    if (!canAdd) {
      return;
    }
    if (isSidekickRole(currentMember?.role) && !householdAllows) {
      return;
    }
    const profileAuth = await usesProfileCodeAuth();
    const { classifyGroceryItem, categoryNameForId } = await import('@/lib/grocery/classify');
    let categoryId = input.categoryId;
    let categoryName = input.category?.trim();
    let itemName = input.name.trim();
    let quantity = input.quantity?.trim();

    if (input.productId && categoryId) {
      categoryName = categoryName || categoryNameForId(categoryId);
    } else {
      const classified = classifyGroceryItem(input.name, household.groceryCategoryOverrides);
      itemName = classified.itemName;
      categoryName = categoryName || classified.categoryName;
      categoryId = categoryId || classified.categoryId;
      quantity = quantity || classified.quantityDisplay || '1';
    }

    const grocery = profileAuth
      ? await sidekickAddGrocery({ code: profileAuth.code, item: {
          ...input,
          name: itemName,
          category: categoryName || 'Other',
          quantity: quantity || '1',
          categoryId,
          productId: input.productId,
          storeId: input.storeId ?? household.preferredStoreId,
          requestedBy: input.requestedBy ?? currentMember?.name,
        } })
      : await groceryRepository.addGroceryItem(household.id, {
          ...input,
          name: itemName,
          category: categoryName || 'Other',
          quantity: quantity || '1',
          categoryId,
          productId: input.productId,
          storeId: input.storeId ?? household.preferredStoreId,
          requestedBy: input.requestedBy ?? currentMember?.name,
        });
    setHousehold((current) => ({
      ...current,
      groceries: [grocery, ...current.groceries],
    }));
    await trackAnalytics('grocery.added', { groceryId: grocery.id }, analyticsContext);
  };

  const addGroceryFromProduct = async (productId: string) => {
    const { getCatalogProduct } = await import('@/lib/grocery/catalog');
    const { categoryNameForId } = await import('@/lib/grocery/classify');
    const product = getCatalogProduct(productId);
    if (!product) return;
    await addMissingGrocery({
      name: product.name,
      productId: product.id,
      categoryId: product.categoryId,
      category: categoryNameForId(product.categoryId),
    });
  };

  const toggleGroceryFavorite = (productId: string) => {
    setHousehold((current) => {
      const favs = current.groceryFavorites ?? [];
      const next = favs.includes(productId)
        ? favs.filter((id) => id !== productId)
        : [productId, ...favs].slice(0, 80);
      return { ...current, groceryFavorites: next };
    });
  };

  const listGroceryBuyAgain = () => household.groceryPurchaseHistory ?? [];

  const setPreferredStore = (storeId: string) => {
    if (!permissions.canManageGroceries && currentMember?.role === 'child') {
      return;
    }
    setHousehold((current) => ({ ...current, preferredStoreId: storeId }));
  };

  const markGroceryPurchased = async (itemId: string) => {
    if (isSidekickRole(currentMember?.role)) {
      return;
    }
    const currentItem = household.groceries.find((item) => item.id === itemId);

    if (!currentItem) {
      return;
    }

    const purchasedItem = await groceryRepository.markGroceryPurchased(currentItem, household.id);

    setHousehold((current) => ({
      ...current,
      groceries: current.groceries.map((item) => (item.id === itemId ? purchasedItem : item)),
      groceryPurchaseHistory: [
        currentItem.name,
        ...(current.groceryPurchaseHistory ?? []).filter((n) => n !== currentItem.name),
      ].slice(0, 60),
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
    if (isSidekickRole(currentMember?.role)) {
      return;
    }
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
    if (isSidekickRole(currentMember?.role)) {
      return;
    }
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

  const patchGroceryCategory = async (
    itemId: string,
    categoryId: string,
    overrides: Record<string, string>
  ) => {
    if (isSidekickRole(currentMember?.role)) {
      return;
    }
    const currentItem = household.groceries.find((item) => item.id === itemId);
    if (!currentItem) return;
    const { categoryNameForId } = await import('@/lib/grocery/classify');
    const categoryName = categoryNameForId(categoryId);
    const updated = await groceryRepository.updateGroceryCategory(
      currentItem,
      categoryName,
      categoryId,
      household.id
    );
    setHousehold((current) => ({
      ...current,
      groceryCategoryOverrides: overrides,
      groceries: current.groceries.map((item) => (item.id === itemId ? updated : item)),
    }));
    await trackAnalytics(
      'grocery.category_corrected',
      { groceryId: itemId, categoryId },
      analyticsContext
    );
  };

  const clearCheckedGroceries = async () => {
    if (!permissions.canManageHousehold && !permissions.canManageGroceries) {
      return;
    }
    const purchased = household.groceries.filter((item) => item.status === 'Purchased');
    const purchasedIds = purchased.map((item) => item.id);
    if (!purchasedIds.length) return;
    const historyNames = purchased.map((p) => p.name);
    await groceryRepository.removeGroceryItems(purchasedIds, household.id);
    const idSet = new Set(purchasedIds);
    setHousehold((current) => ({
      ...current,
      groceries: current.groceries.filter((item) => !idSet.has(item.id)),
      groceryPurchaseHistory: [
        ...historyNames,
        ...(current.groceryPurchaseHistory ?? []),
      ].slice(0, 60),
    }));
    await trackAnalytics('grocery.clear_checked', { count: purchasedIds.length }, analyticsContext);
  };

  const clearGroceryList = async () => {
    if (!permissions.canManageHousehold && !permissions.canManageGroceries) {
      return;
    }
    const activeIds = household.groceries
      .filter((item) => item.status === 'Missing' || item.status === 'Low' || item.status === 'Purchased')
      .map((item) => item.id);
    if (!activeIds.length) return;
    await groceryRepository.removeGroceryItems(activeIds, household.id);
    const idSet = new Set(activeIds);
    setHousehold((current) => ({
      ...current,
      groceries: current.groceries.filter((item) => !idSet.has(item.id)),
    }));
    await trackAnalytics('grocery.clear_list', { count: activeIds.length }, analyticsContext);
  };

  const markGroceriesOpened = () => {
    setHousehold((current) => ({
      ...current,
      groceriesLastOpenedAt: new Date().toISOString(),
    }));
  };

  const persistInboxRow = async (
    decision: ComposeDecision,
    input: {
      data?: Record<string, unknown>;
      userId?: string | null;
    }
  ): Promise<NotificationItem | null> => {
    if (!household.id) return null;
    if (decision.decision === 'drop' || decision.decision === 'activity_only') return null;

    const data = {
      ...(input.data ?? {}),
      urgency: decision.urgency,
      kind: decision.kind,
      mergeKey: decision.mergeKey,
      factIds: decision.factIds,
      cta: decision.cta,
    };

    if (decision.decision === 'merge' && decision.mergeKey) {
      const existing = notificationsRef.current.find(
        (row) => !row.isRead && String(row.data?.mergeKey ?? '') === decision.mergeKey
      );
      if (existing) {
        const updated = await notificationsRepository.updateCopy(
          existing.id,
          decision.title,
          decision.body,
          data
        );
        if (updated) {
          setNotifications((current) =>
            current.map((row) => (row.id === updated.id ? updated : row))
          );
        }
        return updated;
      }
    }

    const audienceRoles = input.data?.audienceRoles;
    const isAdminAudience =
      Array.isArray(audienceRoles) &&
      audienceRoles.some((role) => role === 'owner' || role === 'admin' || role === 'adult');
    const targetUserId = input.userId !== undefined ? input.userId : isAdminAudience ? null : currentUser?.id;

    const resolvedMemberIds = resolveAudienceMemberIds(household.members, data);
    const pushMemberIds =
      resolvedMemberIds.length > 0
        ? resolvedMemberIds
        : data.kind === 'task_completed'
          ? adminMemberIds(household.members)
          : [];

    const dataWithAudience =
      pushMemberIds.length > 0
        ? { ...data, audienceMemberIds: pushMemberIds }
        : data;

    const item = await notificationsRepository.create({
      householdId: household.id,
      title: decision.title,
      body: decision.body,
      category: decision.category,
      priority: decision.priority,
      data: dataWithAudience,
      userId: targetUserId,
    });
    setNotifications((current) => [item, ...current.filter((existing) => existing.id !== item.id)]);

    if (dataMode === 'supabase' && pushMemberIds.length > 0) {
      dispatchMemberPush(item.id);
    }

    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    const urgent = decision.urgency === 'needs_action' || decision.priority === 'high';
    const quietEnabled = prefs.quietHoursEnabled !== false;
    const deferBanner = quietEnabled && isQuietHour(new Date().getHours()) && !urgent;

    if (!deferBanner && decision.banner) {
      void presentLocalBanner(item.title, item.body, {
        ...(item.data ?? {}),
        notificationId: item.id,
        category: item.category,
      }).catch(() => undefined);
    }
    return item;
  };

  const maybeRewriteWithLuna = (
    item: NotificationItem,
    facts: HouseholdFact[],
    fallback: ComposeDecision
  ) => {
    if (!useLivePoppinsAi || !household.id) return;
    void composeWithLuna(facts, fallback, {
      householdId: household.id,
      role: currentMember?.role,
      unreadCount: notificationsRef.current.filter((row) => !row.isRead).length,
    }).then(async (next) => {
      if (next.title === item.title && next.body === item.body) return;
      const updated = await notificationsRepository.updateCopy(item.id, next.title, next.body);
      if (!updated) return;
      setNotifications((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    });
  };

  const flushGlanceFacts = async () => {
    const facts = glanceBufferRef.current.splice(0);
    if (!facts.length) return;
    const now = Date.now();
    const existing = notificationsRef.current.map((row) => ({
      kind: typeof row.data?.kind === 'string' ? row.data.kind : undefined,
      urgency: typeof row.data?.urgency === 'string' ? row.data.urgency : undefined,
      createdAt: row.createdAt,
      mergeKey: typeof row.data?.mergeKey === 'string' ? row.data.mergeKey : undefined,
      isRead: row.isRead,
    }));
    const insightAlreadyToday = notificationsRef.current.some((row) => {
      if (row.data?.urgency !== 'insight') return false;
      const d = new Date(row.createdAt);
      const n = new Date(now);
      return (
        d.getFullYear() === n.getFullYear() &&
        d.getMonth() === n.getMonth() &&
        d.getDate() === n.getDate()
      );
    });
    const decisions = coalesceFacts(facts, {
      now,
      existing,
      insightAlreadyToday,
      bannerSentMembers: glanceBannerMembersRef.current,
    });
    for (const decision of decisions) {
      const related = facts.filter((row) => decision.factIds.includes(row.id));
      const item = await persistInboxRow(decision, {
        data: {
          name: related[0]?.memberName,
          memberId: related[0]?.memberId,
          memberName: related[0]?.memberName,
        },
      });
      const bannerKey = related[0]?.memberId || related[0]?.memberName;
      if (decision.banner && bannerKey) {
        glanceBannerMembersRef.current.add(bannerKey);
      }
      if (item) maybeRewriteWithLuna(item, related, decision);
    }
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

    const fact = factFromNotificationInput(input);
    setPoppinsActivityFacts((current) => [fact, ...current].slice(0, 80));
    const lane = laneForKind(fact.kind);

    if (lane === 'activity_only') {
      return null;
    }

    if (lane === 'interrupt') {
      await flushGlanceFacts();
      const [decision] = coalesceFacts([fact], { now: Date.now() });
      if (!decision) return null;
      const item = await persistInboxRow(decision, input);
      if (item) maybeRewriteWithLuna(item, [fact], decision);
      return item;
    }

    if (lane === 'glance' || lane === 'insight') {
      glanceBufferRef.current.push(fact);
      if (glanceTimerRef.current) clearTimeout(glanceTimerRef.current);
      glanceTimerRef.current = setTimeout(() => {
        void flushGlanceFacts();
      }, GLANCE_FLUSH_MS);
      return null;
    }

    const passthrough: ComposeDecision = {
      decision: 'send',
      urgency: input.priority === 'high' || input.priority === 'critical' ? 'needs_action' : 'today',
      title: input.title,
      body: input.body,
      category: input.category,
      priority: input.priority ?? 'medium',
      kind: fact.kind,
      factIds: [fact.id],
      banner: true,
    };
    return persistInboxRow(passthrough, input);
  };

  const createEvent = async (input: CreateEventInput): Promise<HouseholdEvent | null> => {
    const caps = resolveMemberCapabilities(household);
    if (!permissions.canManageHousehold && !caps.allowCalendarCreate) {
      return null;
    }
    const approvalStatus = resolveEventApprovalStatus({
      actorRole: currentMember?.role,
      caps,
      category: input.category,
      explicit: input.approvalStatus,
    });
    const profileAuth = await usesProfileCodeAuth();
    const event = profileAuth
      ? await sidekickCreateEvent({
          code: profileAuth.code,
          event: {
            ...input,
            approvalStatus,
            createdByMemberId: input.createdByMemberId ?? currentMember?.id ?? null,
            responsibleMemberId:
              input.responsibleMemberId ??
              (isSidekickRole(currentMember?.role) ? currentMember?.id ?? null : null),
            attendeeMemberIds:
              input.attendeeMemberIds ??
              (isSidekickRole(currentMember?.role) && currentMember?.id
                ? [currentMember.id]
                : undefined),
          },
          memberName: currentMember?.name ?? profileAuth.memberId,
          memberId: currentMember?.id ?? profileAuth.memberId,
        })
      : await calendarRepository.createEvent(household.id, {
          ...input,
          approvalStatus,
          createdByMemberId: input.createdByMemberId ?? currentMember?.id ?? null,
          responsibleMemberId:
            input.responsibleMemberId ??
            (isSidekickRole(currentMember?.role) ? currentMember?.id ?? null : null),
          attendeeMemberIds:
            input.attendeeMemberIds ??
            (isSidekickRole(currentMember?.role) && currentMember?.id
              ? [currentMember.id]
              : undefined),
        });
    setHousehold((current) => ({
      ...current,
      events: [event, ...current.events.filter((item) => item.id !== event.id)],
    }));
    if (input.remindMe && approvalStatus === 'approved') {
      await scheduleLocalReminder(
        event.title,
        `${event.time} · ${event.responsible}`,
        20
      ).catch((error) => console.warn('Local reminder skipped', error));
    }
    await trackAnalytics(
      approvalStatus === 'pending' ? 'event.submitted' : 'event.created',
      { eventId: event.id, approvalStatus },
      analyticsContext
    );
    return event;
  };

  const approveEvent = async (eventId: string) => {
    if (!permissions.canManageHousehold) return;
    const existing = household.events.find((item) => item.id === eventId);
    if (!existing || existing.approvalStatus !== 'pending') return;
    const updated = { ...existing, approvalStatus: 'approved' as const };
    await updateEvent(updated);
    await trackAnalytics('event.approved', { eventId }, analyticsContext);
  };

  const rejectEvent = async (eventId: string) => {
    if (!permissions.canManageHousehold) return;
    const existing = household.events.find((item) => item.id === eventId);
    if (!existing || existing.approvalStatus !== 'pending') return;
    await deleteEvent(eventId);
    await trackAnalytics('event.rejected', { eventId }, analyticsContext);
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

  const remindAboutEvent = async (eventId: string, memberIds: string[]): Promise<boolean> => {
    const event = household.events.find((item) => item.id === eventId);
    if (!event || !currentMember) {
      return false;
    }

    const activeIds = new Set(
      household.members.filter((member) => member.status === 'active').map((member) => member.id)
    );
    const targets = memberIds.filter((id) => activeIds.has(id));
    if (!targets.length) {
      return false;
    }

    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    await poppinsNotifications.eventReminder(pushNotification, prefs, {
      title: event.title,
      adminName: currentMember.name,
      eventId,
      time: event.time,
      audienceMemberIds: targets,
    });

    if (targets.includes(currentMember.id)) {
      await scheduleLocalReminder(event.title, `${event.time} · ${event.responsible}`, 15).catch((error) =>
        console.warn('Local reminder skipped', error)
      );
    }

    await trackAnalytics('event.reminded', { eventId, memberIds: targets }, analyticsContext);
    return true;
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

  const updateMajordomoProfile = (profileId: string) => {
    if (!isMajordomoProfileId(profileId)) return;
    setHousehold((current) => {
      void saveMajordomoProfileId(current.id, profileId);
      return { ...current, majordomoProfileId: profileId };
    });
  };

  const updateMemberMajordomoProfile = (profileId: string | null) => {
    const memberId = activeMemberId;
    if (!memberId) return;
    if (profileId !== null && !isMajordomoProfileId(profileId)) return;
    setHousehold((current) => {
      void saveMemberMajordomoProfileId(
        current.id,
        memberId,
        profileId && isMajordomoProfileId(profileId) ? profileId : null
      );
      return {
        ...current,
        members: current.members.map((member) =>
          member.id === memberId
            ? { ...member, majordomoProfileId: profileId ?? undefined }
            : member
        ),
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

  const persistCustomHouseRules = (next: HouseholdSnapshot) => {
    if (dataMode === 'mock') {
      void persistMockHouseholdSnapshot(next);
    }
    if (dataMode === 'supabase' && next.id) {
      void persistCustomHouseRulesRows(next.id, next.customHouseRules ?? []).catch((error) => {
        console.warn('persistCustomHouseRules supabase skipped', error);
      });
    }
  };

  const addCustomHouseRule = (body: string) => {
    const existing = household.customHouseRules ?? [];
    const check = validateCustomHouseRule(body, existing.length);
    if (!check.ok) return check;
    if (!canEditHouseholdRewardLogic(household)) {
      return { ok: false as const, message: 'Only an admin can add house rules.' };
    }
    const rule = {
      id: newCustomHouseRuleId(),
      body: check.body,
      sortOrder: existing.length,
    };
    setHousehold((current) => {
      const list = [...(current.customHouseRules ?? []), rule];
      const next = { ...current, customHouseRules: list };
      persistCustomHouseRules(next);
      return next;
    });
    return { ok: true as const };
  };

  const updateCustomHouseRule = (id: string, body: string) => {
    const existing = household.customHouseRules ?? [];
    const check = validateCustomHouseRule(body, Math.max(0, existing.length - 1));
    if (!check.ok) return check;
    if (!canEditHouseholdRewardLogic(household)) {
      return { ok: false as const, message: 'Only an admin can edit house rules.' };
    }
    setHousehold((current) => {
      const next = {
        ...current,
        customHouseRules: (current.customHouseRules ?? []).map((item) =>
          item.id === id ? { ...item, body: check.body } : item
        ),
      };
      persistCustomHouseRules(next);
      return next;
    });
    return { ok: true as const };
  };

  const removeCustomHouseRule = (id: string) => {
    if (!canEditHouseholdRewardLogic(household)) return;
    setHousehold((current) => {
      const next = {
        ...current,
        customHouseRules: (current.customHouseRules ?? []).filter((item) => item.id !== id),
      };
      persistCustomHouseRules(next);
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

  const persistSavedPlaces = async (
    householdId: string | null | undefined,
    places: SavedPlace[]
  ) => {
    await placesRepository.saveAll(householdId, places);
    if (dataMode === 'mock') {
      await persistMockHouseholdSnapshot({ ...householdRef.current, savedPlaces: places });
    }
  };

  const upsertSavedPlace = (place: SavedPlace) => {
    let nextPlaces: SavedPlace[] = [];
    let householdId: string | null = null;
    setHousehold((current) => {
      householdId = current.id;
      const places = current.savedPlaces ?? [];
      const exists = places.some((item) => item.id === place.id);
      nextPlaces = exists
        ? places.map((item) => (item.id === place.id ? place : item))
        : [...places, place];
      return { ...current, savedPlaces: nextPlaces };
    });
    void persistSavedPlaces(householdId ?? householdRef.current.id, nextPlaces);
  };

  const removeSavedPlace = (placeId: string) => {
    let nextPlaces: SavedPlace[] = [];
    let householdId: string | null = null;
    setHousehold((current) => {
      householdId = current.id;
      nextPlaces = (current.savedPlaces ?? []).filter((item) => item.id !== placeId);
      return { ...current, savedPlaces: nextPlaces };
    });
    void persistSavedPlaces(householdId ?? householdRef.current.id, nextPlaces);
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

  const updateMemberHomeworkProof = async (memberId: string, required: boolean) => {
    if (!permissions.canManageHousehold) return;
    const member = household.members.find((item) => item.id === memberId);
    if (!member) return;
    const updated = await householdRepository.setMemberHomeworkProof(member, required);
    setHousehold((current) => ({
      ...current,
      members: current.members.map((item) => (item.id === memberId ? updated : item)),
    }));
    await trackAnalytics('member.homework_proof_toggled', { memberId, required }, analyticsContext);
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
    const quietEnabled = prefs.quietHoursEnabled !== false;
    const inQuiet = quietEnabled && isQuietHour(new Date().getHours());

    // Live edge monitor when OpenAI path is on; always merge local rule pass.
    const local = runMonitorPass(household, metrics, prefs);
    let actions = [...local.actions];
    let recommendations = [...local.recommendations];
    let notifications = [...local.notifications];

    if (useLivePoppinsAi && household.id) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data } = await supabase.functions.invoke('poppins-monitor', {
            body: {
              householdId: household.id,
              metrics,
              household: buildPoppinsHouseholdPayload(
                household,
                metrics,
                poppinsRecommendations
              ),
            },
          });
          if (data && typeof data === 'object' && Array.isArray((data as { actions?: unknown }).actions)) {
            const edgeActions = (data as { actions: Array<Record<string, unknown>> }).actions.map(
              (row, index) =>
                ({
                  id: `edge-${String(row.kind ?? 'monitor')}-${index}-${Date.now()}`,
                  kind: (String(row.kind ?? 'monitor') as PoppinsMonitorAction['kind']) || 'monitor',
                  label: String(row.label ?? 'Poppins'),
                  detail: String(row.detail ?? ''),
                  createdAt: new Date().toISOString(),
                  data: (row.data as Record<string, unknown> | undefined) ?? undefined,
                }) satisfies PoppinsMonitorAction
            );
            actions = [...edgeActions, ...actions];
          }
          if (typeof (data as { summary?: string } | null)?.summary === 'string') {
            recommendations = [
              {
                id: `edge-summary-${Date.now()}`,
                title: 'Poppins check-in',
                detail: String((data as { summary: string }).summary),
                tone: 'cyan',
              },
              ...recommendations,
            ];
          }
        }
      } catch (error) {
        console.warn('Poppins edge monitor skipped', error);
      }
    }

    // Quiet hours: keep Activity/recommendations; suppress non-urgent pushes.
    if (inQuiet) {
      notifications = notifications.filter(
        (n) => n.priority === 'high' || String(n.data?.kind ?? '') === 'deadline_reminder'
      );
    }

    setPoppinsMonitorActions(actions);
    setPoppinsRecommendations((current) => {
      const ids = new Set(recommendations.map((item) => item.id));
      return [...recommendations, ...current.filter((item) => !ids.has(item.id))];
    });

    const existing = await notificationsRepository.list(household.id);
    for (const note of notifications) {
      const kind = String(note.data?.kind ?? '');
      if (
        shouldSkipKindToday(existing, kind, {
          taskId: note.data?.taskId,
        })
      ) {
        continue;
      }
      const created = await pushNotification(note);
      if (created) {
        existing.unshift(created);
      }
    }

    if (!inQuiet) {
      const remaining = Math.max(0, DAILY_INSIGHT_CAP - countAiInsightsToday(existing));
      const candidates = buildDailyInsightCandidates(household)
        .filter((row) => !insightKindUsedToday(existing, row.kind))
        .slice(0, remaining);
      for (const candidate of candidates) {
        const fact: HouseholdFact = {
          id: `insight-${candidate.kind}`,
          at: Date.now(),
          kind: 'unknown',
          templateTitle: candidate.title,
          templateBody: candidate.body,
          extra: {
            catalogNames: candidate.catalogNames,
            storeName: candidate.storeName,
            storeSource: candidate.storeSource,
          },
        };
        const decision: ComposeDecision = {
          decision: 'send',
          urgency: 'insight',
          title: candidate.title,
          body: candidate.body,
          cta: candidate.cta,
          category: 'ai',
          priority: 'low',
          kind: candidate.kind,
          factIds: [fact.id],
          banner: false,
        };
        const item = await persistInboxRow(decision, {
          data: {
            kind: candidate.kind,
            urgency: 'insight',
            aiGenerated: true,
            catalogNames: candidate.catalogNames,
            storeName: candidate.storeName,
            storeSource: candidate.storeSource,
            audienceRoles: ['owner', 'admin', 'adult'],
            cta: candidate.cta,
          },
        });
        if (item) {
          existing.unshift(item);
          maybeRewriteWithLuna(item, [fact], decision);
        }
      }
    }

    await trackAnalytics('poppins.monitor_pass', { actions: actions.length }, analyticsContext);
    return actions;
  }, [analyticsContext, household, metrics, poppinsRecommendations, pushNotification]);

  // One Monitor pass per household session — do not retrigger when Activity is empty.
  useEffect(() => {
    if (isLoading || !household.id) return;
    if (monitorKickRef.current === household.id) return;
    monitorKickRef.current = household.id;
    const timer = setTimeout(() => {
      void runPoppinsMonitor().catch((error) => console.warn('Poppins monitor pass skipped', error));
    }, 800);
    return () => clearTimeout(timer);
  }, [household.id, isLoading, runPoppinsMonitor]);

  const executePoppinsToolCall = useCallback(
    async (
      name: PoppinsToolName,
      args: Record<string, unknown>,
      options?: { forceRiskyConfirmation?: boolean }
    ) => {
      const result = executePoppinsTool(name, args, household, metrics, {
        forceRiskyConfirmation: options?.forceRiskyConfirmation,
        viewingMemberId: currentMember?.id ?? null,
      });
      const action = toolResultToMonitorAction(name, args, result);
      setPoppinsMonitorActions((current) => [action, ...current]);

      if (result.recommendation && typeof result.recommendation === 'object') {
        const rec = result.recommendation as {
          title: string;
          detail: string;
          tone?: string;
        };
        setPoppinsRecommendations((current) => [
          {
            id: `tool-rec-${Date.now()}`,
            title: rec.title,
            detail: rec.detail,
            tone: (rec.tone as PoppinsRecommendation['tone']) ?? 'cyan',
          },
          ...current,
        ]);
      }

      if (result.notification && typeof result.notification === 'object' && !result.skipped) {
        const note = result.notification as {
          title: string;
          body: string;
          data?: Record<string, unknown>;
        };
        await pushNotification({
          title: note.title,
          body: note.body,
          category: 'ai',
          priority: 'medium',
          data: note.data,
        });
      }

      return result;
    },
    [household, metrics, pushNotification]
  );

  const askPoppins = async (question: string) => {
    if (isSidekickRole(currentMember?.role)) {
      return {
        question,
        answer: 'Poppins is not available on this profile.',
      };
    }
    if (summarizeAiUsage(aiUsageRef.current).tripped) {
      return { question, answer: POPPINS_PAUSED_COPY, source: 'meter' };
    }
    setPoppinsAskCount((count) => count + 1);
    const profileId = resolveMajordomoProfileId({
      householdProfileId: household.majordomoProfileId,
      memberProfileId: currentMember?.majordomoProfileId,
    });
    const answer = await poppinsRepository.askPoppins(
      question,
      { ...household, majordomoProfileId: profileId },
      metrics,
      poppinsConversation,
      currentUser?.id
    );
    await recordPoppinsUsage('chat', answer);
    setPoppinsConversation((current) => [
      ...current,
      { role: 'user', content: answer.question },
      { role: 'assistant', content: answer.answer },
    ]);
    if (answer.actions?.length) {
      setPoppinsMonitorActions((current) => [...answer.actions!, ...current]);
    }
    await trackAnalytics('poppins.asked', { questionLength: question.length }, analyticsContext);
    return attachIntentActions(question, answer, {
      existingTasks: household.tasks,
      memberNames: household.members.map((member) => member.name),
      selfName: currentMember?.name,
    }) as typeof answer;
  };

  const askPoppinsVoice = async (audioUri: string | null) => {
    if (isSidekickRole(currentMember?.role)) {
      return {
        question: '',
        answer: 'Poppins is not available on this profile.',
      };
    }
    if (summarizeAiUsage(aiUsageRef.current).tripped) {
      return { question: '', answer: POPPINS_PAUSED_COPY, source: 'meter' };
    }
    const { transcribeAndAskPoppins } = await import('@/lib/voice/poppins-voice');
    setPoppinsAskCount((count) => count + 1);
    const answer = await transcribeAndAskPoppins(audioUri, household, metrics);
    await recordPoppinsUsage('voice', answer);
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
    return attachIntentActions(answer.question, answer, {
      existingTasks: household.tasks,
      memberNames: household.members.map((member) => member.name),
      selfName: currentMember?.name,
    }) as typeof answer;
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

    // Shared iPad is a device shell — land on a linked account so XP/redeem work.
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
    const approved = await householdRepository.approveMember(memberId);
    if (dataMode === 'supabase') {
      await reloadHouseholdDomains();
    } else {
      setHousehold((current) => ({
        ...current,
        members: current.members.map((item) =>
          item.id === memberId
            ? { ...item, status: 'active', userId: approved.userId ?? item.userId ?? null }
            : item
        ),
      }));
      setActiveMemberId(null);
    }
    await applyPlannedTasksForMember(memberId);
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
    setNotifications((current) =>
      current.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item))
    );

    try {
      const profileAuth = await sidekickNotificationAuth();
      if (profileAuth) {
        await sidekickMarkNotificationRead({
          code: profileAuth.code,
          notificationId,
        });
      } else {
        await notificationsRepository.markRead(notificationId);
      }
    } catch (error) {
      console.warn('markNotificationRead', notificationId, error);
    }

    await trackAnalytics('notification.read', { notificationId }, analyticsContext);
  };

  const dismissInboxItem = async (notificationId: string) => {
    if (notificationId === 'morning-brief') {
      if (!household.id) return;
      const ymd = formatLocalDate(new Date());
      await AsyncStorage.setItem(`orbit.poppins.brief-dismissed.${household.id}`, ymd);
      setBriefDismissedYmd(ymd);
      return;
    }
    const current = notificationsRef.current.find((item) => item.id === notificationId);
    if (!current) return;

    const memberId = currentMemberRef.current?.id;
    const data = memberId
      ? withMemberDismissed(current.data, memberId)
      : { ...(current.data ?? {}), dismissed: true };

    // Optimistic local hide — never wait on network for the X to feel deleted.
    setNotifications((rows) =>
      rows.map((item) =>
        item.id === notificationId ? { ...item, isRead: true, data } : item
      )
    );

    try {
      const profileAuth = await sidekickNotificationAuth();
      if (profileAuth) {
        await sidekickDismissNotification({
          code: profileAuth.code,
          notificationId,
          memberId: profileAuth.memberId,
        });
      } else if (memberId) {
        await notificationsRepository.dismissForMember(notificationId, memberId);
      } else {
        await notificationsRepository.updateCopy(current.id, current.title, current.body, data);
        await notificationsRepository.markRead(notificationId);
      }
    } catch (error) {
      console.warn('dismissInboxItem', notificationId, error);
    }

    await trackAnalytics('notification.dismissed', { notificationId }, analyticsContext);
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
    if (isSidekickRole(currentMember.role)) {
      const gate = canRequestReward(currentMember.name, household.tasks);
      if (!gate.allowed) {
        throw new Error("Finish today's tasks and homework to ask for a reward.");
      }
    }
    const caps = resolveMemberCapabilities(household);
    // Users redeem; admins may also redeem for testing.
    if (!permissions.canManageHousehold && !caps.allowRewardRedeem) {
      return;
    }

    const reward = household.rewards.find((item) => item.id === rewardId);
    const origin =
      reward?.specialRequest || reward?.origin === 'special-request' ? 'requested' : 'earned';
    const redemption = await rewardsRepository.requestRedemption({
      householdId: household.id,
      rewardId,
      memberId: currentMember.id,
      note,
      rewardName: reward?.title,
      origin,
    });
    setPendingRedemptions((current) => [redemption, ...current.filter((item) => item.id !== redemption.id)]);
    setRedemptions((current) => [redemption, ...current.filter((item) => item.id !== redemption.id)]);
    const prefs = household.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS;
    const created = await poppinsNotifications.rewardRequested(pushNotification, prefs, {
      title: reward?.title ?? 'a reward',
      memberName: currentMember.name,
      redemptionId: redemption.id,
      audienceRoles: [...REWARD_REVIEW_ROLES],
      isNewAsk: Boolean(reward?.specialRequest || reward?.origin === 'special-request'),
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
    if (isSidekickRole(currentMember.role)) {
      const gate = canRequestReward(currentMember.name, household.tasks);
      if (!gate.allowed) {
        throw new Error("Finish today's tasks and homework to ask for a reward.");
      }
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
      rewardName: reward.title,
      origin: 'earned',
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

  const requestSpecialReward = async (title: string, note?: string, _cost = 0) => {
    if (!household.id || !currentMember) {
      return;
    }
    if (isSidekickRole(currentMember.role)) {
      const caps = resolveMemberCapabilities(household);
      if (!caps.allowSpecialRewardRequest) {
        throw new Error('Reward suggestions are turned off for Sidekicks in your household.');
      }
      const gate = canRequestReward(currentMember.name, household.tasks);
      if (!gate.allowed) {
        throw new Error("Finish today's tasks and homework to ask for a reward.");
      }
      const existing = household.rewardProposals ?? [];
      const cadence = canProposeReward({
        hasOpenProposal: existing.some(
          (item) => item.memberId === currentMember.id && item.status === 'open'
        ),
        lastProposedAt: existing
          .filter((item) => item.memberId === currentMember.id)
          .map((item) => item.createdAt)
          .filter(Boolean)
          .sort()
          .at(-1),
      });
      if (!cadence.ok) {
        throw new Error(
          cadence.reason === 'open'
            ? 'You already have a suggestion waiting.'
            : 'You can suggest another reward in a few days.'
        );
      }
      const proposal: RewardProposal = {
        id: `proposal-${currentMember.id}-${Date.now()}`,
        householdId: household.id,
        memberId: currentMember.id,
        memberName: currentMember.name,
        title: title.trim(),
        note: note?.trim() || undefined,
        status: 'open',
        createdAt: new Date().toISOString(),
      };
      setHousehold((current) => ({
        ...current,
        rewardProposals: [proposal, ...(current.rewardProposals ?? [])],
      }));
      if (dataMode === 'supabase' && isPersistedHouseholdId(household.id)) {
        await getSupabaseClient()?.rpc('submit_reward_proposal', {
          p_title: proposal.title,
          p_note: proposal.note ?? null,
        });
      }
      return;
    }
    const caps = resolveMemberCapabilities(household);
    if (!permissions.canManageHousehold && !caps.allowSpecialRewardRequest) {
      return;
    }
    const reward = await rewardsRepository.createReward(household.id, {
      title,
      cost: 0,
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

  const approveRewardProposal = async (proposalId: string) => {
    if (!permissions.canManageHousehold) return;
    const proposal = (household.rewardProposals ?? []).find((item) => item.id === proposalId);
    if (!proposal || proposal.status !== 'open') return;
    const reward = await rewardsRepository.createReward(household.id, {
      title: proposal.title,
      cost: 0,
      approvalRequired: true,
      assignedMemberId: proposal.memberId,
      assignedMemberName: proposal.memberName,
      origin: 'minted',
      createdByMemberId: currentMember?.id,
      createdByName: currentMember?.name,
    });
    setHousehold((current) => ({
      ...current,
      rewards: [reward, ...current.rewards.filter((item) => item.id !== reward.id)],
      rewardProposals: (current.rewardProposals ?? []).map((item) =>
        item.id === proposalId
          ? { ...item, status: 'approved' as const, decidedAt: new Date().toISOString() }
          : item
      ),
    }));
    if (dataMode === 'supabase' && isPersistedHouseholdId(household.id)) {
      await getSupabaseClient()?.rpc('decide_reward_proposal', {
        p_proposal_id: proposalId,
        p_approve: true,
      });
    }
  };

  const declineRewardProposal = async (proposalId: string) => {
    if (!permissions.canManageHousehold) return;
    setHousehold((current) => ({
      ...current,
      rewardProposals: (current.rewardProposals ?? []).map((item) =>
        item.id === proposalId
          ? { ...item, status: 'declined' as const, decidedAt: new Date().toISOString() }
          : item
      ),
    }));
    if (dataMode === 'supabase' && isPersistedHouseholdId(household.id)) {
      await getSupabaseClient()?.rpc('decide_reward_proposal', {
        p_proposal_id: proposalId,
        p_approve: false,
      });
    }
  };

  const updateSidekickGroceryAdd = (enabled: boolean) => {
    if (!permissions.canManageHousehold) return;
    setHousehold((current) => {
      const next: HouseholdSnapshot = { ...current, sidekickGroceryAdd: enabled };
      if (dataMode === 'mock') {
        void persistMockHouseholdSnapshot(next);
      }
      if (dataMode === 'supabase' && current.id && isPersistedHouseholdId(current.id)) {
        void getSupabaseClient()
          ?.from('households')
          .update({ sidekick_grocery_add: enabled })
          .eq('id', current.id);
      }
      return next;
    });
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
      // Assigned rewards surface in-app; no closed-registry notification for assignment.
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
    setRedemptions((current) => {
      const exists = current.some((item) => item.id === redemptionId);
      if (exists) {
        return current.map((item) => (item.id === redemptionId ? updated : item));
      }
      return [updated, ...current];
    });
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
    const caps = resolveMemberCapabilities(household);
    if (!permissions.canManageHousehold) {
      if (!caps.allowAllowance) {
        throw new Error('Allowance is turned off for members in your household.');
      }
      if (household.allowanceRequestsEnabled === false) {
        throw new Error('Allowance requests are turned off. Ask a parent to enable them in Settings.');
      }
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
    // Member allowance requests surface in Allowance tab — no unlisted push (Rev E §2).
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
    let updated: HouseholdMember | null = null;
    if (role === 'admin') {
      const result = await promoteMemberToAdmin({
        householdId: household.id ?? 'local',
        actorIsOwner: currentMember?.role === 'owner',
        targetId: memberId,
        readMembers: () =>
          dataMode === 'mock' ? mockHousehold.members : householdRef.current.members,
        writeAdmin: async () => {
          updated = await householdRepository.updateMemberRole(member, 'admin');
        },
      });
      if (!result.ok) {
        throw new Error(result.message);
      }
    } else {
      updated = await householdRepository.updateMemberRole(member, role);
    }
    if (!updated) return;
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

    const existingMembers =
      household.id === householdId ? household.members : [];

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
    drafts: {
      name: string;
      role: 'admin' | 'member';
      avatar?: string;
      plannedTaskLibraryIds?: string[];
      joinPreApproved?: boolean;
    }[],
    options?: { householdName?: string }
  ) => {
    if (!currentUser || !householdId) {
      throw new Error('Create your household first, then add members.');
    }
    const householdName = options?.householdName ?? household.householdName;
    const created: HouseholdMember[] = [];
    const roster =
      household.id === householdId ? household.members : [];

    for (const draft of drafts) {
      const name = draft.name.trim();
      if (!name) continue;
      const role = draft.role === 'admin' ? 'admin' : 'child';
      const already = roster.find(
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
        avatar: draft.avatar,
        plannedTaskLibraryIds: draft.plannedTaskLibraryIds,
        joinPreApproved: draft.joinPreApproved,
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

    if (classifyInviteCode(code) === 'household') {
      throw new Error(householdInviteWrongForKidMessage(code));
    }

    const record = await loadChildInviteRecord(code);
    const lookedUp = await householdRepository.findChildByProfileCode(code);
    const fromHousehold =
      resolveMemberByProfileCode(code, household.members) ??
      resolveMemberByProfileCode(code, mockHousehold.members);
    const member = record?.member ?? lookedUp?.member ?? fromHousehold;

    if (!member || member.role !== 'child' || (member.status !== 'active' && member.status !== 'invited')) {
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
    } else if (lookedUp) {
      setHousehold((current) => {
        const exists = current.members.some((item) => item.id === member.id);
        return {
          ...current,
          id: lookedUp.householdId,
          householdName: lookedUp.householdName,
          greetingName: member.name,
          members: exists
            ? current.members.map((item) => (item.id === member.id ? { ...item, ...member } : item))
            : [member, ...current.members.filter((item) => item.role === 'owner')],
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
      hostKind: 'sidekick',
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
      if (!member || (member.status !== 'active' && member.status !== 'invited') || member.role === 'shared-device') {
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
      deviceLabel: deviceLabel?.trim() || 'Family iPad',
      hostKind: 'shared-tablet',
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

  const deleteAccount = async (feedback?: { reason: string; detail?: string }) => {
    await authRepository.deleteAccount(feedback);
    await trackAnalytics(
      'auth.account_deleted',
      {
        reason: feedback?.reason ?? null,
        has_detail: Boolean(feedback?.detail?.trim()),
      },
      analyticsContext
    );
    await clearMockHouseholdSnapshot();
    clearSignedInState();
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
      inboxBriefing,
      poppinsRecommendations,
      poppinsMonitorActions,
      poppinsActivityFacts,
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
        (!isSidekickRole(currentMember?.role) &&
          resolveMemberCapabilities(household).allowGroceryAdd) ||
        groceryAddAllowedForSidekick({
          role: currentMember?.role,
          householdAllows: household.sidekickGroceryAdd === true,
        }),
      askPoppins,
      askPoppinsVoice,
      aiUsageEvents,
      recordPoppinsUsage,
      appendPoppinsTurn,
      switchPersona,
      approveMember,
      declineMember,
      setMemberJoinPreApproved,
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
      addGroceryFromProduct,
      toggleGroceryFavorite,
      listGroceryBuyAgain,
      setPreferredStore,
      joinHousehold,
      applyStashedInvite,
      checkJoinApproval,
      redeemMemberInviteToken,
      markGroceryPurchased,
      markGroceryMissing,
      markGroceryLow,
      patchGroceryCategory,
      clearCheckedGroceries,
      clearGroceryList,
      markGroceriesOpened,
      createEvent,
      updateEvent,
      deleteEvent,
      approveEvent,
      rejectEvent,
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
      dismissInboxItem,
      markAllNotificationsRead,
      pushNotification,
      updateNotificationPrefs,
      updateMajordomoProfile,
      updateMemberMajordomoProfile,
      updateMemberCapabilities,
      updateHouseholdRewardSettings,
      updateHouseholdRewardModel,
      queueDailyDeadline,
      setAllowanceRequestsEnabled,
      setJoinApprovalRequired,
      completeProfileJoin,
      lookupProfileInvite,
      householdMemberships,
      isGuestInActiveHousehold,
      switchHousehold,
      deleteHousehold,
      cancelHouseholdDeletion,
      addCustomHouseRule,
      updateCustomHouseRule,
      removeCustomHouseRule,
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
      updateMemberHomeworkProof,
      upsertRoom,
      removeRoom,
      runPoppinsMonitor,
      executePoppinsToolCall,
      requestRewardRedemption,
      claimReward,
      requestSpecialReward,
      approveRewardProposal,
      declineRewardProposal,
      updateSidekickGroceryAdd,
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
      restoreSidekickSession,
      sendTaskReminder,
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
      aiUsageEvents,
      recordPoppinsUsage,
      poppinsConversation,
      poppinsBriefing,
      inboxBriefing,
      poppinsRecommendations,
      poppinsMonitorActions,
      poppinsActivityFacts,
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
      executePoppinsToolCall,
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
      updateMemberHomeworkProof,
      upsertRoom,
      removeRoom,
      updateMemberCapabilities,
      updateHouseholdRewardSettings,
      updateHouseholdRewardModel,
      queueDailyDeadline,
      setAllowanceRequestsEnabled,
      setJoinApprovalRequired,
      setMemberJoinPreApproved,
      householdMemberships,
      isGuestInActiveHousehold,
      addCustomHouseRule,
      updateCustomHouseRule,
      removeCustomHouseRule,
      updateDisplayName,
      updateMemberDisplayName,
      addOnboardingMembers,
      redeemStreak,
      updateMajordomoProfile,
      updateMemberMajordomoProfile,
      redeemMemberInviteToken,
      approveRewardProposal,
      declineRewardProposal,
      updateSidekickGroceryAdd,
    ]
  );

  return <OrbitContext.Provider value={value}>{children}</OrbitContext.Provider>;
}

async function hydrateHousehold(baseHousehold: HouseholdSnapshot): Promise<HouseholdSnapshot> {
  if (isPendingJoinSnapshot(baseHousehold) || !baseHousehold.id) {
    return baseHousehold;
  }
  const householdId = baseHousehold.id;
  const skipLiveRewards = dataMode !== 'mock' && !isPersistedHouseholdId(householdId);
  const [tasks, groceries, events, rewards, badges, itineraries, themeId, savedRooms, avatarOverrides, storedPlaces] =
    await Promise.all([
      taskRepository.getTasks(householdId),
      groceryRepository.getGroceries(householdId),
      calendarRepository.getEvents(householdId),
      skipLiveRewards ? Promise.resolve(baseHousehold.rewards ?? []) : rewardsRepository.getRewards(householdId),
      skipLiveRewards ? Promise.resolve(baseHousehold.badges ?? []) : rewardsRepository.getBadges(householdId),
      itineraryRepository.list(householdId),
      loadAccentThemeId(householdId),
      loadHouseholdRooms(householdId),
      loadMemberAvatarOverrides(householdId),
      placesRepository.list(householdId),
    ]);
  const withAvatars = baseHousehold.members.map((member) =>
    avatarOverrides[member.id] ? { ...member, avatar: avatarOverrides[member.id] } : member,
  );
  const members = await applyStoredMemberThemes(householdId, withAvatars);
  const majordomo = await applyStoredMajordomoProfiles(
    householdId,
    members,
    baseHousehold.majordomoProfileId
  );
  const initialHousehold: HouseholdSnapshot = await applyStoredHouseholdLogicPrefs({
    ...baseHousehold,
    members: majordomo.members,
    badges,
    events,
    groceries,
    rewards,
    tasks,
    itineraries: itineraries.length > 0 ? itineraries : baseHousehold.itineraries ?? [],
    savedPlaces: mergeHydratedPlaces(storedPlaces, baseHousehold.savedPlaces),
    taskTemplates: baseHousehold.taskTemplates ?? [],
    notificationPrefs: baseHousehold.notificationPrefs ?? DEFAULT_POPPINS_NOTIFICATION_PREFS,
    preferredStoreId: baseHousehold.preferredStoreId ?? 'store-freshmart',
    accentThemeId: themeId || baseHousehold.accentThemeId || DEFAULT_ACCENT_THEME_ID,
    majordomoProfileId: majordomo.householdProfileId,
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
    (member) =>
      isMemberFullyConnected(member) && member.role !== 'guest' && !isSharedDeviceRole(member.role),
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

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamp = string;

export type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  apple_sub: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type HouseholdRow = {
  id: string;
  name: string;
  household_type: string;
  owner_id: string;
  timezone: string;
  country: string | null;
  reward_mode?: 'weighted' | 'flat';
  reward_model?: 'xp_only' | 'allowance' | 'xp_rewards' | 'xp_allowance' | 'full';
  hygiene_rewarded?: boolean;
  hygiene_xp?: 5 | 10;
  member_capabilities?: Record<string, boolean> | null;
  daily_deadline?: string | null;
  daily_deadline_pending?: string | null;
  daily_deadline_applies_on?: string | null;
  allowance_requests_enabled?: boolean | null;
  join_approval_required?: boolean | null;
  /** Revision G — household-level, default off. */
  sidekick_grocery_add?: boolean | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type HouseholdMemberRow = {
  id: string;
  household_id: string;
  user_id: string | null;
  display_name: string | null;
  role: 'owner' | 'admin' | 'adult' | 'child' | 'guest' | 'shared-device';
  status: 'invited' | 'pending' | 'active' | 'removed';
  avatar_symbol: string | null;
  xp: number;
  week_xp: number;
  streak: number;
  load_share: number;
  /** Member ids who use this shared phone/tablet profile. */
  shared_with_member_ids?: string[] | null;
  /** Kid / shared-device invite, e.g. CMX-EMMA. */
  profile_invite_code?: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type HouseholdInviteRow = {
  id: string;
  household_id: string;
  invite_code: string;
  invite_link: string | null;
  created_by: string | null;
  expires_at: Timestamp | null;
  max_uses: number | null;
  uses: number;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type TaskRow = {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  category: string;
  assignee_name: string;
  assignee_member_id: string | null;
  due_label: string;
  due_at: Timestamp | null;
  xp_value: number;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  weight: number | null;
  mental_load_value: number;
  proof_required: boolean;
  proof_uri: string | null;
  proof_status: 'none' | 'submitted' | 'approved' | 'rejected' | null;
  room_id: string | null;
  repeat_rule: 'none' | 'daily' | 'weekly' | 'weekdays';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
  created_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type GroceryItemRow = {
  id: string;
  household_id: string;
  name: string;
  category: string;
  quantity: string;
  location: 'fridge' | 'freezer' | 'pantry' | 'bathroom' | 'cleaning';
  status: 'available' | 'low' | 'missing' | 'purchased';
  note: string | null;
  barcode: string | null;
  typical_price: number | null;
  sale_price: number | null;
  aisle: string | null;
  store_id: string | null;
  requested_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type GroceryPurchaseHistoryRow = {
  id: string;
  household_id: string;
  grocery_item_id: string | null;
  name: string;
  category: string | null;
  purchased_at: Timestamp;
  store_id: string | null;
  created_at: Timestamp;
};

export type CalendarEventRow = {
  id: string;
  household_id: string;
  title: string;
  category: 'school' | 'activity' | 'appointment' | 'family' | 'routine';
  date_label: string;
  time_label: string;
  starts_at: Timestamp | null;
  ends_at: Timestamp | null;
  location: string | null;
  responsible_name: string;
  responsible_member_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type RewardRow = {
  id: string;
  household_id: string;
  title: string;
  cost: number;
  approval_required: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type RewardRedemptionRow = {
  id: string;
  household_id: string;
  reward_id: string;
  member_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  requested_at: Timestamp;
  decided_at: Timestamp | null;
  decided_by: string | null;
  note: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type BadgeRow = {
  id: string;
  household_id: string;
  title: string;
  icon: string;
  progress: number;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type XPTransactionRow = {
  id: string;
  household_id: string;
  user_id: string | null;
  member_id: string | null;
  amount: number;
  reason: string;
  related_task_id: string | null;
  created_at: Timestamp;
};

export type HouseholdScoreRow = {
  id: string;
  household_id: string;
  task_completion_rate: number;
  grocery_readiness: number;
  calendar_coverage: number;
  participation_rate: number;
  mental_load_balance: number;
  momentum_score: number;
  created_at: Timestamp;
};

export type AiBriefingRow = {
  id: string;
  household_id: string;
  briefing_type: 'daily' | 'weekly';
  title: string;
  summary: string;
  actions: string[];
  metadata: Json;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type AiConversationRow = {
  id: string;
  household_id: string;
  user_id: string;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type AiMessageRow = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: Timestamp;
};

export type NotificationRow = {
  id: string;
  household_id: string;
  user_id: string | null;
  title: string;
  body: string;
  category: 'tasks' | 'groceries' | 'events' | 'rewards' | 'ai' | 'general' | 'members';
  priority: 'low' | 'medium' | 'high' | 'critical';
  is_read: boolean;
  data: Json;
  scheduled_for: Timestamp | null;
  sent_at: Timestamp | null;
  created_at: Timestamp;
};

export type StoreRecommendationRow = {
  id: string;
  household_id: string;
  store_id: string | null;
  title: string;
  detail: string;
  eta_minutes: number | null;
  item_count: number;
  created_at: Timestamp;
};

export type SmartHomeDeviceRow = {
  id: string;
  household_id: string;
  external_id: string;
  name: string;
  room: string | null;
  device_type: string;
  state: Json;
  is_online: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type SmartHomeSceneRow = {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  actions: Json;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type PushTokenRow = {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  created_at: Timestamp;
  updated_at: Timestamp;
};

/** @deprecated Prefer ProfileRow */
export type User = ProfileRow;
/** @deprecated Prefer HouseholdRow */
export type Household = HouseholdRow;
/** @deprecated Prefer HouseholdMemberRow */
export type HouseholdMember = HouseholdMemberRow;
/** @deprecated Prefer TaskRow */
export type Task = TaskRow;
/** @deprecated Prefer GroceryItemRow */
export type GroceryItem = GroceryItemRow;
/** @deprecated Prefer CalendarEventRow */
export type CalendarEvent = CalendarEventRow;
/** @deprecated Prefer RewardRow */
export type Reward = RewardRow;
/** @deprecated Prefer BadgeRow */
export type Badge = BadgeRow;
/** @deprecated Prefer XPTransactionRow */
export type XPTransaction = XPTransactionRow;
/** @deprecated Prefer HouseholdScoreRow */
export type HouseholdMomentum = HouseholdScoreRow;
/** @deprecated Prefer AiBriefingRow */
export type PoppinsBriefing = AiBriefingRow;

type TableDef<Row, Insert = Partial<Row> & Record<string, unknown>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<
        ProfileRow,
        Pick<ProfileRow, 'id' | 'email'> & Partial<Omit<ProfileRow, 'id' | 'email'>>,
        Partial<Omit<ProfileRow, 'id'>>
      >;
      households: TableDef<
        HouseholdRow,
        Pick<HouseholdRow, 'name' | 'owner_id'> & Partial<Omit<HouseholdRow, 'name' | 'owner_id'>>,
        Partial<Omit<HouseholdRow, 'id'>>
      >;
      household_members: TableDef<
        HouseholdMemberRow,
        Pick<HouseholdMemberRow, 'household_id' | 'role'> & Partial<Omit<HouseholdMemberRow, 'household_id' | 'role'>>,
        Partial<Omit<HouseholdMemberRow, 'id'>>
      >;
      household_invites: TableDef<
        HouseholdInviteRow,
        Pick<HouseholdInviteRow, 'household_id' | 'invite_code'> &
          Partial<Omit<HouseholdInviteRow, 'household_id' | 'invite_code'>>,
        Partial<Omit<HouseholdInviteRow, 'id'>>
      >;
      tasks: TableDef<
        TaskRow,
        Pick<TaskRow, 'household_id' | 'title' | 'category' | 'assignee_name' | 'due_label'> &
          Partial<Omit<TaskRow, 'household_id' | 'title' | 'category' | 'assignee_name' | 'due_label'>>,
        Partial<Omit<TaskRow, 'id'>>
      >;
      grocery_items: TableDef<
        GroceryItemRow,
        Pick<GroceryItemRow, 'household_id' | 'name' | 'category'> &
          Partial<Omit<GroceryItemRow, 'household_id' | 'name' | 'category'>>,
        Partial<Omit<GroceryItemRow, 'id'>>
      >;
      grocery_purchase_history: TableDef<
        GroceryPurchaseHistoryRow,
        Pick<GroceryPurchaseHistoryRow, 'household_id' | 'name'> &
          Partial<Omit<GroceryPurchaseHistoryRow, 'household_id' | 'name'>>,
        Partial<Omit<GroceryPurchaseHistoryRow, 'id'>>
      >;
      calendar_events: TableDef<
        CalendarEventRow,
        Pick<CalendarEventRow, 'household_id' | 'title' | 'date_label' | 'time_label' | 'responsible_name'> &
          Partial<Omit<CalendarEventRow, 'household_id' | 'title' | 'date_label' | 'time_label' | 'responsible_name'>>,
        Partial<Omit<CalendarEventRow, 'id'>>
      >;
      rewards: TableDef<
        RewardRow,
        Pick<RewardRow, 'household_id' | 'title'> & Partial<Omit<RewardRow, 'household_id' | 'title'>>,
        Partial<Omit<RewardRow, 'id'>>
      >;
      reward_redemptions: TableDef<
        RewardRedemptionRow,
        Pick<RewardRedemptionRow, 'household_id' | 'reward_id' | 'member_id'> &
          Partial<Omit<RewardRedemptionRow, 'household_id' | 'reward_id' | 'member_id'>>,
        Partial<Omit<RewardRedemptionRow, 'id'>>
      >;
      badges: TableDef<
        BadgeRow,
        Pick<BadgeRow, 'household_id' | 'title' | 'icon'> & Partial<Omit<BadgeRow, 'household_id' | 'title' | 'icon'>>,
        Partial<Omit<BadgeRow, 'id'>>
      >;
      xp_transactions: TableDef<
        XPTransactionRow,
        Pick<XPTransactionRow, 'household_id' | 'amount' | 'reason'> &
          Partial<Omit<XPTransactionRow, 'household_id' | 'amount' | 'reason'>>,
        Partial<Omit<XPTransactionRow, 'id'>>
      >;
      household_scores: TableDef<
        HouseholdScoreRow,
        Pick<HouseholdScoreRow, 'household_id'> & Partial<Omit<HouseholdScoreRow, 'household_id'>>,
        Partial<Omit<HouseholdScoreRow, 'id'>>
      >;
      ai_briefings: TableDef<
        AiBriefingRow,
        Pick<AiBriefingRow, 'household_id' | 'title' | 'summary'> &
          Partial<Omit<AiBriefingRow, 'household_id' | 'title' | 'summary'>>,
        Partial<Omit<AiBriefingRow, 'id'>>
      >;
      ai_conversations: TableDef<
        AiConversationRow,
        Pick<AiConversationRow, 'household_id' | 'user_id'> &
          Partial<Omit<AiConversationRow, 'household_id' | 'user_id'>>,
        Partial<Omit<AiConversationRow, 'id'>>
      >;
      ai_messages: TableDef<
        AiMessageRow,
        Pick<AiMessageRow, 'conversation_id' | 'role' | 'content'> &
          Partial<Omit<AiMessageRow, 'conversation_id' | 'role' | 'content'>>,
        Partial<Omit<AiMessageRow, 'id'>>
      >;
      nova_briefings: TableDef<
        Omit<AiBriefingRow, 'briefing_type'>,
        never,
        never
      >;
      notifications: TableDef<
        NotificationRow,
        Pick<NotificationRow, 'household_id' | 'title' | 'body'> &
          Partial<Omit<NotificationRow, 'household_id' | 'title' | 'body'>>,
        Partial<Omit<NotificationRow, 'id'>>
      >;
      store_recommendations: TableDef<
        StoreRecommendationRow,
        Pick<StoreRecommendationRow, 'household_id' | 'title' | 'detail'> &
          Partial<Omit<StoreRecommendationRow, 'household_id' | 'title' | 'detail'>>,
        Partial<Omit<StoreRecommendationRow, 'id'>>
      >;
      smart_home_devices: TableDef<
        SmartHomeDeviceRow,
        Pick<SmartHomeDeviceRow, 'household_id' | 'external_id' | 'name' | 'device_type'> &
          Partial<Omit<SmartHomeDeviceRow, 'household_id' | 'external_id' | 'name' | 'device_type'>>,
        Partial<Omit<SmartHomeDeviceRow, 'id'>>
      >;
      smart_home_scenes: TableDef<
        SmartHomeSceneRow,
        Pick<SmartHomeSceneRow, 'household_id' | 'name'> & Partial<Omit<SmartHomeSceneRow, 'household_id' | 'name'>>,
        Partial<Omit<SmartHomeSceneRow, 'id'>>
      >;
      analytics_events: TableDef<
        {
          id: string;
          household_id: string | null;
          user_id: string | null;
          event_name: string;
          properties: Json;
          created_at: Timestamp;
        },
        {
          event_name: string;
          household_id?: string | null;
          user_id?: string | null;
          properties?: Json;
          id?: string;
          created_at?: Timestamp;
        },
        Partial<{
          household_id: string | null;
          user_id: string | null;
          event_name: string;
          properties: Json;
        }>
      >;
      push_tokens: TableDef<
        PushTokenRow,
        Pick<PushTokenRow, 'user_id' | 'token' | 'platform'> & Partial<Omit<PushTokenRow, 'user_id' | 'token' | 'platform'>>,
        Partial<Omit<PushTokenRow, 'id'>>
      >;
      ai_usage_events: TableDef<
        {
          id: string;
          household_id: string;
          client_key: string;
          member_id: string;
          member_name: string;
          kind: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          usd: number;
          occurred_at: Timestamp;
          created_at: Timestamp;
        },
        {
          household_id: string;
          client_key: string;
          member_id: string;
          usd: number;
          member_name?: string;
          kind?: string;
          model?: string;
          input_tokens?: number;
          output_tokens?: number;
          occurred_at?: Timestamp;
          id?: string;
          created_at?: Timestamp;
        },
        Partial<{
          member_name: string;
          kind: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          usd: number;
          occurred_at: Timestamp;
        }>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      delete_own_account: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      submit_account_deletion_feedback: {
        Args: { p_reason: string; p_detail?: string | null };
        Returns: undefined;
      };
      is_household_member: {
        Args: { target_household: string };
        Returns: boolean;
      };
      household_role: {
        Args: { target_household: string };
        Returns: string;
      };
      is_household_admin: {
        Args: { target_household: string };
        Returns: boolean;
      };
      promote_member_to_admin: {
        Args: { p_member_id: string };
        Returns: Json;
      };
      generate_member_invite: {
        Args: { p_member_id: string; p_requested_role: string };
        Returns: Json;
      };
      redeem_member_invite: {
        Args: { p_token: string };
        Returns: Json;
      };
      submit_reward_proposal: {
        Args: { p_title: string; p_note?: string | null };
        Returns: Json;
      };
      decide_reward_proposal: {
        Args: { p_proposal_id: string; p_approve: boolean };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

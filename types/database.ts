export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type User = {
  avatar_url: string | null;
  created_at: string;
  display_name: string | null;
  email: string;
  id: string;
  phone: string | null;
  updated_at: string;
};

export type Household = {
  country: string | null;
  created_at: string;
  household_type: string;
  id: string;
  name: string;
  owner_id: string;
  timezone: string;
  updated_at: string;
};

export type HouseholdMember = {
  avatar_symbol: string | null;
  created_at: string;
  household_id: string;
  id: string;
  load_share: number;
  role: 'owner' | 'admin' | 'adult' | 'child' | 'guest';
  status: 'invited' | 'pending' | 'active' | 'removed';
  updated_at: string;
  user_id: string | null;
  xp: number;
};

export type Task = {
  assignee_name: string;
  category: string;
  created_at: string;
  due_label: string;
  household_id: string;
  id: string;
  repeat_rule: 'none' | 'daily' | 'weekly' | 'weekdays';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  title: string;
  updated_at: string;
  xp_value: number;
};

export type GroceryItem = {
  category: string;
  created_at: string;
  household_id: string;
  id: string;
  location: 'fridge' | 'freezer' | 'pantry' | 'bathroom' | 'cleaning';
  name: string;
  quantity: string;
  status: 'available' | 'low' | 'missing' | 'purchased';
  updated_at: string;
};

export type CalendarEvent = {
  category: 'school' | 'activity' | 'appointment' | 'family' | 'routine';
  created_at: string;
  date_label: string;
  household_id: string;
  id: string;
  location: string | null;
  responsible_name: string;
  time_label: string;
  title: string;
  updated_at: string;
};

export type Reward = {
  approval_required: boolean;
  cost: number;
  created_at: string;
  household_id: string;
  id: string;
  title: string;
  updated_at: string;
};

export type Badge = {
  created_at: string;
  household_id: string;
  icon: string;
  id: string;
  progress: number;
  title: string;
  updated_at: string;
};

export type XPTransaction = {
  amount: number;
  created_at: string;
  household_id: string;
  id: string;
  reason: string;
  related_task_id: string | null;
  user_id: string | null;
};

export type HouseholdMomentum = {
  calendar_coverage: number;
  created_at: string;
  grocery_readiness: number;
  household_id: string;
  id: string;
  momentum_score: number;
  task_completion_rate: number;
};

export type NovaBriefing = {
  actions: string[];
  created_at: string;
  household_id: string;
  id: string;
  metadata: Json;
  summary: string;
  title: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      badges: {
        Row: Badge;
      };
      calendar_events: {
        Row: CalendarEvent;
      };
      grocery_items: {
        Row: GroceryItem;
      };
      household_members: {
        Row: HouseholdMember;
      };
      household_scores: {
        Row: HouseholdMomentum;
      };
      households: {
        Row: Household;
      };
      nova_briefings: {
        Row: NovaBriefing;
      };
      profiles: {
        Row: User;
      };
      rewards: {
        Row: Reward;
      };
      tasks: {
        Row: Task;
      };
      xp_transactions: {
        Row: XPTransaction;
      };
    };
  };
};

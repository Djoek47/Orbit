import type {
  Badge,
  GroceryItem,
  HouseholdEvent,
  HouseholdMember,
  HouseholdTask,
  NovaBriefing,
  OrbitUser,
  Reward,
} from '@/types/orbit';

export function mapProfileToUser(row: {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}): OrbitUser {
  const name = row.display_name?.trim() || '';
  return {
    id: row.id,
    email: row.email,
    name,
    avatar: name.charAt(0).toUpperCase() || row.email.charAt(0).toUpperCase() || 'O',
    profileComplete: Boolean(name),
  };
}

export function mapMemberRow(row: {
  id: string;
  display_name?: string | null;
  role: HouseholdMember['role'];
  status: string;
  avatar_symbol: string | null;
  xp: number;
  week_xp?: number | null;
  streak?: number | null;
  load_share: number;
}): HouseholdMember {
  const status =
    row.status === 'active' || row.status === 'pending' || row.status === 'inactive'
      ? row.status
      : row.status === 'invited'
        ? 'pending'
        : 'inactive';

  return {
    id: row.id,
    name: row.display_name?.trim() || 'Member',
    role: row.role,
    status,
    avatar: row.avatar_symbol || (row.display_name?.charAt(0).toUpperCase() ?? 'M'),
    xp: row.xp,
    weekXp: row.week_xp ?? 0,
    streak: row.streak ?? 0,
    loadShare: row.load_share,
  };
}

const taskStatusMap = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
} as const;

const taskRepeatMap = {
  none: 'None',
  daily: 'Daily',
  weekly: 'Weekly',
  weekdays: 'Weekdays',
} as const;

export function mapTaskRow(row: {
  id: string;
  title: string;
  category: string;
  assignee_name: string;
  due_label: string;
  xp_value: number;
  repeat_rule: keyof typeof taskRepeatMap;
  status: keyof typeof taskStatusMap;
  description?: string | null;
  room_id?: string | null;
  weight?: number | null;
  difficulty?: HouseholdTask['difficulty'] | null;
  proof_required?: boolean | null;
  proof_uri?: string | null;
  proof_status?: 'none' | 'submitted' | 'approved' | 'rejected' | null;
}): HouseholdTask {
  const proofStatus =
    row.proof_status === 'none' ||
    row.proof_status === 'submitted' ||
    row.proof_status === 'approved' ||
    row.proof_status === 'rejected'
      ? row.proof_status
      : undefined;

  return {
    id: row.id,
    title: row.title,
    category: row.category,
    assignee: row.assignee_name,
    due: row.due_label,
    xp: row.xp_value,
    repeat: taskRepeatMap[row.repeat_rule] ?? 'None',
    status: taskStatusMap[row.status] ?? 'Pending',
    description: row.description ?? undefined,
    roomId: row.room_id ?? undefined,
    weight: row.weight ?? undefined,
    difficulty: row.difficulty ?? undefined,
    proofRequired: row.proof_required ?? undefined,
    proofUri: row.proof_uri ?? undefined,
    proofStatus,
  };
}

export function taskRepeatToDb(repeat: HouseholdTask['repeat']) {
  return repeat.toLowerCase() as 'none' | 'daily' | 'weekly' | 'weekdays';
}

export function taskStatusToDb(status: HouseholdTask['status']) {
  const map = {
    Pending: 'pending',
    'In Progress': 'in_progress',
    Completed: 'completed',
    Overdue: 'overdue',
  } as const;
  return map[status];
}

const groceryStatusMap = {
  available: 'Available',
  low: 'Low',
  missing: 'Missing',
  purchased: 'Purchased',
} as const;

const groceryLocationMap = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Pantry',
  bathroom: 'Bathroom',
  cleaning: 'Cleaning',
} as const;

export function mapGroceryRow(row: {
  id: string;
  name: string;
  category: string;
  quantity: string;
  location: keyof typeof groceryLocationMap;
  status: keyof typeof groceryStatusMap;
  note?: string | null;
}): GroceryItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    location: groceryLocationMap[row.location] ?? 'Pantry',
    status: groceryStatusMap[row.status] ?? 'Missing',
    note: row.note ?? undefined,
  };
}

const eventCategoryMap = {
  school: 'School',
  activity: 'Activity',
  appointment: 'Appointment',
  family: 'Family',
  routine: 'Routine',
} as const;

export function mapEventRow(row: {
  id: string;
  title: string;
  category: keyof typeof eventCategoryMap;
  date_label: string;
  time_label: string;
  location: string | null;
  responsible_name: string;
}): HouseholdEvent {
  return {
    id: row.id,
    title: row.title,
    category: eventCategoryMap[row.category] ?? 'Family',
    date: row.date_label,
    time: row.time_label,
    location: row.location ?? '',
    responsible: row.responsible_name,
  };
}

export function mapRewardRow(row: {
  id: string;
  title: string;
  cost: number;
  approval_required: boolean;
}): Reward {
  return {
    id: row.id,
    title: row.title,
    cost: row.cost,
    approvalRequired: row.approval_required,
  };
}

export function mapBadgeRow(row: {
  id: string;
  title: string;
  icon: string;
  progress: number;
}): Badge {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    progress: Number(row.progress),
  };
}

export function mapBriefingRow(row: {
  title: string;
  summary: string;
  actions: string[] | null;
}): NovaBriefing {
  return {
    title: row.title,
    summary: row.summary,
    actions: row.actions ?? [],
  };
}

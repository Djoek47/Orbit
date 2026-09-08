import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import type { MemberCapabilities } from '@/types/orbit';
import type { HouseholdEvent } from '@/types/orbit';

export type PlanAddKind = 'homework' | 'school' | 'practice' | 'appointment' | 'family';

export type PlanAddOption = {
  id: PlanAddKind;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  /** Calendar category when routing to create-event. */
  category?: HouseholdEvent['category'];
  /** Homework tasks always publish immediately — never approval-gated. */
  instant: boolean;
  route: '/add-homework' | '/assign-homework' | '/create-event';
  query?: Record<string, string>;
};

const HOMEWORK_SELF: PlanAddOption = {
  id: 'homework',
  title: 'Homework',
  subtitle: 'Adds to your Plan immediately',
  icon: 'menu-book',
  instant: true,
  route: '/add-homework',
};

const HOMEWORK_ASSIGN: PlanAddOption = {
  id: 'homework',
  title: 'Homework',
  subtitle: 'Assign to a Sidekick',
  icon: 'menu-book',
  instant: true,
  route: '/assign-homework',
};

const EVENT_OPTIONS: PlanAddOption[] = [
  {
    id: 'school',
    title: 'School',
    subtitle: 'Classes, tests, field trips',
    icon: 'school',
    category: 'School',
    instant: false,
    route: '/create-event',
    query: { kind: 'school' },
  },
  {
    id: 'practice',
    title: 'Practice',
    subtitle: 'Sports, music, clubs',
    icon: 'sports-soccer',
    category: 'Activity',
    instant: false,
    route: '/create-event',
    query: { kind: 'practice' },
  },
  {
    id: 'appointment',
    title: 'Appointment',
    subtitle: 'Doctor, dentist, meetings',
    icon: 'event',
    category: 'Appointment',
    instant: false,
    route: '/create-event',
    query: { kind: 'appointment' },
  },
  {
    id: 'family',
    title: 'Family',
    subtitle: 'Reunions, parties, trips',
    icon: 'groups',
    category: 'Family',
    instant: false,
    route: '/create-event',
    query: { kind: 'family' },
  },
];

export function planAddOptionsForActor(opts: {
  isAdmin: boolean;
  isSidekick: boolean;
  caps: MemberCapabilities;
}): PlanAddOption[] {
  const { isAdmin, isSidekick, caps } = opts;

  if (isAdmin) {
    return [HOMEWORK_ASSIGN, ...EVENT_OPTIONS.map((item) => ({ ...item, instant: true }))];
  }

  if (!isSidekick) {
    return caps.allowCalendarCreate ? EVENT_OPTIONS : [];
  }

  const items: PlanAddOption[] = [HOMEWORK_SELF];
  if (caps.allowCalendarCreate) {
    const approvalLocked = caps.requireSidekickEventApproval !== false;
    items.push(
      ...EVENT_OPTIONS.map((item) => ({
        ...item,
        instant: !approvalLocked,
        subtitle: approvalLocked
          ? `${item.subtitle} · needs approval`
          : `${item.subtitle} · adds immediately`,
      }))
    );
  }
  return items;
}

export function planAddHref(option: PlanAddOption): string {
  if (!option.query) return option.route;
  const params = new URLSearchParams(option.query);
  return `${option.route}?${params.toString()}`;
}

export function categoryForPlanAddKind(kind: string | undefined): HouseholdEvent['category'] {
  switch (kind) {
    case 'school':
      return 'School';
    case 'practice':
      return 'Activity';
    case 'appointment':
      return 'Appointment';
    case 'family':
    default:
      return 'Family';
  }
}

export function planAddScreenTitle(kind: string | undefined): string {
  switch (kind) {
    case 'school':
      return 'School event';
    case 'practice':
      return 'Practice';
    case 'appointment':
      return 'Appointment';
    case 'family':
      return 'Family event';
    default:
      return 'Add to Plan';
  }
}

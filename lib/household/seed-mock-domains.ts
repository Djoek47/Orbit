/**
 * Align in-memory mock repository state with a persisted household snapshot.
 */

import { __setMockTasksStateForTests } from '@/repositories/task-repository';
import { __setMockRewardsStateForTests } from '@/repositories/rewards-repository';
import { __setMockGroceriesStateForTests } from '@/repositories/grocery-repository';
import { __setMockEventsStateForTests } from '@/repositories/calendar-repository';
import type { HouseholdSnapshot } from '@/types/orbit';

export function seedMockDomainsFromHousehold(household: HouseholdSnapshot) {
  __setMockTasksStateForTests(household.tasks ?? []);
  __setMockRewardsStateForTests(household.rewards ?? []);
  __setMockGroceriesStateForTests(household.groceries ?? []);
  __setMockEventsStateForTests(household.events ?? []);
}

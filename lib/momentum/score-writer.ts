import { getConfiguredSupabase, isMockMode } from '@/repositories/repository-utils';
import type { OrbitMetrics } from '@/types/orbit';

export async function persistHouseholdScore(householdId: string | null | undefined, metrics: OrbitMetrics) {
  if (isMockMode() || !householdId) {
    return;
  }

  const supabase = getConfiguredSupabase('persistHouseholdScore');
  const { error } = await supabase.from('household_scores').insert({
    household_id: householdId,
    task_completion_rate: metrics.taskCompletionRate,
    grocery_readiness: metrics.groceryReadiness,
    calendar_coverage: metrics.calendarCoverage ?? 0,
    participation_rate: 0,
    mental_load_balance: 0,
    momentum_score: metrics.momentum,
  });

  if (error) {
    console.warn('persistHouseholdScore failed', error.message);
  }
}

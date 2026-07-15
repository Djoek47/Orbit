import { dataMode } from '@/config/data-mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { novaService } from '@/services/nova-service';
import type {
  HouseholdSnapshot,
  NovaBriefing,
  NovaConversationAnswer,
  NovaRecommendation,
  NovaWeeklyBriefing,
  OrbitMetrics,
} from '@/types/orbit';

export type AIProvider = {
  answerQuestion: (
    question: string,
    household: HouseholdSnapshot,
    metrics: OrbitMetrics
  ) => Promise<NovaConversationAnswer>;
  generateDailyBriefing: (household: HouseholdSnapshot, metrics: OrbitMetrics) => Promise<NovaBriefing>;
  generateRecommendations: (
    household: HouseholdSnapshot,
    metrics: OrbitMetrics
  ) => Promise<NovaRecommendation[]>;
  generateWeeklyBriefing: (household: HouseholdSnapshot, metrics: OrbitMetrics) => Promise<NovaWeeklyBriefing>;
};

async function invokeNovaFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  fallback: () => Promise<T>
): Promise<T> {
  const supabase = getSupabaseClient();
  if (!supabase || dataMode === 'mock') {
    return fallback();
  }

  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error || !data) {
      return fallback();
    }
    return data as T;
  } catch {
    return fallback();
  }
}

export const mockAIProvider: AIProvider = {
  async answerQuestion(question, household, metrics) {
    return novaService.answerQuestion(question, household, metrics);
  },
  async generateDailyBriefing(household, metrics) {
    return novaService.generateDailyBriefing(household, metrics);
  },
  async generateRecommendations(household, metrics) {
    return novaService.generateRecommendations(household, metrics);
  },
  async generateWeeklyBriefing(household, metrics) {
    return novaService.generateWeeklyBriefing(household, metrics);
  },
};

export const openAIProvider: AIProvider = {
  async answerQuestion(question, household, metrics) {
    return invokeNovaFunction(
      'nova-chat',
      { question, householdId: household.id, metrics },
      () => mockAIProvider.answerQuestion(question, household, metrics)
    );
  },
  async generateDailyBriefing(household, metrics) {
    return invokeNovaFunction(
      'nova-briefing',
      { householdId: household.id, type: 'daily', metrics, household },
      () => mockAIProvider.generateDailyBriefing(household, metrics)
    );
  },
  async generateRecommendations(household, metrics) {
    return invokeNovaFunction(
      'nova-briefing',
      { householdId: household.id, type: 'recommendations', metrics, household },
      () => mockAIProvider.generateRecommendations(household, metrics)
    );
  },
  async generateWeeklyBriefing(household, metrics) {
    return invokeNovaFunction(
      'nova-briefing',
      { householdId: household.id, type: 'weekly', metrics, household },
      () => mockAIProvider.generateWeeklyBriefing(household, metrics)
    );
  },
};

/** Uses OpenAI edge functions when in supabase mode; otherwise local heuristics. */
export const aiProvider: AIProvider = dataMode === 'supabase' ? openAIProvider : mockAIProvider;

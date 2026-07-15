import { useLiveNovaAi } from '@/config/nova-ai-mode';
import { dataMode } from '@/config/data-mode';
import { buildNovaHouseholdPayload } from '@/lib/ai/household-context';
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

export type NovaChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AIProvider = {
  answerQuestion: (
    question: string,
    household: HouseholdSnapshot,
    metrics: OrbitMetrics,
    history?: NovaChatMessage[]
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
  if (!supabase || !useLiveNovaAi) {
    return fallback();
  }

  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error || !data) {
      return fallback();
    }
    if (typeof data === 'object' && data !== null && 'error' in data) {
      throw new Error(String((data as { error: unknown }).error));
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
  async answerQuestion(question, household, metrics, history = []) {
    return invokeNovaFunction(
      'nova-chat',
      {
        question,
        householdId: household.id,
        metrics,
        household: buildNovaHouseholdPayload(household, metrics),
        history,
      },
      () => mockAIProvider.answerQuestion(question, household, metrics)
    );
  },
  async generateDailyBriefing(household, metrics) {
    return invokeNovaFunction(
      'nova-briefing',
      {
        householdId: household.id,
        type: 'daily',
        metrics,
        household: buildNovaHouseholdPayload(household, metrics),
      },
      () => mockAIProvider.generateDailyBriefing(household, metrics)
    );
  },
  async generateRecommendations(household, metrics) {
    const result = await invokeNovaFunction<{ recommendations?: NovaRecommendation[] } | NovaRecommendation[]>(
      'nova-briefing',
      {
        householdId: household.id,
        type: 'recommendations',
        metrics,
        household: buildNovaHouseholdPayload(household, metrics),
      },
      () => mockAIProvider.generateRecommendations(household, metrics).then((items) => ({ recommendations: items }))
    );
    if (Array.isArray(result)) {
      return result;
    }
    return result.recommendations ?? mockAIProvider.generateRecommendations(household, metrics);
  },
  async generateWeeklyBriefing(household, metrics) {
    return invokeNovaFunction(
      'nova-briefing',
      {
        householdId: household.id,
        type: 'weekly',
        metrics,
        household: buildNovaHouseholdPayload(household, metrics),
      },
      () => mockAIProvider.generateWeeklyBriefing(household, metrics)
    );
  },
};

/** Uses OpenAI edge functions when supabase mode or EXPO_PUBLIC_NOVA_AI=openai. */
export const aiProvider: AIProvider = useLiveNovaAi ? openAIProvider : mockAIProvider;

export function isLiveNovaEnabled() {
  return useLiveNovaAi && dataMode === 'supabase' ? Boolean(getSupabaseClient()) : useLiveNovaAi;
}

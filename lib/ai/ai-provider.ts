import { useLivePoppinsAi } from '@/config/poppins-ai-mode';
import { dataMode } from '@/config/data-mode';
import { buildPoppinsHouseholdPayload } from '@/lib/ai/household-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { poppinsService } from '@/services/poppins-service';
import type {
  HouseholdSnapshot,
  PoppinsBriefing,
  PoppinsConversationAnswer,
  PoppinsRecommendation,
  PoppinsWeeklyBriefing,
  OrbitMetrics,
} from '@/types/orbit';

export type PoppinsChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AIProvider = {
  answerQuestion: (
    question: string,
    household: HouseholdSnapshot,
    metrics: OrbitMetrics,
    history?: PoppinsChatMessage[]
  ) => Promise<PoppinsConversationAnswer>;
  generateDailyBriefing: (household: HouseholdSnapshot, metrics: OrbitMetrics) => Promise<PoppinsBriefing>;
  generateRecommendations: (
    household: HouseholdSnapshot,
    metrics: OrbitMetrics
  ) => Promise<PoppinsRecommendation[]>;
  generateWeeklyBriefing: (household: HouseholdSnapshot, metrics: OrbitMetrics) => Promise<PoppinsWeeklyBriefing>;
};

async function invokePoppinsFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  fallback: () => Promise<T>
): Promise<T> {
  const supabase = getSupabaseClient();
  if (!supabase || !useLivePoppinsAi) {
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
    return poppinsService.answerQuestion(question, household, metrics);
  },
  async generateDailyBriefing(household, metrics) {
    return poppinsService.generateDailyBriefing(household, metrics);
  },
  async generateRecommendations(household, metrics) {
    return poppinsService.generateRecommendations(household, metrics);
  },
  async generateWeeklyBriefing(household, metrics) {
    return poppinsService.generateWeeklyBriefing(household, metrics);
  },
};

export const openAIProvider: AIProvider = {
  async answerQuestion(question, household, metrics, history = []) {
    const live = await invokePoppinsFunction<PoppinsConversationAnswer>(
      'poppins-chat',
      {
        question,
        householdId: household.id,
        metrics,
        majordomoProfileId: household.majordomoProfileId ?? 'poppins',
        household: buildPoppinsHouseholdPayload(household, metrics),
        history,
      },
      () => mockAIProvider.answerQuestion(question, household, metrics)
    );
    // Preserve tool actions from the edge tool loop when present.
    if (live && typeof live === 'object' && 'answer' in live) {
      return {
        question: String(live.question ?? question),
        answer: String(live.answer ?? ''),
        actions: Array.isArray(live.actions) ? live.actions : undefined,
        source: live.source,
      };
    }
    return live;
  },
  async generateDailyBriefing(household, metrics) {
    return invokePoppinsFunction(
      'poppins-briefing',
      {
        householdId: household.id,
        type: 'daily',
        metrics,
        household: buildPoppinsHouseholdPayload(household, metrics),
      },
      () => mockAIProvider.generateDailyBriefing(household, metrics)
    );
  },
  async generateRecommendations(household, metrics) {
    const result = await invokePoppinsFunction<{ recommendations?: PoppinsRecommendation[] } | PoppinsRecommendation[]>(
      'poppins-briefing',
      {
        householdId: household.id,
        type: 'recommendations',
        metrics,
        household: buildPoppinsHouseholdPayload(household, metrics),
      },
      () => mockAIProvider.generateRecommendations(household, metrics).then((items) => ({ recommendations: items }))
    );
    if (Array.isArray(result)) {
      return result;
    }
    return result.recommendations ?? mockAIProvider.generateRecommendations(household, metrics);
  },
  async generateWeeklyBriefing(household, metrics) {
    return invokePoppinsFunction(
      'poppins-briefing',
      {
        householdId: household.id,
        type: 'weekly',
        metrics,
        household: buildPoppinsHouseholdPayload(household, metrics),
      },
      () => mockAIProvider.generateWeeklyBriefing(household, metrics)
    );
  },
};

/** Uses OpenAI edge functions when supabase mode or EXPO_PUBLIC_POPPINS_AI=openai. */
export const aiProvider: AIProvider = useLivePoppinsAi ? openAIProvider : mockAIProvider;

export function isLivePoppinsEnabled() {
  return useLivePoppinsAi && dataMode === 'supabase' ? Boolean(getSupabaseClient()) : useLivePoppinsAi;
}

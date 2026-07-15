import { dataMode } from '@/config/data-mode';
import { aiProvider } from '@/lib/ai/ai-provider';
import { requireMockOrSupabaseReady } from '@/repositories/repository-utils';
import type {
  HouseholdSnapshot,
  NovaBriefing,
  NovaConversationAnswer,
  NovaRecommendation,
  NovaWeeklyBriefing,
  OrbitMetrics,
} from '@/types/orbit';

export const novaRepository = {
  async getNovaBriefing(household: HouseholdSnapshot, metrics: OrbitMetrics): Promise<NovaBriefing> {
    if (dataMode !== 'mock') {
      requireMockOrSupabaseReady('novaRepository.getNovaBriefing');
    }

    return aiProvider.generateDailyBriefing(household, metrics);
  },

  async getWeeklyBriefing(household: HouseholdSnapshot, metrics: OrbitMetrics): Promise<NovaWeeklyBriefing> {
    if (dataMode !== 'mock') {
      requireMockOrSupabaseReady('novaRepository.getWeeklyBriefing');
    }

    return aiProvider.generateWeeklyBriefing(household, metrics);
  },

  async getRecommendations(household: HouseholdSnapshot, metrics: OrbitMetrics): Promise<NovaRecommendation[]> {
    if (dataMode !== 'mock') {
      requireMockOrSupabaseReady('novaRepository.getRecommendations');
    }

    return aiProvider.generateRecommendations(household, metrics);
  },

  async askNova(
    question: string,
    household: HouseholdSnapshot,
    metrics: OrbitMetrics
  ): Promise<NovaConversationAnswer> {
    if (dataMode !== 'mock') {
      requireMockOrSupabaseReady('novaRepository.askNova');
    }

    return aiProvider.answerQuestion(question, household, metrics);
  },
};

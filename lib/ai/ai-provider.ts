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
  async answerQuestion() {
    throw new Error('openAIProvider.answerQuestion is not implemented yet.');
  },
  async generateDailyBriefing() {
    throw new Error('openAIProvider.generateDailyBriefing is not implemented yet.');
  },
  async generateRecommendations() {
    throw new Error('openAIProvider.generateRecommendations is not implemented yet.');
  },
  async generateWeeklyBriefing() {
    throw new Error('openAIProvider.generateWeeklyBriefing is not implemented yet.');
  },
};

export const aiProvider = mockAIProvider;

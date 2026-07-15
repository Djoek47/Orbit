import { aiProvider } from '@/lib/ai/ai-provider';
import { mapBriefingRow } from '@/lib/mappers/orbit-mappers';
import { getConfiguredSupabase, isMockMode, mapDbError } from '@/repositories/repository-utils';
import type {
  HouseholdSnapshot,
  NovaBriefing,
  NovaConversationAnswer,
  NovaRecommendation,
  NovaWeeklyBriefing,
  OrbitMetrics,
  WeeklyReport,
} from '@/types/orbit';

export const novaRepository = {
  async getNovaBriefing(household: HouseholdSnapshot, metrics: OrbitMetrics): Promise<NovaBriefing> {
    if (isMockMode()) {
      return aiProvider.generateDailyBriefing(household, metrics);
    }

    if (!household.id) {
      return aiProvider.generateDailyBriefing(household, metrics);
    }

    const supabase = getConfiguredSupabase('novaRepository.getNovaBriefing');
    const { data, error } = await supabase
      .from('ai_briefings')
      .select('*')
      .eq('household_id', household.id)
      .eq('briefing_type', 'daily')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    mapDbError('novaRepository.getNovaBriefing', error);

    if (data) {
      return mapBriefingRow(data);
    }

    const generated = await aiProvider.generateDailyBriefing(household, metrics);
    await this.saveBriefing(household.id, generated, 'daily', {
      metrics,
    });
    return generated;
  },

  async getWeeklyBriefing(household: HouseholdSnapshot, metrics: OrbitMetrics): Promise<NovaWeeklyBriefing> {
    if (isMockMode() || !household.id) {
      return aiProvider.generateWeeklyBriefing(household, metrics);
    }

    const supabase = getConfiguredSupabase('novaRepository.getWeeklyBriefing');
    const { data, error } = await supabase
      .from('ai_briefings')
      .select('*')
      .eq('household_id', household.id)
      .eq('briefing_type', 'weekly')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    mapDbError('novaRepository.getWeeklyBriefing', error);

    if (data) {
      const metadata = (data.metadata ?? {}) as Record<string, unknown>;
      return {
        title: data.title,
        summary: data.summary,
        tasksCompleted: Number(metadata.tasksCompleted ?? 0),
        tasksMissed: Number(metadata.tasksMissed ?? 0),
        groceriesPurchased: Number(metadata.groceriesPurchased ?? 0),
        mostActiveMember: String(metadata.mostActiveMember ?? ''),
        xpEarned: Number(metadata.xpEarned ?? 0),
        momentumChange: Number(metadata.momentumChange ?? 0),
        recommendations: Array.isArray(metadata.recommendations)
          ? (metadata.recommendations as string[])
          : data.actions ?? [],
      };
    }

    const generated = await aiProvider.generateWeeklyBriefing(household, metrics);
    await this.saveBriefing(
      household.id,
      {
        title: generated.title,
        summary: generated.summary,
        actions: generated.recommendations,
      },
      'weekly',
      {
        tasksCompleted: generated.tasksCompleted,
        tasksMissed: generated.tasksMissed,
        groceriesPurchased: generated.groceriesPurchased,
        mostActiveMember: generated.mostActiveMember,
        xpEarned: generated.xpEarned,
        momentumChange: generated.momentumChange,
        recommendations: generated.recommendations,
      }
    );
    return generated;
  },

  async getRecommendations(household: HouseholdSnapshot, metrics: OrbitMetrics): Promise<NovaRecommendation[]> {
    if (isMockMode()) {
      return aiProvider.generateRecommendations(household, metrics);
    }

    return aiProvider.generateRecommendations(household, metrics);
  },

  async askNova(
    question: string,
    household: HouseholdSnapshot,
    metrics: OrbitMetrics
  ): Promise<NovaConversationAnswer> {
    if (isMockMode()) {
      return aiProvider.answerQuestion(question, household, metrics);
    }

    return aiProvider.answerQuestion(question, household, metrics);
  },

  async saveBriefing(
    householdId: string,
    briefing: NovaBriefing,
    briefingType: 'daily' | 'weekly' = 'daily',
    metadata: Record<string, unknown> = {}
  ): Promise<NovaBriefing> {
    if (isMockMode()) {
      return briefing;
    }

    const supabase = getConfiguredSupabase('novaRepository.saveBriefing');
    const { data, error } = await supabase
      .from('ai_briefings')
      .insert({
        household_id: householdId,
        briefing_type: briefingType,
        title: briefing.title,
        summary: briefing.summary,
        actions: briefing.actions,
        metadata: metadata as import('@/types/database').Json,
      })
      .select('*')
      .single();
    mapDbError('novaRepository.saveBriefing', error);

    return data ? mapBriefingRow(data) : briefing;
  },

  async getLatestWeeklyReport(householdId: string | null | undefined): Promise<WeeklyReport | null> {
    if (isMockMode() || !householdId) {
      return null;
    }

    const supabase = getConfiguredSupabase('novaRepository.getLatestWeeklyReport');
    const { data, error } = await supabase
      .from('ai_briefings')
      .select('*')
      .eq('household_id', householdId)
      .eq('briefing_type', 'weekly')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    mapDbError('novaRepository.getLatestWeeklyReport', error);

    if (!data) {
      return null;
    }

    const metadata = (data.metadata ?? {}) as Record<string, unknown>;
    return {
      id: data.id,
      householdId,
      title: data.title,
      summary: data.summary,
      description: typeof metadata.description === 'string' ? metadata.description : undefined,
      tasksCompleted: Number(metadata.tasksCompleted ?? 0),
      tasksMissed: Number(metadata.tasksMissed ?? 0),
      groceriesPurchased: Number(metadata.groceriesPurchased ?? 0),
      mostActiveMember: String(metadata.mostActiveMember ?? ''),
      xpEarned: Number(metadata.xpEarned ?? 0),
      momentumChange: Number(metadata.momentumChange ?? 0),
      recommendations: Array.isArray(metadata.recommendations)
        ? (metadata.recommendations as string[])
        : data.actions ?? [],
      createdAt: data.created_at,
    };
  },
};

import { dataMode } from '@/config/data-mode';
import { requireMockOrSupabaseReady } from '@/repositories/repository-utils';
import type { Badge, Reward } from '@/types/orbit';

export const rewardsRepository = {
  async getRewards(rewards: Reward[]): Promise<Reward[]> {
    if (dataMode === 'mock') {
      return [...rewards];
    }

    requireMockOrSupabaseReady('rewardsRepository.getRewards');
    return [...rewards];
  },

  async getBadges(badges: Badge[]): Promise<Badge[]> {
    if (dataMode === 'mock') {
      return [...badges];
    }

    requireMockOrSupabaseReady('rewardsRepository.getBadges');
    return [...badges];
  },
};

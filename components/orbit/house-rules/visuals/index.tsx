import type { VisualKey } from '@/lib/rules/types';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { DayTimeline } from '@/components/orbit/house-rules/visuals/day-timeline';
import { LateCreditTable } from '@/components/orbit/house-rules/visuals/late-credit-table';
import { ModelList } from '@/components/orbit/house-rules/visuals/model-list';
import { NoneCard } from '@/components/orbit/house-rules/visuals/xp-ramp';
import { Podium } from '@/components/orbit/house-rules/visuals/podium';
import { RescueTiers } from '@/components/orbit/house-rules/visuals/rescue-tiers';
import { StreakDots } from '@/components/orbit/house-rules/visuals/streak-dots';
import { XpRamp } from '@/components/orbit/house-rules/visuals/xp-ramp';

export {
  DayTimeline,
  LateCreditTable,
  ModelList,
  NoneCard,
  Podium,
  RescueTiers,
  StreakDots,
  XpRamp,
};

export function RuleVisual({
  visual,
  ...props
}: VisualWidgetProps & { visual: VisualKey }) {
  switch (visual) {
    case 'xpRamp':
      return <XpRamp {...props} />;
    case 'dayTimeline':
      return <DayTimeline {...props} />;
    case 'lateCreditTable':
      return <LateCreditTable {...props} />;
    case 'streakDots':
      return <StreakDots {...props} />;
    case 'rescueTiers':
      return <RescueTiers {...props} />;
    case 'podium':
      return <Podium {...props} />;
    case 'modelList':
      return <ModelList {...props} />;
    case 'none':
    default:
      return <NoneCard {...props} />;
  }
}

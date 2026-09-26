/**
 * WO12 §D3 — ad-hoc coach tours reuse the tour overlay without persisting
 * first-run tour state. Module sink so speech handlers can reach the provider.
 */
import type { HowToStep } from '@/lib/poppins/how-to';
import type { TourStep, TourTargetId } from '@/lib/tour/tour-types';

export type AdHocTourOptions = {
  steps: HowToStep[];
  title?: string;
  /** Route to return to when the tour stops (default Poppins tab). */
  returnRoute?: string;
  canDoItForYou?: boolean;
  /** Runs when the person picks "Do it for me" / "Just do it". */
  onDoItForMe?: () => void;
};

export type AdHocTourHooks = {
  startAdHocTour: (opts: AdHocTourOptions) => void;
  stopAdHocTour: () => void;
  isAdHocActive: () => boolean;
  /** Returns true when speech was consumed (do it / stop). */
  handleSpeech: (text: string) => boolean;
};

let hooks: AdHocTourHooks | null = null;

export function setAdHocTourHooks(next: AdHocTourHooks | null) {
  hooks = next;
}

export function getAdHocTourHooks(): AdHocTourHooks | null {
  return hooks;
}

const VALID_TARGETS = new Set<string>([
  'home.todayTasks',
  'home.groceryCard',
  'home.houseRules',
  'home.streak',
  'home.switchProfile',
  'header.settings',
  'settings.houseRules',
  'tabbar.tasks',
  'tabbar.plan',
  'tabbar.rewards',
  'tabbar.poppins',
  'tasks.assignButton',
  'tasks.domainSegment',
  'tasks.firstRow',
  'tasks.proof',
  'assign.form',
  'plan.addButton',
  'plan.viewSegment',
  'groceries.search',
  'groceries.aisles',
  'groceries.storeRun',
  'rewards.segment',
  'rewards.createReward',
  'rewards.createAllowance',
  'rewards.holdRequest',
  'poppins.speak',
  'poppins.stage',
  'poppins.meter',
  'settings.members',
  'members.addMember',
  'members.sharedIpad',
  'selectProfile.faces',
  'tour.finish',
  'tour.welcome',
]);

export function resolveAdHocTargetId(id: string | undefined): TourTargetId {
  if (id && VALID_TARGETS.has(id)) return id as TourTargetId;
  return 'poppins.stage';
}

export function howToStepsToTourSteps(steps: HowToStep[], title?: string): TourStep[] {
  return steps.map((step, index) => {
    const last = index === steps.length - 1;
    return {
      id: `adhoc-${index}`,
      targetId: resolveAdHocTargetId(step.targetId),
      title: step.text,
      body:
        step.detail ??
        (title ? `I'll wait here — do this, or say “do it for me”.` : `I'll wait — do it and I'll take you onward.`),
      route: step.route ?? '/(tabs)/poppins',
      advance: last ? { kind: 'next' } : { kind: 'action' },
      ensureVisible: true,
      primaryLabel: last ? 'Done' : 'Next',
    };
  });
}

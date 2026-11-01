/**
 * WO10 C — when local grammar and model plan disagree on act family, local wins.
 */

export type ActFamily = 'grocery' | 'task' | 'event' | 'itinerary' | 'complete' | 'other';

export function actFamilyOf(type: string): ActFamily {
  switch (type) {
    case 'add_grocery':
      return 'grocery';
    case 'create_task':
    case 'create_task_draft':
    case 'assign_task':
    case 'update_task':
      return 'task';
    case 'create_calendar_event':
    case 'create_event':
      return 'event';
    case 'create_itinerary':
      return 'itinerary';
    case 'complete_task':
      return 'complete';
    default:
      return 'other';
  }
}

export function primaryWriteFamily(
  actions: Array<Record<string, unknown>>
): ActFamily | null {
  for (const action of actions) {
    const family = actFamilyOf(String(action.type ?? ''));
    if (family !== 'other') return family;
  }
  return null;
}

/**
 * Prefer local actions when the model writes a different primary family.
 * Returns local when mismatch; otherwise returns model (possibly filtered).
 */
export function preferLocalOnPlanMismatch(
  local: Array<Record<string, unknown>>,
  model: Array<Record<string, unknown>>
): { actions: Array<Record<string, unknown>>; mismatched: boolean } {
  const localFamily = primaryWriteFamily(local);
  const modelFamily = primaryWriteFamily(model);
  if (
    localFamily &&
    modelFamily &&
    localFamily !== modelFamily &&
    localFamily !== 'other' &&
    modelFamily !== 'other'
  ) {
    console.warn('iui.plan_mismatch', { local: localFamily, model: modelFamily });
    return { actions: local, mismatched: true };
  }
  return { actions: model.length ? model : local, mismatched: false };
}

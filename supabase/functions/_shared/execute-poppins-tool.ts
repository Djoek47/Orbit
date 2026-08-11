/** Shared tool executor for chat + monitor edge functions. */

import { scanMockDeals } from './poppins-tools.ts';

export type HouseholdSnapshotEdge = {
  tasks?: Array<Record<string, unknown>>;
  groceries?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  members?: Array<Record<string, unknown>>;
  householdName?: string;
  greetingName?: string;
  desk?: Record<string, unknown>;
};

export function executePoppinsTool(
  name: string,
  args: Record<string, unknown>,
  household: HouseholdSnapshotEdge,
  metrics: Record<string, unknown>
): Record<string, unknown> {
  const tasks = household.tasks ?? [];
  const groceries = household.groceries ?? [];
  const events = household.events ?? [];
  const members = household.members ?? [];

  switch (name) {
    case 'list_overdue_tasks': {
      const overdue = tasks.filter(
        (t) =>
          t.status === 'Overdue' ||
          t.status === 'overdue' ||
          /overdue|expired/i.test(String(t.due ?? ''))
      );
      return { overdue: overdue.slice(0, 10) };
    }
    case 'nudge_member': {
      const memberName = String(args.memberName ?? '');
      const away = members.some((m) => {
        const same = String(m.name ?? '').toLowerCase() === memberName.toLowerCase();
        return same && (m.away === true || m.awayFrom || m.away_from);
      });
      if (away) {
        return { skipped: true, reason: 'member_away', memberName };
      }
      return {
        action: 'nudge',
        memberName,
        taskId: args.taskId,
        reason: args.reason,
        notification: {
          title: 'Poppins · Nudge',
          body: `${memberName}: ${args.reason}`,
          data: { kind: 'nudge', taskId: args.taskId },
        },
      };
    }
    case 'assess_xp_fairness': {
      const active = members.filter(
        (m) => m.status === 'active' && m.role !== 'guest' && m.role !== 'shared-device'
      );
      const sorted = [...active].sort(
        (a, b) => Number(b.weekXp ?? b.week_xp ?? 0) - Number(a.weekXp ?? a.week_xp ?? 0)
      );
      if (sorted.length < 2) return { gap: 0, recommendation: null };
      const top = sorted[0]!;
      const bottom = sorted[sorted.length - 1]!;
      const gap =
        Number(top.weekXp ?? top.week_xp ?? 0) - Number(bottom.weekXp ?? bottom.week_xp ?? 0);
      const detail = `${top.name} earned ${top.weekXp ?? top.week_xp ?? 0} XP this week vs ${bottom.name}'s ${bottom.weekXp ?? bottom.week_xp ?? 0}. Consider rebalancing tasks.`;
      return {
        gap,
        top: { name: top.name, weekXp: top.weekXp ?? top.week_xp ?? 0 },
        bottom: { name: bottom.name, weekXp: bottom.weekXp ?? bottom.week_xp ?? 0 },
        recommendation: gap >= 40 ? { title: 'Balance weekly XP', detail, tone: 'amber' } : null,
      };
    }
    case 'award_completion_xp': {
      return {
        action: 'award_completion_xp',
        taskId: args.taskId,
        note: 'XP awards are owned by the app on verified completion — Poppins only confirms.',
      };
    }
    case 'scan_deals': {
      const groceryNames = groceries
        .filter(
          (g) =>
            g.status === 'Missing' ||
            g.status === 'Low' ||
            g.status === 'missing' ||
            g.status === 'low'
        )
        .map((g) => String(g.name ?? ''));
      const categories = Array.isArray(args.categories) ? (args.categories as string[]) : undefined;
      return { deals: scanMockDeals(groceryNames, categories) };
    }
    case 'read_calendar': {
      const limit = typeof args.days === 'number' ? Math.min(14, Math.max(1, args.days)) : 7;
      return { events: events.slice(0, limit) };
    }
    case 'list_holidays': {
      const away = members.filter((m) => m.away === true || m.awayFrom || m.away_from);
      return {
        holidays: away.map((m) => ({
          name: m.name,
          awayFrom: m.awayFrom ?? m.away_from,
          awayTo: m.awayTo ?? m.away_to,
        })),
      };
    }
    case 'propose_plan': {
      const title = String(args.title ?? 'Proposed plan');
      const detail = String(args.detail ?? '');
      const dayLabel = args.dayLabel ? String(args.dayLabel) : undefined;
      return {
        recommendation: {
          title,
          detail: dayLabel ? `${detail} · ${dayLabel}` : detail,
          tone: 'cyan',
        },
        notification: {
          title: 'Poppins · Plan suggestion',
          body: detail || title,
          data: {
            kind: 'propose_plan',
            dayLabel,
            planTitle: title,
            planDetail: detail,
          },
        },
        planDraft: {
          title,
          detail,
          dayLabel,
          href: '/create-itinerary',
        },
      };
    }
    case 'ask_for_info': {
      return {
        notification: {
          title: 'Poppins needs a detail',
          body: `${args.memberName}, ${args.question}`,
          data: { kind: 'ask_for_info' },
        },
      };
    }
    default:
      return { error: `Unknown tool: ${name}`, metrics };
  }
}

export function effectsToClientActions(
  effects: Array<{ tool: string; args: Record<string, unknown>; result: Record<string, unknown> }>
) {
  const now = new Date().toISOString();
  const actions: Array<{
    id: string;
    kind: string;
    label: string;
    detail: string;
    createdAt: string;
    data?: Record<string, unknown>;
  }> = [];

  for (const effect of effects) {
    const { tool, args, result } = effect;
    if (tool === 'propose_plan' || result.planDraft) {
      const draft = (result.planDraft ?? {}) as Record<string, unknown>;
      actions.push({
        id: `chat-plan-${now}-${actions.length}`,
        kind: 'plan',
        label: String(draft.title ?? args.title ?? 'Proposed plan'),
        detail: String(draft.detail ?? args.detail ?? ''),
        createdAt: now,
        data: {
          dayLabel: draft.dayLabel ?? args.dayLabel,
          planTitle: draft.title ?? args.title,
          planDetail: draft.detail ?? args.detail,
          href: '/create-itinerary',
        },
      });
      continue;
    }
    if (tool === 'nudge_member') {
      if (result.skipped) {
        actions.push({
          id: `chat-nudge-skip-${now}-${actions.length}`,
          kind: 'holiday',
          label: `Skipped nudge · ${args.memberName ?? 'member'} away`,
          detail: 'Poppins does not nudge members on holiday.',
          createdAt: now,
        });
      } else {
        actions.push({
          id: `chat-nudge-${now}-${actions.length}`,
          kind: 'nudge',
          label: `Nudged ${args.memberName ?? 'member'}`,
          detail: String(args.reason ?? ''),
          createdAt: now,
        });
      }
      continue;
    }
    if (tool === 'assess_xp_fairness') {
      const rec = result.recommendation as { detail?: string } | null;
      actions.push({
        id: `chat-xp-${now}-${actions.length}`,
        kind: 'xp_fairness',
        label: 'Assessed XP fairness',
        detail: rec?.detail ?? `Gap ${String(result.gap ?? 0)} XP this week`,
        createdAt: now,
      });
      continue;
    }
    if (tool === 'scan_deals') {
      const deals = Array.isArray(result.deals) ? result.deals : [];
      actions.push({
        id: `chat-deals-${now}-${actions.length}`,
        kind: 'deals',
        label: deals.length ? `Found ${deals.length} deals` : 'Scanned deals',
        detail: deals.length
          ? deals
              .slice(0, 3)
              .map((d: { title?: string; store?: string }) => `${d.title} @ ${d.store}`)
              .join(' · ')
          : 'No strong matches right now',
        createdAt: now,
      });
      continue;
    }
    if (tool === 'list_overdue_tasks') {
      const overdue = Array.isArray(result.overdue) ? result.overdue : [];
      actions.push({
        id: `chat-overdue-${now}-${actions.length}`,
        kind: 'monitor',
        label: overdue.length ? `${overdue.length} overdue` : 'No overdue tasks',
        detail: overdue
          .slice(0, 3)
          .map((t: { title?: string; assignee?: string }) => `${t.title} · ${t.assignee}`)
          .join(' · '),
        createdAt: now,
      });
    }
  }

  return actions;
}

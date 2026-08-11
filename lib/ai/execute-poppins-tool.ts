/**
 * Client-safe Poppins tool executor (mirrors edge `_shared/execute-poppins-tool.ts`).
 * Returns structured results; callers apply notifications / Activity side effects.
 */

import { scanDealsForHousehold } from '@/data/mock-deals';
import type { PoppinsToolName } from '@/lib/ai/poppins-tools';
import type { HouseholdSnapshot, OrbitMetrics, PoppinsMonitorAction } from '@/types/orbit';

export type PoppinsToolResult = Record<string, unknown>;

function isAway(member: { awayFrom?: string; awayTo?: string }, now = new Date()) {
  if (!member.awayFrom || !member.awayTo) return false;
  const t = now.toISOString().slice(0, 10);
  return t >= member.awayFrom && t <= member.awayTo;
}

export function executePoppinsTool(
  name: PoppinsToolName | string,
  args: Record<string, unknown>,
  household: HouseholdSnapshot,
  metrics: OrbitMetrics
): PoppinsToolResult {
  const tasks = household.tasks;
  const events = household.events;
  const members = household.members;

  switch (name) {
    case 'list_overdue_tasks': {
      const overdue = tasks
        .filter(
          (t) =>
            t.status === 'Overdue' ||
            t.status === 'Expired' ||
            t.status === 'Missed' ||
            /overdue|expired/i.test(String(t.due ?? ''))
        )
        .slice(0, 10)
        .map((t) => ({
          id: t.id,
          title: t.title,
          assignee: t.assignee,
          due: t.due,
          status: t.status,
        }));
      return { overdue };
    }
    case 'nudge_member': {
      const memberName = String(args.memberName ?? '');
      const away = members.some(
        (m) => m.name.toLowerCase() === memberName.toLowerCase() && isAway(m)
      );
      if (away) {
        return {
          skipped: true,
          reason: 'member_away',
          memberName,
        };
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
      const sorted = [...active].sort((a, b) => (b.weekXp ?? 0) - (a.weekXp ?? 0));
      if (sorted.length < 2) return { gap: 0, recommendation: null, metrics };
      const top = sorted[0]!;
      const bottom = sorted[sorted.length - 1]!;
      const gap = (top.weekXp ?? 0) - (bottom.weekXp ?? 0);
      const detail = `${top.name} earned ${top.weekXp ?? 0} XP this week vs ${bottom.name}'s ${bottom.weekXp ?? 0}. Consider rebalancing tasks.`;
      return {
        gap,
        top: { name: top.name, weekXp: top.weekXp ?? 0 },
        bottom: { name: bottom.name, weekXp: bottom.weekXp ?? 0 },
        recommendation:
          gap >= 40
            ? { title: 'Balance weekly XP', detail, tone: 'amber' }
            : null,
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
      const categories = Array.isArray(args.categories)
        ? (args.categories as Array<'grocery' | 'shoes' | 'electronics' | 'furniture'>)
        : undefined;
      const groceryNames = household.groceries
        .filter((g) => g.status === 'Missing' || g.status === 'Low')
        .map((g) => g.name);
      const deals = scanDealsForHousehold({ groceryNames, categories });
      return { deals };
    }
    case 'read_calendar': {
      const limit = typeof args.days === 'number' ? Math.min(14, Math.max(1, args.days)) : 7;
      return {
        events: events.slice(0, limit).map((e) => ({
          title: e.title,
          date: e.date,
          time: e.time,
          responsible: e.responsible,
          category: e.category,
        })),
      };
    }
    case 'list_holidays': {
      return {
        holidays: members
          .filter((m) => isAway(m))
          .map((m) => ({
            name: m.name,
            awayFrom: m.awayFrom,
            awayTo: m.awayTo,
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

export function toolResultToMonitorAction(
  name: string,
  args: Record<string, unknown>,
  result: PoppinsToolResult
): PoppinsMonitorAction {
  const now = new Date().toISOString();
  const planDraft = result.planDraft as
    | { title?: string; detail?: string; dayLabel?: string; href?: string }
    | undefined;

  if (name === 'propose_plan' || planDraft) {
    return {
      id: `tool-plan-${now}`,
      kind: 'plan',
      label: String(planDraft?.title ?? args.title ?? 'Proposed plan'),
      detail: String(planDraft?.detail ?? args.detail ?? ''),
      createdAt: now,
      data: {
        dayLabel: planDraft?.dayLabel ?? args.dayLabel,
        planTitle: planDraft?.title ?? args.title,
        planDetail: planDraft?.detail ?? args.detail,
        href: '/create-itinerary',
      },
    };
  }

  if (name === 'nudge_member') {
    if (result.skipped) {
      return {
        id: `tool-nudge-skip-${now}`,
        kind: 'holiday',
        label: `Skipped nudge · ${args.memberName ?? 'member'} away`,
        detail: 'Poppins does not nudge members on holiday.',
        createdAt: now,
      };
    }
    return {
      id: `tool-nudge-${now}`,
      kind: 'nudge',
      label: `Nudged ${args.memberName ?? 'member'}`,
      detail: String(args.reason ?? ''),
      createdAt: now,
    };
  }

  if (name === 'assess_xp_fairness') {
    const rec = result.recommendation as { detail?: string } | null;
    return {
      id: `tool-xp-${now}`,
      kind: 'xp_fairness',
      label: 'Assessed XP fairness',
      detail: rec?.detail ?? `Gap ${String(result.gap ?? 0)} XP this week`,
      createdAt: now,
    };
  }

  if (name === 'scan_deals') {
    const deals = Array.isArray(result.deals) ? result.deals : [];
    return {
      id: `tool-deals-${now}`,
      kind: 'deals',
      label: deals.length ? `Found ${deals.length} deals` : 'Scanned deals',
      detail: deals.length
        ? deals
            .slice(0, 3)
            .map((d: { title?: string; store?: string }) => `${d.title} @ ${d.store}`)
            .join(' · ')
        : 'No strong matches right now',
      createdAt: now,
    };
  }

  if (name === 'ask_for_info') {
    return {
      id: `tool-ask-${now}`,
      kind: 'ask_info',
      label: `Asked ${args.memberName ?? 'member'}`,
      detail: String(args.question ?? ''),
      createdAt: now,
    };
  }

  if (name === 'list_holidays') {
    const holidays = Array.isArray(result.holidays) ? result.holidays : [];
    return {
      id: `tool-holiday-${now}`,
      kind: 'holiday',
      label: 'Checked holidays',
      detail: holidays.length
        ? holidays.map((h: { name?: string }) => h.name).join(', ')
        : 'Nobody away',
      createdAt: now,
    };
  }

  if (name === 'list_overdue_tasks') {
    const overdue = Array.isArray(result.overdue) ? result.overdue : [];
    return {
      id: `tool-overdue-${now}`,
      kind: 'monitor',
      label: overdue.length ? `${overdue.length} overdue` : 'No overdue tasks',
      detail: overdue
        .slice(0, 3)
        .map((t: { title?: string; assignee?: string }) => `${t.title} · ${t.assignee}`)
        .join(' · '),
      createdAt: now,
    };
  }

  return {
    id: `tool-${name}-${now}`,
    kind: 'monitor',
    label: name.replace(/_/g, ' '),
    detail: JSON.stringify(args).slice(0, 160),
    createdAt: now,
  };
}

/**
 * Client-safe Poppins tool executor (mirrors edge `_shared/execute-poppins-tool.ts`).
 * Returns structured results; callers apply notifications / Activity side effects.
 */

import { scanDealsForHousehold } from '@/data/mock-deals';
import {
  isRiskyPoppinsTool,
  POPPINS_NAV_ROUTES,
  type PoppinsToolName,
} from '@/lib/ai/poppins-tools';
import { isIuiScene, IUI_SCENES } from '@/lib/poppins/ui-scenes';
import { isAssignSurfaceRoute, isGrocerySurfaceRoute } from '@/lib/poppins/catalog-match';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import { houseRulesHouseholdView } from '@/lib/rules/household-view';
import { searchHouseRules } from '@/lib/rules/search';
import { visibleRules } from '@/lib/rules/visible-rules';
import type { HouseholdSnapshot, OrbitMetrics, PoppinsMonitorAction } from '@/types/orbit';

export type PoppinsToolResult = Record<string, unknown>;

export type ExecutePoppinsToolOptions = {
  /** Voice path: stage risky tools as pending_confirmations instead of executing. */
  forceRiskyConfirmation?: boolean;
};

function isAway(member: { awayFrom?: string; awayTo?: string }, now = new Date()) {
  if (!member.awayFrom || !member.awayTo) return false;
  const t = now.toISOString().slice(0, 10);
  return t >= member.awayFrom && t <= member.awayTo;
}

function pendingConfirm(
  name: string,
  args: Record<string, unknown>,
  summary: string
): PoppinsToolResult {
  const id = `pc-${name}-${Date.now()}`;
  return {
    pending_confirmations: [
      {
        id,
        tool: name,
        args,
        summary,
      },
    ],
    ui_actions: [
      {
        type: 'confirm',
        confirmSummary: summary,
        confirmationIds: [id],
      },
    ],
    note: 'Awaiting user confirmation before executing.',
  };
}

function peekAction(
  rows: Array<{ id?: unknown; title?: unknown; name?: unknown; assignee?: unknown }>,
  thinkingLine: string
) {
  return {
    type: 'list_peek' as const,
    thinkingLine,
    rows: rows.slice(0, 3).map((row) => ({
      id: row.id,
      title: row.title ?? row.name,
      assignee: row.assignee,
    })),
  };
}

export function executePoppinsTool(
  name: PoppinsToolName | string,
  args: Record<string, unknown>,
  household: HouseholdSnapshot,
  metrics: OrbitMetrics,
  options: ExecutePoppinsToolOptions = {}
): PoppinsToolResult {
  const tasks = household.tasks;
  const events = household.events;
  const members = household.members;

  if (options.forceRiskyConfirmation && isRiskyPoppinsTool(name)) {
    const summary = `${name.replace(/_/g, ' ')}: ${JSON.stringify(args).slice(0, 120)}`;
    return pendingConfirm(name, args, summary);
  }

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
      return { overdue, ui_actions: [peekAction(overdue, 'Overdue')] };
    }
    case 'list_tasks': {
      const limit = typeof args.limit === 'number' ? Math.min(20, Math.max(1, args.limit)) : 12;
      const assignee = args.assignee ? String(args.assignee).toLowerCase() : '';
      const status = args.status ? String(args.status).toLowerCase() : '';
      const open = tasks
        .filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled')
        .filter((t) => !assignee || t.assignee?.toLowerCase().includes(assignee))
        .filter((t) => !status || String(t.status).toLowerCase().includes(status))
        .slice(0, limit)
        .map((t) => ({
          id: t.id,
          title: t.title,
          assignee: t.assignee,
          due: t.due,
          status: t.status,
        }));
      return { tasks: open, ui_actions: [peekAction(open, 'Open tasks')] };
    }
    case 'nudge_member': {
      const memberName = String(args.memberName ?? '');
      const away = members.some(
        (m) => m.name.toLowerCase() === memberName.toLowerCase() && isAway(m)
      );
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
      const categories = Array.isArray(args.categories)
        ? (args.categories as Array<'grocery' | 'shoes' | 'electronics' | 'furniture'>)
        : undefined;
      const groceryNames = household.groceries
        .filter((g) => g.status === 'Missing' || g.status === 'Low')
        .map((g) => g.name);
      return { deals: scanDealsForHousehold({ groceryNames, categories }) };
    }
    case 'list_groceries': {
      const status = args.status ? String(args.status) : '';
      const groceries = household.groceries
        .filter((g) => !status || g.status === status)
        .slice(0, 30)
        .map((g) => ({ id: g.id, name: g.name, status: g.status, category: g.category }));
      return {
        groceries,
        ui_actions: [peekAction(groceries, 'Groceries')],
      };
    }
    case 'add_grocery': {
      const groceryName = String(args.name ?? '').trim();
      if (!groceryName) return { error: 'name_required' };
      const lane = args.lane === 'clothing' ? 'clothing' : undefined;
      const releaseDate = args.releaseDate ? String(args.releaseDate) : undefined;
      const ui_actions: Array<Record<string, unknown>> = [
        {
          type: 'add_grocery',
          name: groceryName,
          category: args.category ? String(args.category) : lane === 'clothing' ? 'Clothing' : undefined,
          lane,
        },
      ];
      if (releaseDate) {
        ui_actions.push({
          type: 'create_calendar_event',
          title: `${groceryName} drop`,
          date: releaseDate,
        });
      }
      return {
        ui_actions,
        note: `Staged add ${lane === 'clothing' ? 'shopping' : 'grocery'}: ${groceryName}`,
      };
    }
    case 'set_grocery_status': {
      return {
        ui_actions: [
          {
            type: 'set_grocery_status',
            name: String(args.name ?? ''),
            status: String(args.status ?? 'Purchased'),
          },
        ],
      };
    }
    case 'read_calendar': {
      const limit = typeof args.days === 'number' ? Math.min(14, Math.max(1, args.days)) : 7;
      return {
        events: events.slice(0, limit).map((e) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          time: e.time,
          responsible: e.responsible,
          category: e.category,
        })),
        ui_actions: [
          peekAction(
            events.slice(0, 3).map((e) => ({ id: e.id, title: e.title, assignee: e.responsible })),
            'Upcoming'
          ),
        ],
      };
    }
    case 'list_holidays': {
      return {
        holidays: members
          .filter((m) => isAway(m))
          .map((m) => ({ name: m.name, awayFrom: m.awayFrom, awayTo: m.awayTo })),
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
          data: { kind: 'propose_plan', dayLabel, planTitle: title, planDetail: detail },
        },
        planDraft: { title, detail, dayLabel, href: '/create-itinerary' },
        ui_actions: [
          {
            type: 'create_itinerary',
            title,
          },
        ],
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
    case 'list_members': {
      const active = members
        .filter((m) => m.status === 'active')
        .map((m) => ({ id: m.id, name: m.name, role: m.role, weekXp: m.weekXp ?? 0 }));
      return {
        members: active,
        ui_actions: [
          {
            type: 'member_pick',
            faces: active.slice(0, 3).map((m) => ({ id: m.id, name: m.name })),
          },
        ],
      };
    }
    case 'list_rewards': {
      return {
        rewards: (household.rewards ?? []).slice(0, 20).map((r) => ({
          id: r.id,
          title: r.title ?? (r as { name?: string }).name,
          cost: r.cost,
        })),
      };
    }
    case 'get_pending_approvals': {
      const pendingRedemptions = (household.rewards ?? [])
        .filter((r) => (r as { pending?: boolean }).pending)
        .slice(0, 10)
        .map((r) => ({ id: r.id, title: r.title ?? (r as { name?: string }).name }));
      const pendingProofs = tasks
        .filter((t) => /proof|pending.?review|awaiting/i.test(String(t.status ?? '')))
        .slice(0, 10)
        .map((t) => ({ id: t.id, title: t.title, status: t.status }));
      return {
        pendingProofs,
        pendingRedemptions,
        pendingAllowances: [],
        note: 'Allowances pending review are confirmed in-app when available.',
      };
    }
    case 'get_briefing_snapshot': {
      const overdue = tasks.filter(
        (t) =>
          t.status === 'Overdue' ||
          t.status === 'Expired' ||
          t.status === 'Missed' ||
          /overdue|expired/i.test(String(t.due ?? ''))
      ).length;
      return {
        householdName: household.householdName,
        greetingName: household.greetingName,
        openTasks: metrics.openTasks,
        overdue,
        upcomingEvents: events.slice(0, 5).map((e) => ({
          title: e.title,
          date: e.date,
          time: e.time,
        })),
        groceryGaps: household.groceries
          .filter((g) => g.status === 'Missing' || g.status === 'Low')
          .slice(0, 8)
          .map((g) => ({ name: g.name, status: g.status })),
        momentum: metrics.momentum,
      };
    }
    case 'get_unread_notifications': {
      return {
        notifications: [],
        note: 'Unread notifications are resolved by the live app session.',
        limit: typeof args.limit === 'number' ? args.limit : 10,
      };
    }
    case 'list_itineraries': {
      const limit = typeof args.limit === 'number' ? Math.min(20, Math.max(1, args.limit)) : 8;
      const status = args.status ? String(args.status).toLowerCase() : 'any';
      return {
        itineraries: (household.itineraries ?? [])
          .filter((it) => {
            if (status === 'any') return true;
            return String((it as { status?: string }).status ?? '')
              .toLowerCase()
              .includes(status);
          })
          .slice(0, limit)
          .map((it) => ({
            id: it.id,
            title: it.title,
            status: (it as { status?: string }).status,
          })),
      };
    }
    case 'get_smart_home_state': {
      return {
        linked: false,
        scenes: [],
        note: 'Smart home is optional — connect in Settings when available.',
      };
    }
    case 'search_house_rules': {
      try {
        const doc = getHouseRulesDoc();
        const groups = visibleRules(doc, houseRulesHouseholdView(household));
        const voice: 'admin' | 'sidekick' =
          args.voice === 'sidekick' || args.voice === 'kid' ? 'sidekick' : 'admin';
        const hits = searchHouseRules(groups, String(args.query ?? ''), voice).slice(0, 6);
        return {
          hits: hits.map((r) => ({
            id: r.id,
            question: voice === 'sidekick' ? r.sidekick.headline : r.admin.headline,
            answer: voice === 'sidekick' ? r.sidekick.body : r.admin.clause,
          })),
        };
      } catch (error) {
        return { error: String(error), hits: [] };
      }
    }
    case 'create_task_draft': {
      return {
        ui_actions: [
          {
            type: 'create_task_draft',
            title: String(args.title ?? ''),
            assignee: args.assignee ? String(args.assignee) : undefined,
            due: args.due ? String(args.due) : undefined,
            detail: args.detail ? String(args.detail) : undefined,
            category: args.category ? String(args.category) : undefined,
            libraryTaskId: args.libraryTaskId ? String(args.libraryTaskId) : undefined,
            taskQuery: args.taskQuery ? String(args.taskQuery) : undefined,
          },
        ],
        note: 'Staged Assign on the IUI stage. HOLD silence commits.',
      };
    }
    case 'update_task': {
      const taskId = String(args.taskId ?? '');
      const match = tasks.find((t) => t.id === taskId);
      if (!match) return { error: 'task_not_found' };
      return {
        ui_actions: [
          {
            type: 'update_task',
            taskId: match.id,
            patch: {
              title: args.title,
              assignee: args.assignee,
              due: args.due,
              status: args.status,
              detail: args.detail,
            },
          },
        ],
        note: `Staged update: ${match.title}`,
      };
    }
    case 'complete_task': {
      const taskId = args.taskId ? String(args.taskId) : '';
      const title = args.title ? String(args.title).toLowerCase() : '';
      const match =
        tasks.find((t) => t.id === taskId) ||
        tasks.find((t) => title && t.title.toLowerCase().includes(title));
      if (!match) return { error: 'task_not_found' };
      return {
        ui_actions: [{ type: 'complete_task', taskId: match.id, title: match.title }],
        note: `Staged complete: ${match.title}`,
      };
    }
    case 'create_calendar_event': {
      return {
        ui_actions: [
          {
            type: 'create_calendar_event',
            title: String(args.title ?? ''),
            date: args.date ? String(args.date) : undefined,
            time: args.time ? String(args.time) : undefined,
            location: args.location ? String(args.location) : undefined,
            notes: args.notes ? String(args.notes) : undefined,
          },
        ],
        note: 'Staged event on the IUI stage. HOLD silence commits.',
      };
    }
    case 'create_itinerary': {
      return {
        ui_actions: [
          {
            type: 'create_itinerary',
            title: String(args.title ?? ''),
            startsAt: args.startsAt ? String(args.startsAt) : undefined,
            notes: args.notes ? String(args.notes) : undefined,
          },
        ],
        note: 'Staged itinerary stop on the IUI stage. HOLD silence commits.',
      };
    }
    case 'advance_itinerary_stop': {
      return {
        ui_actions: [
          {
            type: 'advance_itinerary_stop',
            itineraryId: String(args.itineraryId ?? ''),
          },
        ],
      };
    }
    case 'claim_reward': {
      return {
        ui_actions: [{ type: 'claim_reward', rewardName: String(args.rewardName ?? '') }],
      };
    }
    case 'navigate_to': {
      const route = String(args.route ?? '');
      const openEditor = args.openEditor === true;
      if (isAssignSurfaceRoute(route) && !openEditor) {
        return {
          ui_actions: [
            {
              type: 'create_task_draft',
              title: args.title ? String(args.title) : '',
              assignee: args.assignee ? String(args.assignee) : undefined,
              category: args.category ? String(args.category) : undefined,
            },
          ],
          note: 'Staged Assign on the IUI stage instead of opening the full screen.',
        };
      }
      if (isGrocerySurfaceRoute(route) && !openEditor) {
        const groceryName = String(args.name ?? args.title ?? '').trim();
        if (groceryName) {
          return {
            ui_actions: [{ type: 'add_grocery', name: groceryName }],
            note: `Staged add grocery: ${groceryName}`,
          };
        }
        return {
          ui_actions: [
            {
              type: 'present_ui_scene',
              scene: 'thinking',
              payload: { thinkingLine: 'What should I add?' },
            },
          ],
          note: 'Ask what to add — do not coach-navigate the grocery list.',
        };
      }
      const allowed = (POPPINS_NAV_ROUTES as readonly string[]).includes(route);
      if (!allowed) {
        return { error: 'route_not_allowed', route, allowed: POPPINS_NAV_ROUTES };
      }
      return {
        ui_actions: [
          {
            type: 'navigate',
            route,
            openEditor: openEditor || undefined,
            reason: args.reason ?? 'Opening that now.',
          },
        ],
      };
    }
    case 'present_ui_scene': {
      const scene = String(args.scene ?? 'thinking');
      if (!isIuiScene(scene)) {
        return { error: 'unknown_scene', scene, allowed: IUI_SCENES };
      }
      return {
        ui_actions: [
          {
            type: 'present_ui_scene',
            scene,
            payload: args.payload && typeof args.payload === 'object' ? args.payload : {},
            commit: args.commit,
          },
        ],
      };
    }
    case 'delete_task':
    case 'clear_grocery_list':
    case 'delete_event':
    case 'approve_redemption':
    case 'reject_redemption':
    case 'approve_allowance':
    case 'reject_allowance':
    case 'grant_allowance':
    case 'remove_member':
    case 'change_member_role':
    case 'mass_reassign_tasks':
    case 'recess_everyone':
    case 'run_smart_home_scene':
    case 'update_reward_model': {
      return pendingConfirm(name, args, `${name.replace(/_/g, ' ')} requires confirmation`);
    }
    case 'ui_confirm_pending': {
      return {
        acknowledged: true,
        confirmationIds: Array.isArray(args.confirmationIds) ? args.confirmationIds : [],
      };
    }
    case 'end_session': {
      return { session_control: 'end', reason: args.reason ? String(args.reason) : 'done' };
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

  if (name === 'navigate_to') {
    return {
      id: `tool-nav-${now}`,
      kind: 'monitor',
      label: `Navigate ${String(args.route ?? '')}`,
      detail: String(args.reason ?? ''),
      createdAt: now,
    };
  }

  if (name === 'end_session') {
    return {
      id: `tool-end-${now}`,
      kind: 'monitor',
      label: 'Ended voice session',
      detail: String(args.reason ?? result.reason ?? ''),
      createdAt: now,
    };
  }

  if (result.pending_confirmations) {
    return {
      id: `tool-pending-${now}`,
      kind: 'monitor',
      label: `Needs confirmation · ${name}`,
      detail: JSON.stringify(args).slice(0, 160),
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

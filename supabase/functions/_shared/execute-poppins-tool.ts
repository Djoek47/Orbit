/** Shared tool executor for chat + monitor + voice-tool edge functions. */

import { isRiskyPoppinsTool, scanGroceryNeeds } from './poppins-tools.ts';

export type HouseholdSnapshotEdge = {
  tasks?: Array<Record<string, unknown>>;
  groceries?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  members?: Array<Record<string, unknown>>;
  rewards?: Array<Record<string, unknown>>;
  itineraries?: Array<Record<string, unknown>>;
  householdName?: string;
  greetingName?: string;
  desk?: Record<string, unknown>;
  rewardModel?: string;
  homeworkEnabled?: boolean;
  majordomoProfileId?: string;
};

export type ExecutePoppinsToolOptions = {
  forceRiskyConfirmation?: boolean;
};

function pendingConfirm(
  name: string,
  args: Record<string, unknown>,
  summary: string
): Record<string, unknown> {
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

const IUI_SCENES = [
  'thinking',
  'task_compose',
  'calendar_zoom',
  'itinerary_stage',
  'grocery_add',
  'reward_mint',
  'list_peek',
  'member_pick',
  'confirm',
  'navigate_coach',
] as const;

function peekAction(
  rows: Array<Record<string, unknown>>,
  thinkingLine: string
) {
  return {
    type: 'list_peek',
    thinkingLine,
    rows: rows.slice(0, 3).map((row) => ({
      id: row.id,
      title: row.title ?? row.name,
      assignee: row.assignee ?? row.responsible,
    })),
  };
}

export function executePoppinsTool(
  name: string,
  args: Record<string, unknown>,
  household: HouseholdSnapshotEdge,
  metrics: Record<string, unknown>,
  options: ExecutePoppinsToolOptions = {}
): Record<string, unknown> {
  const tasks = household.tasks ?? [];
  const groceries = household.groceries ?? [];
  const events = household.events ?? [];
  const members = household.members ?? [];
  const rewards = household.rewards ?? [];
  const itineraries = household.itineraries ?? [];

  if (options.forceRiskyConfirmation && isRiskyPoppinsTool(name)) {
    return pendingConfirm(
      name,
      args,
      `${name.replace(/_/g, ' ')}: ${JSON.stringify(args).slice(0, 120)}`
    );
  }

  switch (name) {
    case 'list_overdue_tasks': {
      const overdue = tasks.filter(
        (t) =>
          t.status === 'Overdue' ||
          t.status === 'overdue' ||
          /overdue|expired/i.test(String(t.due ?? ''))
      );
      const sliced = overdue.slice(0, 10);
      return { overdue: sliced, ui_actions: [peekAction(sliced, 'Overdue')] };
    }
    case 'list_tasks': {
      const limit = typeof args.limit === 'number' ? Math.min(20, Math.max(1, args.limit)) : 12;
      const assignee = args.assignee ? String(args.assignee).toLowerCase() : '';
      const status = args.status ? String(args.status).toLowerCase() : '';
      const open = tasks
        .filter((t) => t.status !== 'Done' && t.status !== 'Completed' && t.status !== 'done')
        .filter(
          (t) => !assignee || String(t.assignee ?? '').toLowerCase().includes(assignee)
        )
        .filter((t) => !status || String(t.status ?? '').toLowerCase().includes(status))
        .slice(0, limit);
      return { tasks: open, ui_actions: [peekAction(open, 'Open tasks')] };
    }
    case 'nudge_member': {
      const memberName = String(args.memberName ?? args.member_id ?? '');
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
        taskId: args.taskId ?? args.related_task_id,
        reason: args.reason ?? args.message,
        notification: {
          title: 'Poppins · Nudge',
          body: `${memberName}: ${args.reason ?? args.message}`,
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
      return { deals: scanGroceryNeeds(groceryNames, categories) };
    }
    case 'list_groceries':
    case 'get_grocery_gaps': {
      const status = args.status ? String(args.status) : '';
      const filtered = groceries.filter((g) => {
        if (!status || status === 'any') {
          return g.status === 'Missing' || g.status === 'Low' || !status;
        }
        return String(g.status) === status;
      });
      return {
        groceries: filtered.slice(0, 30).map((g) => ({
          id: g.id,
          name: g.name,
          status: g.status,
          category: g.category,
        })),
      };
    }
    case 'add_grocery':
    case 'add_grocery_item': {
      const groceryName = String(args.name ?? '').trim();
      if (!groceryName) return { error: 'name_required' };
      return {
        ui_actions: [
          {
            type: 'add_grocery',
            name: groceryName,
            category: args.category ? String(args.category) : undefined,
            status: args.status ? String(args.status) : 'Missing',
          },
        ],
        note: `Staged add grocery: ${groceryName}`,
      };
    }
    case 'set_grocery_status':
    case 'update_grocery_status': {
      return {
        ui_actions: [
          {
            type: 'set_grocery_status',
            itemId: args.item_id ?? args.itemId,
            name: String(args.name ?? ''),
            status: String(args.status ?? 'Purchased'),
          },
        ],
      };
    }
    case 'read_calendar':
    case 'get_calendar_agenda': {
      const limit =
        typeof args.days === 'number'
          ? Math.min(14, Math.max(1, args.days))
          : typeof args.days_ahead === 'number'
            ? Math.min(14, Math.max(1, args.days_ahead))
            : 7;
      return {
        events: events.slice(0, limit),
        ui_actions: [peekAction(events.slice(0, 3), 'Upcoming')],
      };
    }
    case 'list_holidays':
    case 'get_recess_status': {
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
        ui_actions: [{ type: 'create_itinerary', title }],
      };
    }
    case 'ask_for_info': {
      const memberName = String(args.memberName ?? args.member_id ?? 'member');
      return {
        notification: {
          title: 'Poppins needs a detail',
          body: `${memberName}, ${args.question}`,
          data: { kind: 'ask_for_info' },
        },
      };
    }
    case 'list_members': {
      const active = members
        .filter((m) => m.status === 'active')
        .map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
          weekXp: m.weekXp ?? m.week_xp ?? 0,
        }));
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
        rewards: rewards.slice(0, 20).map((r) => ({
          id: r.id,
          title: r.title ?? r.name,
          cost: r.cost,
        })),
      };
    }
    case 'search_house_rules': {
      return {
        hits: [],
        note: 'House rules search is resolved on-device; ask the user to open House Rules if needed.',
        query: String(args.query ?? ''),
      };
    }
    case 'get_pending_approvals': {
      return {
        pendingProofs: tasks
          .filter((t) => /proof|pending.?review|awaiting/i.test(String(t.status ?? '')))
          .slice(0, 10),
        pendingRedemptions: rewards.filter((r) => r.pending === true).slice(0, 10),
        pendingAllowances: [],
      };
    }
    case 'get_briefing_snapshot': {
      return {
        householdName: household.householdName,
        greetingName: household.greetingName,
        desk: household.desk ?? {},
        metrics,
        openTasks: metrics.openTasks,
        upcomingEvents: events.slice(0, 5),
      };
    }
    case 'get_unread_notifications': {
      return {
        notifications: [],
        note: 'Unread notifications are resolved by the live app session.',
      };
    }
    case 'list_itineraries': {
      const limit = typeof args.limit === 'number' ? Math.min(20, Math.max(1, args.limit)) : 8;
      return { itineraries: itineraries.slice(0, limit) };
    }
    case 'get_smart_home_state': {
      return { linked: false, scenes: [], note: 'Smart home is optional.' };
    }
    case 'create_task_draft':
    case 'create_task': {
      return {
        ui_actions: [
          {
            type: 'create_task_draft',
            title: String(args.title ?? ''),
            assignee: args.assignee ?? args.assignee_id,
            due: args.due ?? args.due_at,
            detail: args.detail ?? args.description,
          },
        ],
        note: 'Staged task on the IUI stage. HOLD silence commits.',
      };
    }
    case 'update_task': {
      return {
        ui_actions: [
          {
            type: 'update_task',
            taskId: args.taskId ?? args.task_id,
            patch: args,
          },
        ],
      };
    }
    case 'complete_task': {
      const taskId = String(args.taskId ?? args.task_id ?? '');
      const title = String(args.title ?? '').toLowerCase();
      const match =
        tasks.find((t) => String(t.id) === taskId) ||
        tasks.find((t) => title && String(t.title ?? '').toLowerCase().includes(title));
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
            date: args.date ?? args.starts_at,
            time: args.time,
            location: args.location,
            notes: args.notes,
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
            startsAt: args.startsAt ?? args.starts_at,
            notes: args.notes,
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
            itineraryId: args.itineraryId ?? args.itinerary_id,
          },
        ],
      };
    }
    case 'claim_reward': {
      return {
        ui_actions: [
          {
            type: 'claim_reward',
            rewardName: args.rewardName,
            rewardId: args.reward_id ?? args.rewardId,
          },
        ],
      };
    }
    case 'navigate_to': {
      return {
        ui_actions: [
          {
            type: 'navigate',
            route: String(args.route ?? ''),
            reason: args.reason ?? 'I can open that for you.',
            params: args.params,
          },
        ],
      };
    }
    case 'present_ui_scene': {
      const scene = String(args.scene ?? 'thinking');
      if (!(IUI_SCENES as readonly string[]).includes(scene)) {
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
    case 'wipe_grocery_list':
    case 'delete_event':
    case 'delete_calendar_event':
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
        confirmationIds: Array.isArray(args.confirmationIds)
          ? args.confirmationIds
          : Array.isArray(args.confirmation_ids)
            ? args.confirmation_ids
            : [],
      };
    }
    case 'end_session': {
      return {
        session_control: 'end',
        reason: args.reason ? String(args.reason) : 'done',
        farewell: args.farewell,
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
          detail: String(args.reason ?? args.message ?? ''),
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
      continue;
    }
    if (result.pending_confirmations) {
      actions.push({
        id: `chat-pending-${now}-${actions.length}`,
        kind: 'monitor',
        label: `Needs confirmation · ${tool}`,
        detail: JSON.stringify(args).slice(0, 160),
        createdAt: now,
        data: { pending_confirmations: result.pending_confirmations },
      });
      continue;
    }
    if (tool === 'end_session') {
      actions.push({
        id: `chat-end-${now}-${actions.length}`,
        kind: 'monitor',
        label: 'Ended voice session',
        detail: String(args.reason ?? result.reason ?? ''),
        createdAt: now,
      });
    }
  }

  return actions;
}

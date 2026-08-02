// Deno Edge Function — Poppins Monitor Agent (tool loop → notifications + ai_recommendations).
// Auth: service role for cron, or JWT + active member for "Run Poppins check now".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  buildCompactHouseholdContext,
  corsHeaders,
  jsonResponse,
  requireActiveMember,
} from '../_shared/poppins-auth.ts';
import {
  POPPINS_MAJORDOMO_SYSTEM,
  poppinsToolsAsOpenAIFunctions,
  scanMockDeals,
} from '../_shared/poppins-tools.ts';

type Snapshot = {
  tasks?: Array<Record<string, unknown>>;
  groceries?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  members?: Array<Record<string, unknown>>;
  householdName?: string;
  greetingName?: string;
};

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key);
}

function isServiceRole(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return Boolean(serviceKey) && auth === `Bearer ${serviceKey}`;
}

async function writeNotification(
  supabase: ReturnType<typeof serviceClient>,
  householdId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) {
  await supabase.from('notifications').insert({
    household_id: householdId,
    title,
    body,
    category: 'ai',
    priority: 'medium',
    data,
  });
}

async function writeRecommendation(
  supabase: ReturnType<typeof serviceClient>,
  householdId: string,
  title: string,
  detail: string,
  tone = 'cyan'
) {
  await supabase.from('ai_recommendations').insert({
    household_id: householdId,
    title,
    detail,
    tone,
    status: 'active',
  });
}

function executeTool(
  name: string,
  args: Record<string, unknown>,
  household: Snapshot,
  metrics: Record<string, unknown>
) {
  const tasks = household.tasks ?? [];
  const groceries = household.groceries ?? [];
  const events = household.events ?? [];
  const members = household.members ?? [];

  switch (name) {
    case 'list_overdue_tasks': {
      const overdue = tasks.filter(
        (t) => t.status === 'Overdue' || t.status === 'overdue' || /overdue/i.test(String(t.due ?? ''))
      );
      return { overdue: overdue.slice(0, 10) };
    }
    case 'nudge_member': {
      return {
        action: 'nudge',
        memberName: args.memberName,
        taskId: args.taskId,
        reason: args.reason,
        notification: {
          title: 'Poppins · Nudge',
          body: `${args.memberName}: ${args.reason}`,
          data: { kind: 'nudge', taskId: args.taskId },
        },
      };
    }
    case 'assess_xp_fairness': {
      const active = members.filter((m) => m.status === 'active' && m.role !== 'guest');
      const sorted = [...active].sort(
        (a, b) => Number(b.weekXp ?? b.week_xp ?? 0) - Number(a.weekXp ?? a.week_xp ?? 0)
      );
      if (sorted.length < 2) return { gap: 0, recommendation: null };
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];
      const gap = Number(top.weekXp ?? top.week_xp ?? 0) - Number(bottom.weekXp ?? bottom.week_xp ?? 0);
      const detail = `${top.name} earned ${top.weekXp ?? top.week_xp ?? 0} XP this week vs ${bottom.name}'s ${bottom.weekXp ?? bottom.week_xp ?? 0}. Consider rebalancing tasks.`;
      return {
        gap,
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
        note: 'XP awards are owned by the app on verified completion — Monitor only confirms.',
      };
    }
    case 'scan_deals': {
      const groceryNames = groceries
        .filter((g) => g.status === 'Missing' || g.status === 'Low' || g.status === 'missing' || g.status === 'low')
        .map((g) => String(g.name ?? ''));
      const categories = Array.isArray(args.categories) ? (args.categories as string[]) : undefined;
      const deals = scanMockDeals(groceryNames, categories);
      return { deals };
    }
    case 'read_calendar': {
      const limit = typeof args.days === 'number' ? Math.min(14, args.days) : 7;
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
      return {
        recommendation: {
          title: String(args.title ?? 'Proposed plan'),
          detail: String(args.detail ?? ''),
          tone: 'cyan',
        },
        notification: {
          title: 'Poppins · Plan suggestion',
          body: String(args.detail ?? args.title ?? 'Poppins proposed a plan.'),
          data: { kind: 'propose_plan', dayLabel: args.dayLabel },
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

async function runToolLoop(
  openaiKey: string,
  household: Snapshot,
  metrics: Record<string, unknown>
) {
  const context = buildCompactHouseholdContext(household as Record<string, unknown>);
  const messages: Array<Record<string, unknown>> = [
    {
      role: 'system',
      content: `${POPPINS_MAJORDOMO_SYSTEM}\nHousehold snapshot: ${JSON.stringify({ metrics, ...context })}`,
    },
    {
      role: 'user',
      content:
        'Run a Monitor pass. Use tools to assess overdue tasks, streaks, XP fairness, deals, calendar/holidays, and propose at most 2–4 concrete actions. Prefer notifying over mutating. Then summarize what you did.',
    },
  ];

  const effects: Array<Record<string, unknown>> = [];
  let summary = '';

  for (let step = 0; step < 6; step++) {
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        tools: poppinsToolsAsOpenAIFunctions(),
        tool_choice: step === 0 ? 'required' : 'auto',
      }),
    });

    const payload = await completion.json();
    const message = payload.choices?.[0]?.message;
    if (!message) break;

    messages.push(message);
    const toolCalls = message.tool_calls ?? [];
    if (!toolCalls.length) {
      summary = String(message.content ?? '');
      break;
    }

    for (const call of toolCalls) {
      const name = call.function?.name ?? '';
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function?.arguments ?? '{}');
      } catch {
        args = {};
      }
      const result = executeTool(name, args, household, metrics);
      effects.push({ tool: name, args, result });
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return { effects, summary };
}

async function persistEffects(
  supabase: ReturnType<typeof serviceClient>,
  householdId: string,
  effects: Array<Record<string, unknown>>
) {
  const actions: Array<{ kind: string; label: string; detail: string }> = [];

  for (const effect of effects) {
    const result = effect.result as Record<string, unknown>;
    const tool = String(effect.tool);

    if (result?.notification && typeof result.notification === 'object') {
      const n = result.notification as { title: string; body: string; data?: Record<string, unknown> };
      await writeNotification(supabase, householdId, n.title, n.body, n.data ?? {});
      actions.push({ kind: tool, label: n.title, detail: n.body });
    }

    if (result?.recommendation && typeof result.recommendation === 'object') {
      const r = result.recommendation as { title: string; detail: string; tone?: string };
      await writeRecommendation(supabase, householdId, r.title, r.detail, r.tone ?? 'cyan');
      actions.push({ kind: tool, label: r.title, detail: r.detail });
    }

    if (tool === 'scan_deals' && Array.isArray(result?.deals) && (result.deals as unknown[]).length) {
      const deals = result.deals as Array<{ title: string; store: string; savings: number }>;
      const top = deals.slice(0, 3);
      const body = top.map((d) => `${d.title} at ${d.store} (save $${d.savings})`).join(' · ');
      await writeNotification(supabase, householdId, `Poppins · ${top.length} deals found`, body, {
        kind: 'deals',
      });
      await writeRecommendation(supabase, householdId, 'Worth grabbing on the next run', body, 'green');
      actions.push({ kind: 'deals', label: `Found ${top.length} deals`, detail: body });
    }

    if (tool === 'list_overdue_tasks' && Array.isArray((result as { overdue?: unknown[] }).overdue)) {
      const overdue = (result as { overdue: Array<{ title?: string; assignee?: string; id?: string }> }).overdue;
      for (const task of overdue.slice(0, 3)) {
        const title = String(task.title ?? 'Task');
        const assignee = String(task.assignee ?? 'someone');
        await writeNotification(
          supabase,
          householdId,
          'Poppins · Task is late',
          `${title} for ${assignee} is overdue. Want me to nudge or reassign?`,
          { kind: 'task_overdue', taskId: task.id }
        );
        actions.push({ kind: 'nudge', label: `Nudged ${assignee}`, detail: title });
      }
    }
  }

  return actions;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const householdId = body.householdId as string | undefined;
    const metrics = (body.metrics ?? {}) as Record<string, unknown>;
    const household = (body.household ?? {}) as Snapshot;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    const cron = isServiceRole(req);
    if (!cron) {
      const auth = await requireActiveMember(req.headers.get('Authorization'), householdId);
      if (auth.error) return auth.error;
    } else if (!householdId) {
      return jsonResponse({ error: 'householdId required for cron invoke' }, 400);
    }

    if (!householdId) {
      return jsonResponse({ error: 'householdId required' }, 400);
    }

    const supabase = serviceClient();
    let effects: Array<Record<string, unknown>> = [];
    let summary = '';

    if (openaiKey) {
      const loop = await runToolLoop(openaiKey, household, metrics);
      effects = loop.effects;
      summary = loop.summary;
    } else {
      // Deterministic fallback without OpenAI
      const overdue = executeTool('list_overdue_tasks', {}, household, metrics);
      const deals = executeTool('scan_deals', {}, household, metrics);
      const fairness = executeTool('assess_xp_fairness', {}, household, metrics);
      effects = [
        { tool: 'list_overdue_tasks', args: {}, result: overdue },
        { tool: 'scan_deals', args: {}, result: deals },
        { tool: 'assess_xp_fairness', args: {}, result: fairness },
      ];
      summary = 'Monitor pass completed without OpenAI (deterministic tools).';
    }

    const actions = await persistEffects(supabase, householdId, effects);

    return jsonResponse({
      ok: true,
      householdId,
      summary,
      actions,
      effectCount: effects.length,
      source: openaiKey ? 'openai' : 'deterministic',
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

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
  executePoppinsTool,
  type HouseholdSnapshotEdge,
} from '../_shared/execute-poppins-tool.ts';
import { getOpenAIPoppinsChatModel } from '../_shared/openai-models.ts';
import {
  buildMajordomoSystemPrompt,
  poppinsToolsAsOpenAIFunctions,
} from '../_shared/poppins-tools.ts';

type Snapshot = HouseholdSnapshotEdge;

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

async function runToolLoop(
  openaiKey: string,
  household: Snapshot,
  metrics: Record<string, unknown>
) {
  const context = buildCompactHouseholdContext(household as Record<string, unknown>);
  const desk = household.desk ?? {};
  const profileId = (household.majordomoProfileId as string | undefined) ?? 'poppins';
  const messages: Array<Record<string, unknown>> = [
    {
      role: 'system',
      content:
        `${buildMajordomoSystemPrompt(profileId)}\n` +
        `Desk brief: ${JSON.stringify(desk).slice(0, 2500)}\n` +
        `Household snapshot: ${JSON.stringify({ metrics, ...context }).slice(0, 6000)}`,
    },
    {
      role: 'user',
      content:
        'Run a Monitor pass. Use tools to assess overdue tasks, streaks, XP fairness, deals, calendar/holidays, and propose at most 2–4 concrete actions. Call list_holidays before any nudge. Prefer notifying over mutating. Then summarize what you did.',
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
        model: getOpenAIPoppinsChatModel(),
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
      const result = executePoppinsTool(name, args, household, metrics);
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
  const actions: Array<{
    kind: string;
    label: string;
    detail: string;
    data?: Record<string, unknown>;
  }> = [];

  for (const effect of effects) {
    const result = effect.result as Record<string, unknown>;
    const tool = String(effect.tool);

    if (result?.notification && typeof result.notification === 'object' && !result.skipped) {
      const n = result.notification as { title: string; body: string; data?: Record<string, unknown> };
      await writeNotification(supabase, householdId, n.title, n.body, n.data ?? {});
      const planDraft = result.planDraft as Record<string, unknown> | undefined;
      actions.push({
        kind: tool === 'propose_plan' ? 'plan' : tool,
        label: n.title,
        detail: n.body,
        data: planDraft
          ? {
              dayLabel: planDraft.dayLabel,
              planTitle: planDraft.title,
              planDetail: planDraft.detail,
              href: '/create-itinerary',
            }
          : n.data,
      });
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
      const overdue = executePoppinsTool('list_overdue_tasks', {}, household, metrics);
      const deals = executePoppinsTool('scan_deals', {}, household, metrics);
      const fairness = executePoppinsTool('assess_xp_fairness', {}, household, metrics);
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

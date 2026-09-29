// Deno Edge Function — Poppins Monitor Agent.
// Rules first; model only when needs_prose + kill switch + window + daily cap.
// Auth: service role for cron, or JWT + active member for client session kick.

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
  poppinsMonitorToolsAsOpenAIFunctions,
} from '../_shared/poppins-tools.ts';
import {
  applyTemplates,
  evaluateHouseholdRules,
  withinActiveWindow,
  type FiredMonitorRule,
} from '../_shared/monitor-rules.ts';
import {
  POPPINS_MONITOR_ACTIVE_HOURS,
  POPPINS_MONITOR_MAX_ROUNDS,
  POPPINS_MONITOR_MODEL_CALLS_PER_DAY,
  isMonitorModelEnabled,
} from '../_shared/openai-rates.ts';
import { recordAiUsageEvent, usageFromOpenAIPayload } from '../_shared/ai-usage.ts';

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

async function countMonitorModelCallsToday(
  supabase: ReturnType<typeof serviceClient>,
  householdId: string,
  timezone: string
): Promise<number> {
  // Count monitor rows since local midnight (approx via UTC day bucket + TZ offset not required for soft cap).
  const start = new Date();
  try {
    const local = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(start);
    // en-CA → YYYY-MM-DD
    const dayStart = new Date(`${local}T00:00:00`);
    const { count, error } = await supabase
      .from('ai_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .eq('kind', 'monitor')
      .gte('occurred_at', dayStart.toISOString());
    if (error) {
      console.warn('countMonitorModelCallsToday', error.message);
      return 0;
    }
    return count ?? 0;
  } catch (error) {
    console.warn('countMonitorModelCallsToday failed', error);
    return 0;
  }
}

async function runToolLoop(
  openaiKey: string,
  household: Snapshot,
  metrics: Record<string, unknown>,
  householdId: string,
  maxRounds: number
) {
  const context = buildCompactHouseholdContext(household as Record<string, unknown>);
  const desk = household.desk ?? {};
  const profileId = (household.majordomoProfileId as string | undefined) ?? 'poppins';
  // Shrunk prompt: desk + compact context only (no redundant full dumps).
  const messages: Array<Record<string, unknown>> = [
    {
      role: 'system',
      content:
        `${buildMajordomoSystemPrompt(profileId)}\n` +
        `Desk: ${JSON.stringify(desk).slice(0, 1800)}\n` +
        `Context: ${JSON.stringify({ metrics, ...context }).slice(0, 2800)}`,
    },
    {
      role: 'user',
      content:
        'Run a Monitor pass. Prefer notifying over mutating. Call list_holidays before any nudge. Propose at most 2 concrete actions from the desk. Then summarize.',
    },
  ];

  const effects: Array<Record<string, unknown>> = [];
  let summary = '';
  let totalIn = 0;
  let totalOut = 0;
  let totalCached = 0;
  const model = getOpenAIPoppinsChatModel();
  const tools = poppinsMonitorToolsAsOpenAIFunctions();

  for (let step = 0; step < maxRounds; step++) {
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: step === 0 ? 'required' : 'auto',
      }),
    });

    const payload = await completion.json();
    const usage = usageFromOpenAIPayload(payload);
    totalIn += usage.inputTokens;
    totalOut += usage.outputTokens;
    totalCached += usage.cachedInputTokens;

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

  await recordAiUsageEvent({
    householdId,
    clientKey: `monitor-${householdId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'monitor',
    model,
    inputTokens: totalIn,
    outputTokens: totalOut,
    cachedInputTokens: totalCached,
    surface: 'poppins-monitor',
    mode: 'rules_gated',
  });

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
      const deals = result.deals as Array<{ title: string; store?: string }>;
      const top = deals.slice(0, 3);
      const body = top
        .map((d) => (d.store ? `${d.title} (${d.store})` : d.title))
        .join(' · ');
      await writeRecommendation(supabase, householdId, 'Still on the list', body, 'green');
      actions.push({ kind: 'deals', label: `Still needed: ${top.length}`, detail: body });
    }

    if (tool === 'list_overdue_tasks' && Array.isArray((result as { overdue?: unknown[] }).overdue)) {
      const overdue = (result as { overdue: Array<{ title?: string; assignee?: string }> }).overdue;
      for (const task of overdue.slice(0, 3)) {
        actions.push({
          kind: 'nudge',
          label: `${String(task.assignee ?? 'someone')} is late`,
          detail: String(task.title ?? 'Task'),
        });
      }
    }
  }

  return actions;
}

async function persistTemplateActions(
  supabase: ReturnType<typeof serviceClient>,
  householdId: string,
  rules: FiredMonitorRule[]
) {
  const actions = applyTemplates(rules);
  for (const action of actions) {
    const tone = String(action.data?.tone ?? 'cyan');
    await writeRecommendation(supabase, householdId, action.label, action.detail, tone);
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
    const timezone =
      String(
        (household as { timezone?: string }).timezone ??
          (household as { timeZone?: string }).timeZone ??
          ''
      ).trim() || 'America/Toronto';

    // Prefer live notification_prefs from DB so Settings toggles reach the monitor.
    let householdForRules: Record<string, unknown> = { ...(household as Record<string, unknown>) };
    try {
      const { data: hhRow } = await supabase
        .from('households')
        .select('notification_prefs')
        .eq('id', householdId)
        .maybeSingle();
      if (hhRow?.notification_prefs && typeof hhRow.notification_prefs === 'object') {
        householdForRules = {
          ...householdForRules,
          notification_prefs: hhRow.notification_prefs,
          notificationPrefs: hhRow.notification_prefs,
        };
      }
    } catch (error) {
      console.warn('poppins-monitor prefs load', error);
    }

    const fired = evaluateHouseholdRules(householdForRules, metrics);
    if (!fired.length) {
      return jsonResponse({
        ok: true,
        householdId,
        summary: null,
        actions: [],
        effectCount: 0,
        source: 'rules_idle',
      });
    }

    const prose = fired.filter((r) => r.needsProse);
    const modelAllowed =
      Boolean(openaiKey) &&
      prose.length > 0 &&
      isMonitorModelEnabled() &&
      withinActiveWindow(timezone, POPPINS_MONITOR_ACTIVE_HOURS);

    let effects: Array<Record<string, unknown>> = [];
    let summary: string | null = null;
    let source = 'templates';

    if (modelAllowed) {
      const callsToday = await countMonitorModelCallsToday(supabase, householdId, timezone);
      if (callsToday < POPPINS_MONITOR_MODEL_CALLS_PER_DAY) {
        const loop = await runToolLoop(
          openaiKey!,
          household,
          metrics,
          householdId,
          POPPINS_MONITOR_MAX_ROUNDS
        );
        effects = loop.effects;
        summary = loop.summary || null;
        source = 'openai_gated';
      } else {
        source = 'templates_cap';
      }
    }

    let actions =
      effects.length > 0
        ? await persistEffects(supabase, householdId, effects)
        : await persistTemplateActions(supabase, householdId, fired);

    if (effects.length > 0 && prose.length === 0) {
      // Model path shouldn't run without prose; keep templates as well if empty actions.
      if (!actions.length) {
        actions = await persistTemplateActions(supabase, householdId, fired);
      }
    }

    return jsonResponse({
      ok: true,
      householdId,
      summary,
      actions,
      effectCount: effects.length || fired.length,
      source,
      rulesFired: fired.map((r) => r.kind),
      monitorModel: isMonitorModelEnabled() ? 'on' : 'off',
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

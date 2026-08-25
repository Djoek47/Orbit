// Deno Edge Function — Poppins conversational answers via gpt-5.6-luna + tool loop.

import {
  buildCompactHouseholdContext,
  corsHeaders,
  jsonResponse,
  requireActiveMember,
} from '../_shared/poppins-auth.ts';
import {
  effectsToClientActions,
  executePoppinsTool,
  type HouseholdSnapshotEdge,
} from '../_shared/execute-poppins-tool.ts';
import { getOpenAIPoppinsChatModel } from '../_shared/openai-models.ts';
import {
  buildMajordomoSystemPrompt,
  poppinsToolsAsOpenAIFunctions,
} from '../_shared/poppins-tools.ts';

const MAX_TOOL_ROUNDS = 4;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { question, metrics, householdId, household, history, majordomoProfileId } =
      await req.json();

    const auth = await requireActiveMember(authHeader, householdId);
    if (auth.error) {
      return auth.error;
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const snapshot = (household ?? {}) as HouseholdSnapshotEdge;
    const metricsObj = (metrics ?? {}) as Record<string, unknown>;
    const context = buildCompactHouseholdContext(snapshot as Record<string, unknown>);
    const memberRole = auth.membership?.role ?? 'adult';
    const desk = snapshot.desk ?? {};
    const profileId =
      (majordomoProfileId as string | undefined) ??
      (snapshot.majordomoProfileId as string | undefined) ??
      'poppins';

    if (!openaiKey) {
      return jsonResponse({
        question,
        answer: `Momentum is ${metricsObj?.momentum ?? '—'}% with ${metricsObj?.openTasks ?? 0} open tasks. Configure OPENAI_API_KEY for full answers.`,
        source: 'fallback',
        actions: [],
      });
    }

    const historyMessages = Array.isArray(history)
      ? history
          .slice(-10)
          .filter((item: { role?: string; content?: string }) => item?.content)
          .map((item: { role?: string; content?: string }) => ({
            role: item.role === 'assistant' ? 'assistant' : 'user',
            content: String(item.content),
          }))
      : [];

    const messages: Array<Record<string, unknown>> = [
      {
        role: 'system',
        content:
          `${buildMajordomoSystemPrompt(profileId, memberRole)}\n` +
          `Desk brief: ${JSON.stringify(desk).slice(0, 2500)}\n` +
          `Household context: ${JSON.stringify({ metrics: metricsObj, ...context }).slice(0, 6000)}`,
      },
      ...historyMessages,
      { role: 'user', content: String(question ?? '') },
    ];

    const effects: Array<{
      tool: string;
      args: Record<string, unknown>;
      result: Record<string, unknown>;
    }> = [];
    let answer = '';
    let inputTokens = 0;
    let outputTokens = 0;
    const model = getOpenAIPoppinsChatModel();

    for (let step = 0; step < MAX_TOOL_ROUNDS; step++) {
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
          tool_choice: 'auto',
        }),
      });

      const payload = await completion.json();
      inputTokens += Number(payload.usage?.prompt_tokens ?? 0);
      outputTokens += Number(payload.usage?.completion_tokens ?? 0);
      const message = payload.choices?.[0]?.message;
      if (!message) {
        answer = 'I could not answer that just now. Try again in a moment.';
        break;
      }

      messages.push(message);
      const toolCalls = message.tool_calls ?? [];
      if (!toolCalls.length) {
        answer = String(message.content ?? '').trim() || 'Done.';
        break;
      }

      for (const call of toolCalls) {
        const name = String(call.function?.name ?? '');
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function?.arguments ?? '{}');
        } catch {
          args = {};
        }
        const result = executePoppinsTool(name, args, snapshot, metricsObj);
        effects.push({ tool: name, args, result });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    if (!answer) {
      answer = 'I checked the household and left notes in Activity.';
    }

    const actions = effectsToClientActions(effects);
    const ui_actions = effects.flatMap((effect) => {
      const items = effect.result.ui_actions;
      return Array.isArray(items) ? items : [];
    });

    return jsonResponse({
      question,
      answer,
      source: 'openai',
      actions,
      ui_actions,
      effectCount: effects.length,
      usage: {
        inputTokens,
        outputTokens,
        model,
      },
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

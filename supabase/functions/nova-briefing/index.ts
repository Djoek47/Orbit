// Deno Edge Function — Nova briefings via OpenAI.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  buildCompactHouseholdContext,
  corsHeaders,
  jsonResponse,
  requireActiveMember,
} from '../_shared/nova-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { householdId, type = 'daily', metrics, household } = await req.json();

    const auth = await requireActiveMember(authHeader, householdId);
    if (auth.error) {
      return auth.error;
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const context = buildCompactHouseholdContext(household);
    let result: Record<string, unknown>;

    if (openaiKey) {
      const prompt =
        type === 'weekly'
          ? `Write a short weekly household briefing JSON with title, summary, tasksCompleted, tasksMissed, groceriesPurchased, mostActiveMember, xpEarned, momentumChange, recommendations (string[]). Context: ${JSON.stringify({ metrics, ...context })}`
          : type === 'recommendations'
            ? `Return JSON {recommendations: [{id,title,detail,tone}]} where tone is green|amber|cyan|blue|red. Context: ${JSON.stringify({ metrics, ...context })}`
            : `Write daily briefing JSON {title,summary,actions:string[]}. Context: ${JSON.stringify({ metrics, ...context })}`;

      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are Nova, the calm AI majordomo for Orbit households. Notify, ensure fair tasks/XP, surface deals, respect holidays, free the lead’s time. Propose — never silently mutate consequential changes. Be concise. Reply with JSON only.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      const payload = await completion.json();
      const content = payload.choices?.[0]?.message?.content ?? '{}';
      result = JSON.parse(content);

      if (type === 'recommendations') {
        if (Array.isArray(result)) {
          // ok
        } else if (Array.isArray((result as { recommendations?: unknown }).recommendations)) {
          result = { recommendations: (result as { recommendations: unknown[] }).recommendations };
        }
      }
    } else {
      result =
        type === 'weekly'
          ? {
              title: 'Weekly Orbit Report',
              summary: 'Your household stayed coordinated this week.',
              tasksCompleted: metrics?.taskCompletionRate ?? 0,
              tasksMissed: 0,
              groceriesPurchased: metrics?.purchasedGroceries ?? 0,
              mostActiveMember: context.greetingName ?? 'Family',
              xpEarned: 0,
              momentumChange: 2,
              recommendations: ['Plan groceries before weekend', 'Rebalance open tasks'],
            }
          : type === 'recommendations'
            ? {
                recommendations: [
                  {
                    id: 'rec-1',
                    title: 'Clear open tasks',
                    detail: `${metrics?.openTasks ?? 0} responsibilities still need attention.`,
                    tone: 'amber',
                  },
                ],
              }
            : {
                title: 'Today in Orbit',
                summary: `Momentum is ${metrics?.momentum ?? 0}%. Focus on missing groceries and open tasks.`,
                actions: ['Complete top task', 'Restock missing items'],
              };
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && serviceKey && householdId && type === 'daily' && result.title && result.summary) {
      const admin = createClient(supabaseUrl, serviceKey);
      await admin.from('ai_briefings').insert({
        household_id: householdId,
        briefing_type: 'daily',
        title: String(result.title),
        summary: String(result.summary),
        actions: (result.actions as string[]) ?? [],
        metadata: { source: openaiKey ? 'openai' : 'fallback' },
      });
    }

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

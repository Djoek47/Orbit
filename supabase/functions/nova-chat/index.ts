// Deno Edge Function — Nova conversational answers via OpenAI.

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
    const { question, metrics, householdId, household, history } = await req.json();

    const auth = await requireActiveMember(authHeader, householdId);
    if (auth.error) {
      return auth.error;
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const context = buildCompactHouseholdContext(household);
    const memberRole = auth.membership?.role ?? 'adult';

    if (!openaiKey) {
      return jsonResponse({
        question,
        answer: `Momentum is ${metrics?.momentum ?? '—'}% with ${metrics?.openTasks ?? 0} open tasks. Configure OPENAI_API_KEY for full Nova answers.`,
        source: 'fallback',
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

    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are Nova, the calm AI co-manager for Orbit households. Be brief, actionable, never guilt-inducing. ' +
              `Viewer role: ${memberRole}. Household context: ${JSON.stringify({ metrics, ...context })}`,
          },
          ...historyMessages,
          { role: 'user', content: String(question ?? '') },
        ],
      }),
    });

    const payload = await completion.json();
    const answer = payload.choices?.[0]?.message?.content ?? 'I could not answer that just now. Try again in a moment.';

    return jsonResponse({ question, answer, source: 'openai' });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

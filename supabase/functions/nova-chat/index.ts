// Deno Edge Function — Nova conversational answers via OpenAI.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { question, metrics, householdId } = await req.json();
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiKey) {
      return new Response(
        JSON.stringify({
          question,
          answer: `Orbit sees momentum at ${metrics?.momentum ?? '—'} with ${metrics?.openTasks ?? 0} open tasks. Ask again after OpenAI is configured.`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
              'You are Nova, Orbit household co-manager. Answer briefly with actionable household guidance. Household id: ' +
              (householdId ?? 'unknown') +
              '. Metrics: ' +
              JSON.stringify(metrics ?? {}),
          },
          { role: 'user', content: String(question ?? '') },
        ],
      }),
    });

    const payload = await completion.json();
    const answer = payload.choices?.[0]?.message?.content ?? 'I could not answer that just now.';

    return new Response(JSON.stringify({ question, answer }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

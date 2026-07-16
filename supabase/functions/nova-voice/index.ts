// Deno Edge Function — Nova voice: Whisper STT + short GPT reply for Expo Go talk mode.

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
    const form = await req.formData();
    const audio = form.get('audio');
    const householdId = String(form.get('householdId') ?? '');
    const metricsRaw = String(form.get('metrics') ?? '{}');
    const householdRaw = String(form.get('household') ?? '{}');

    const auth = await requireActiveMember(authHeader, householdId);
    if (auth.error) {
      return auth.error;
    }

    const transcriptOnly = String(form.get('transcriptOnly') ?? '') === '1';
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return jsonResponse({
        transcript: 'What should our household focus on right now?',
        answer: 'Voice mode needs OPENAI_API_KEY configured on the edge function.',
        source: 'fallback',
      });
    }

    let metrics: Record<string, unknown> = {};
    let household: Record<string, unknown> = {};
    try {
      metrics = JSON.parse(metricsRaw);
      household = JSON.parse(householdRaw);
    } catch {
      // use empty objects
    }

    let transcript = 'What should our household focus on right now?';

    if (audio instanceof File) {
      const whisperForm = new FormData();
      whisperForm.append('file', audio, 'nova.m4a');
      whisperForm.append('model', 'whisper-1');

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: whisperForm,
      });
      const whisperPayload = await whisperRes.json();
      if (whisperPayload.text) {
        transcript = String(whisperPayload.text).trim();
      }
    }

    if (transcriptOnly) {
      return jsonResponse({ transcript, answer: '', source: 'whisper' });
    }

    const context = buildCompactHouseholdContext(household);
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
              'You are Nova, the calm AI majordomo for Orbit households. Reply in 2-3 calm spoken sentences. Propose consequential changes — never silently reassign, approve rewards, or spend. ' +
              `Context: ${JSON.stringify({ metrics, ...context })}`,
          },
          { role: 'user', content: transcript },
        ],
      }),
    });

    const payload = await completion.json();
    const answer = payload.choices?.[0]?.message?.content ?? 'I heard you. Let me think on that.';

    return jsonResponse({ transcript, answer, source: 'openai' });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

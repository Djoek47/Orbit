// Deno Edge Function — mint ephemeral OpenAI Realtime client secret for Poppins voice.
// Never returns the long-lived OPENAI_API_KEY.

import {
  corsHeaders,
  jsonResponse,
  requireActiveMember,
} from '../_shared/poppins-auth.ts';
import {
  POPPINS_MAJORDOMO_SYSTEM,
  poppinsToolsAsRealtimeTools,
} from '../_shared/poppins-tools.ts';

const REALTIME_MODEL = 'gpt-4o-realtime-preview';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json().catch(() => ({}));
    const householdId = body.householdId as string | undefined;
    const householdHint = body.householdContext
      ? ` Household context: ${JSON.stringify(body.householdContext).slice(0, 6000)}`
      : '';

    const auth = await requireActiveMember(authHeader, householdId);
    if (auth.error) {
      return auth.error;
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return jsonResponse({ error: 'OPENAI_API_KEY not configured', fallback: 'whisper' }, 503);
    }

    const memberRole = auth.membership?.role ?? 'adult';
    const instructions =
      `${POPPINS_MAJORDOMO_SYSTEM} Viewer role: ${memberRole}.` +
      ' Speak calmly and briefly. Use tools when helpful; propose consequential changes for confirmation.' +
      householdHint;

    const sessionRes = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1',
      },
      body: JSON.stringify({
        model: REALTIME_MODEL,
        voice: 'coral',
        modalities: ['text', 'audio'],
        instructions,
        tools: poppinsToolsAsRealtimeTools(),
        tool_choice: 'auto',
        input_audio_transcription: { model: 'whisper-1' },
      }),
    });

    const session = await sessionRes.json();
    if (!sessionRes.ok) {
      return jsonResponse(
        {
          error: session?.error?.message ?? 'Failed to mint Realtime session',
          fallback: 'whisper',
          details: session,
        },
        sessionRes.status >= 400 ? sessionRes.status : 502
      );
    }

    const clientSecret = session.client_secret?.value ?? session.client_secret;
    const expiresAt = session.client_secret?.expires_at ?? session.expires_at ?? null;

    if (!clientSecret) {
      return jsonResponse({ error: 'No client secret in session response', fallback: 'whisper' }, 502);
    }

    return jsonResponse({
      clientSecret,
      model: session.model ?? REALTIME_MODEL,
      expiresAt,
      voice: session.voice ?? 'coral',
    });
  } catch (error) {
    return jsonResponse({ error: String(error), fallback: 'whisper' }, 500);
  }
});

// Deno Edge Function — mint ephemeral OpenAI Realtime client secret for Poppins voice.
// Never returns the long-lived OPENAI_API_KEY.

import {
  corsHeaders,
  jsonResponse,
  requireActiveMember,
} from '../_shared/poppins-auth.ts';
import {
  buildMajordomoSystemPrompt,
  getMajordomoProfile,
  poppinsToolsAsRealtimeTools,
} from '../_shared/poppins-tools.ts';

const REALTIME_MODEL = 'gpt-realtime-2.1-mini';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json().catch(() => ({}));
    const householdId = body.householdId as string | undefined;
    const profileId =
      (body.majordomoProfileId as string | undefined) ??
      (body.householdContext?.majordomoProfileId as string | undefined) ??
      'poppins';
    const profile = getMajordomoProfile(profileId);
    const deskHint = body.householdContext?.desk
      ? ` Desk brief: ${JSON.stringify(body.householdContext.desk).slice(0, 2000)}.`
      : '';
    const householdHint = body.householdContext
      ? ` Household context: ${JSON.stringify(body.householdContext).slice(0, 5000)}`
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
      `${buildMajordomoSystemPrompt(profileId, memberRole)}` +
      ' Speak calmly and briefly (1–3 short sentences). Use tools when helpful; propose consequential changes for confirmation.' +
      deskHint +
      householdHint;

    // GA Realtime only — POST /v1/realtime/client_secrets (beta /sessions + OpenAI-Beta shut down).
    const sessionRes = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: REALTIME_MODEL,
          instructions,
          tools: poppinsToolsAsRealtimeTools(),
          tool_choice: 'auto',
          audio: {
            output: { voice: profile.voice },
          },
          reasoning: { effort: 'low' },
        },
      }),
    });

    const session = await sessionRes.json();

    if (!sessionRes.ok) {
      return jsonResponse(
        {
          error: session?.error?.message ?? 'Failed to mint Realtime session',
          fallback: 'whisper',
          details: session,
          model: REALTIME_MODEL,
        },
        sessionRes.status >= 400 ? sessionRes.status : 502
      );
    }

    const clientSecret =
      session.value ??
      session.client_secret?.value ??
      session.client_secret ??
      session.session?.client_secret?.value;
    const expiresAt =
      session.expires_at ??
      session.client_secret?.expires_at ??
      session.session?.client_secret?.expires_at ??
      null;
    const model = session.session?.model ?? session.model ?? REALTIME_MODEL;

    if (!clientSecret) {
      return jsonResponse(
        { error: 'No client secret in session response', fallback: 'whisper', details: session },
        502
      );
    }

    return jsonResponse({
      clientSecret,
      model,
      expiresAt,
      voice: profile.voice,
      majordomoProfileId: profile.id,
      displayName: profile.displayName,
    });
  } catch (error) {
    return jsonResponse({ error: String(error), fallback: 'whisper' }, 500);
  }
});

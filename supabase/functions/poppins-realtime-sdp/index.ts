// Deno Edge Function — server SDP for Poppins WebRTC duplex (POST /v1/realtime/calls).
// Never returns OPENAI_API_KEY. Client sends JSON { sdp, session fields }; response is text/plain SDP
// (not application/sdp — iOS 27 RCTBlobManager/UTType aborts on that MIME).

import {
  corsHeaders,
  jsonResponse,
  requireActiveMember,
} from '../_shared/poppins-auth.ts';
import {
  buildPoppinsRealtimeSessionConfig,
  voiceAccessAllowed,
} from '../_shared/poppins-realtime-session-config.ts';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const contentType = req.headers.get('Content-Type') ?? '';

    let householdId: string | undefined;
    let majordomoProfileId: string | undefined;
    let householdContext: Record<string, unknown> | undefined;
    let pageContext: string | undefined;
    let capabilityProfile: string | undefined;
    let isPremium: boolean | undefined;
    let trialActive: boolean | undefined;
    let billingPending: boolean | undefined;
    let sdpOffer = '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const sdpPart = form.get('sdp');
      sdpOffer = typeof sdpPart === 'string' ? sdpPart : sdpPart ? await (sdpPart as Blob).text() : '';
      const ctxRaw = form.get('session');
      if (typeof ctxRaw === 'string') {
        try {
          const parsed = JSON.parse(ctxRaw) as Record<string, unknown>;
          householdId = parsed.householdId as string | undefined;
          majordomoProfileId = parsed.majordomoProfileId as string | undefined;
          householdContext = parsed.householdContext as Record<string, unknown> | undefined;
          pageContext = parsed.pageContext as string | undefined;
          capabilityProfile = parsed.capabilityProfile as string | undefined;
          isPremium = parsed.isPremium as boolean | undefined;
          trialActive = parsed.trialActive as boolean | undefined;
          billingPending = parsed.billingPending as boolean | undefined;
        } catch {
          /* ignore */
        }
      }
      householdId = householdId ?? (form.get('householdId') as string | undefined);
    } else {
      const body = await req.json().catch(() => ({}));
      sdpOffer = String(body.sdp ?? '');
      householdId = body.householdId as string | undefined;
      majordomoProfileId =
        (body.majordomoProfileId as string | undefined) ??
        (body.householdContext?.majordomoProfileId as string | undefined);
      householdContext = body.householdContext as Record<string, unknown> | undefined;
      pageContext = body.pageContext as string | undefined;
      capabilityProfile = body.capabilityProfile as string | undefined;
      isPremium = body.isPremium as boolean | undefined;
      trialActive = body.trialActive as boolean | undefined;
      billingPending = body.billingPending as boolean | undefined;
    }

    if (!sdpOffer.trim()) {
      return jsonResponse({ error: 'sdp offer required' }, 400);
    }

    const auth = await requireActiveMember(authHeader, householdId);
    if (auth.error) {
      return auth.error;
    }

    const access = voiceAccessAllowed({ isPremium, trialActive, billingPending });
    if (!access.ok) {
      return jsonResponse({ error: access.reason ?? 'voice_not_allowed', fallback: 'text' }, 402);
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return jsonResponse({ error: 'OPENAI_API_KEY not configured', fallback: 'whisper' }, 503);
    }

    const profileId =
      majordomoProfileId ??
      (householdContext?.majordomoProfileId as string | undefined) ??
      'poppins';
    const deskHint = householdContext?.desk
      ? ` Desk brief: ${JSON.stringify(householdContext.desk).slice(0, 2000)}.`
      : '';
    const householdHint = householdContext
      ? ` Household context: ${JSON.stringify(householdContext).slice(0, 5000)}`
      : '';

    const { session, profile, model } = buildPoppinsRealtimeSessionConfig({
      profileId,
      memberRole: auth.membership?.role ?? 'adult',
      deskHint,
      householdHint,
      pageContext,
      capabilityProfile,
    });

    const safetyId = await sha256Hex(auth.user.id);
    const form = new FormData();
    form.set('sdp', sdpOffer);
    form.set('session', JSON.stringify(session));

    const openaiRes = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'OpenAI-Safety-Identifier': safetyId,
      },
      body: form,
    });

    const answerSdp = await openaiRes.text();
    if (!openaiRes.ok) {
      let details: unknown = answerSdp;
      try {
        details = JSON.parse(answerSdp);
      } catch {
        /* keep text */
      }
      return jsonResponse(
        {
          error: 'Failed to create Realtime WebRTC call',
          fallback: 'whisper',
          details,
          model,
        },
        openaiRes.status >= 400 ? openaiRes.status : 502
      );
    }

    return new Response(answerSdp, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Poppins-Realtime-Model': model,
        'X-Poppins-Voice': profile.voice,
        'X-Poppins-Majordomo': profile.id,
      },
    });
  } catch (error) {
    return jsonResponse({ error: String(error), fallback: 'whisper' }, 500);
  }
});

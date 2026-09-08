// Deno Edge Function — Luna writes one inbox sentence from coalesced household facts.
// Policy (send vs drop) is decided by the app; this only rewrites copy.

import {
  corsHeaders,
  jsonResponse,
  requireActiveMember,
} from '../_shared/poppins-auth.ts';
import { getOpenAIPoppinsChatModel } from '../_shared/openai-models.ts';

const SYSTEM = `You are Poppins, the calm household co-manager in Choremaxx.
Write ONE notification that contacts a person. Facts are already chosen; you only write the sentence.

Rules:
- Name the person. Report what happened. Do not counsel, praise, or tell anyone how to feel.
- No emoji. No exclamation marks. No internal jargon (mint, ledger, origin, EXAMPLE).
- Prefer one sentence. Summarize bursts instead of listing every XP tick.
- Never invent events that are not in the facts.
- Reply JSON only: {"title":"Poppins · …","body":"…","cta":"Open Rewards|Open Task|Ask Poppins|View"}`;

function stripExample(text: string): string {
  return text.replace(/\bEXAMPLE:\s*/gi, '').replace(/\s{2,}/g, ' ').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json();
    const householdId = body.householdId as string | undefined;
    const facts = Array.isArray(body.facts) ? body.facts : [];
    const fallback = (body.fallback ?? {}) as Record<string, unknown>;
    const role = typeof body.role === 'string' ? body.role : '';
    const unreadCount = typeof body.unreadCount === 'number' ? body.unreadCount : 0;

    const auth = await requireActiveMember(authHeader, householdId);
    if (auth.error) {
      return auth.error;
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return jsonResponse({
        title: stripExample(String(fallback.title ?? 'Poppins')),
        body: stripExample(String(fallback.body ?? '')),
        cta: fallback.cta ?? 'View',
        source: 'fallback',
      });
    }

    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getOpenAIPoppinsChatModel(),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: JSON.stringify({
              role,
              unreadCount,
              urgency: fallback.urgency,
              facts,
              draft: { title: fallback.title, body: fallback.body, cta: fallback.cta },
            }),
          },
        ],
      }),
    });

    const payload = await completion.json();
    const content = String(payload.choices?.[0]?.message?.content ?? '{}');
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      parsed = {};
    }

    const title = stripExample(String(parsed.title ?? fallback.title ?? 'Poppins'));
    const bodyText = stripExample(String(parsed.body ?? fallback.body ?? ''));

    return jsonResponse({
      title: title || String(fallback.title ?? 'Poppins'),
      body: bodyText || String(fallback.body ?? ''),
      cta: parsed.cta != null ? String(parsed.cta) : fallback.cta ?? 'View',
      source: 'openai',
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

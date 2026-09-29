// Deno Edge Function — Poppins voice: Whisper STT + short GPT reply for Expo Go talk mode.

import {
  buildCompactHouseholdContext,
  corsHeaders,
  jsonResponse,
  requireActiveMember,
} from '../_shared/poppins-auth.ts';
import { getOpenAIPoppinsChatModel } from '../_shared/openai-models.ts';
import { recordAiUsageEvent, usageFromOpenAIPayload } from '../_shared/ai-usage.ts';

const FALLBACK_FOCUS_QUESTION = 'What should our household focus on right now?';
/** ~6 MB of audio as base64 — far above a 30 s Quiet capture. */
const MAX_AUDIO_BASE64_CHARS = 8_000_000;

type VoiceRequest = {
  audio: FormDataEntryValue | File | null;
  householdId: string;
  metricsRaw: string;
  householdRaw: string;
  transcriptOnly: boolean;
};

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

/**
 * Two shapes. JSON with `audioBase64` is what current clients send — it avoids the
 * multipart upload that iOS 27's RCTBlobManager breaks. Multipart stays for older builds.
 */
async function readVoiceRequest(req: Request): Promise<VoiceRequest> {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await req.json()) as Record<string, unknown>;
    const b64 = typeof body.audioBase64 === 'string' ? body.audioBase64 : '';
    let audio: File | null = null;
    if (b64 && b64.length <= MAX_AUDIO_BASE64_CHARS) {
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'audio/m4a';
      audio = new File([base64ToArrayBuffer(b64)], 'poppins.m4a', { type: mimeType });
    }
    return {
      audio,
      householdId: String(body.householdId ?? ''),
      metricsRaw: JSON.stringify(body.metrics ?? {}),
      householdRaw: JSON.stringify(body.household ?? {}),
      transcriptOnly: body.transcriptOnly === true || body.transcriptOnly === '1',
    };
  }
  const form = await req.formData();
  return {
    audio: form.get('audio'),
    householdId: String(form.get('householdId') ?? ''),
    metricsRaw: String(form.get('metrics') ?? '{}'),
    householdRaw: String(form.get('household') ?? '{}'),
    transcriptOnly: String(form.get('transcriptOnly') ?? '') === '1',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { audio, householdId, metricsRaw, householdRaw, transcriptOnly } =
      await readVoiceRequest(req);

    const auth = await requireActiveMember(authHeader, householdId);
    if (auth.error) {
      return auth.error;
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      if (transcriptOnly) {
        return jsonResponse({
          transcript: '',
          answer: '',
          error: 'whisper_failed',
          detail: 'OPENAI_API_KEY missing',
          source: 'fallback',
        });
      }
      return jsonResponse({
        transcript: FALLBACK_FOCUS_QUESTION,
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

    // Non-transcriptOnly legacy path may still seed a spoken prompt; transcriptOnly
    // must never invent a user sentence (A3 / WO9.1).
    let transcript = transcriptOnly ? '' : FALLBACK_FOCUS_QUESTION;
    let whisperDetail: string | undefined;

    if (!(audio instanceof File)) {
      whisperDetail = 'audio_not_file';
      if (transcriptOnly) {
        console.error(
          JSON.stringify({
            event: 'poppins_voice.whisper_failed',
            detail: whisperDetail,
            audioType: typeof audio,
          })
        );
        return jsonResponse({
          transcript: '',
          answer: '',
          error: 'whisper_failed',
          detail: whisperDetail,
          source: 'whisper',
        });
      }
    } else {
      const whisperForm = new FormData();
      whisperForm.append('file', audio, 'poppins.m4a');
      whisperForm.append('model', 'whisper-1');

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: whisperForm,
      });
      const whisperPayload = await whisperRes.json();
      if (!whisperRes.ok) {
        whisperDetail = `http_${whisperRes.status}`;
        console.error(
          JSON.stringify({
            event: 'poppins_voice.whisper_failed',
            httpStatus: whisperRes.status,
            body: whisperPayload,
          })
        );
        if (transcriptOnly) {
          return jsonResponse({
            transcript: '',
            answer: '',
            error: 'whisper_failed',
            detail: whisperDetail,
            source: 'whisper',
          });
        }
      } else if (whisperPayload.text) {
        transcript = String(whisperPayload.text).trim();
      } else if (transcriptOnly) {
        console.error(
          JSON.stringify({
            event: 'poppins_voice.whisper_failed',
            detail: 'empty_text',
            httpStatus: whisperRes.status,
            body: whisperPayload,
          })
        );
        return jsonResponse({
          transcript: '',
          answer: '',
          error: 'whisper_failed',
          detail: 'empty_text',
          source: 'whisper',
        });
      }
    }

    if (transcriptOnly) {
      if (householdId) {
        await recordAiUsageEvent({
          householdId,
          clientKey: `voice-whisper-${householdId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          memberId: auth.user?.id,
          kind: 'voice',
          model: 'whisper-1',
          inputTokens: 0,
          outputTokens: 0,
          surface: 'poppins-voice',
          mode: 'whisper',
        });
      }
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
        model: getOpenAIPoppinsChatModel(),
        messages: [
          {
            role: 'system',
            content:
              'You are Poppins, the calm AI co-manager for Choremaxx family households. Reply in 2-3 calm spoken sentences. Propose consequential changes — never silently reassign, approve rewards, or spend. ' +
              `Context: ${JSON.stringify({ metrics, ...context })}`,
          },
          { role: 'user', content: transcript },
        ],
      }),
    });

    const payload = await completion.json();
    const answer = payload.choices?.[0]?.message?.content ?? 'I heard you. Let me think on that.';
    if (householdId) {
      const usage = usageFromOpenAIPayload(payload);
      await recordAiUsageEvent({
        householdId,
        clientKey: `voice-chat-${householdId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        memberId: auth.user?.id,
        kind: 'voice',
        model: getOpenAIPoppinsChatModel(),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        surface: 'poppins-voice',
        mode: 'whisper_chat',
      });
    }

    return jsonResponse({ transcript, answer, source: 'openai' });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

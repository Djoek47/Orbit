// Deno Edge Function — Poppins voice: Whisper STT + short GPT reply for Expo Go talk mode.

import {
  buildCompactHouseholdContext,
  corsHeaders,
  jsonResponse,
  requireActiveMember,
} from '../_shared/poppins-auth.ts';
import {
  getOpenAIInputTranscribeModel,
  getOpenAIPoppinsChatModel,
} from '../_shared/openai-models.ts';
import { recordAiUsageEvent, usageFromOpenAIPayload } from '../_shared/ai-usage.ts';
import {
  MIN_WHISPER_AUDIO_BYTES,
  normalizeVoiceMimeType,
  openaiWhisperErrorDetail,
  QUIET_AUDIO_FILENAME,
  QUIET_AUDIO_MIME,
  shouldRetryWhisperFallback,
  WHISPER_FALLBACK_MODEL,
} from '../_shared/whisper-audio.ts';

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

function asAudioFile(value: FormDataEntryValue | File | null, mimeHint?: string): File | null {
  if (value instanceof File) {
    const mime = normalizeVoiceMimeType(value.type || mimeHint);
    if (value.type === mime && value.name) return value;
    return new File([value], value.name || QUIET_AUDIO_FILENAME, { type: mime });
  }
  if (value instanceof Blob) {
    const mime = normalizeVoiceMimeType(value.type || mimeHint);
    return new File([value], QUIET_AUDIO_FILENAME, { type: mime });
  }
  return null;
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
      const mimeType = normalizeVoiceMimeType(
        typeof body.mimeType === 'string' ? body.mimeType : QUIET_AUDIO_MIME
      );
      audio = new File([base64ToArrayBuffer(b64)], QUIET_AUDIO_FILENAME, { type: mimeType });
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

async function transcribeWithOpenAI(
  openaiKey: string,
  audio: File,
  model: string
): Promise<{ ok: true; text: string } | { ok: false; detail: string; status: number; body: unknown }> {
  const whisperForm = new FormData();
  whisperForm.append('file', audio, audio.name || QUIET_AUDIO_FILENAME);
  whisperForm.append('model', model);
  whisperForm.append('language', 'en');
  // gpt-4o-mini-transcribe only accepts json; whisper-1 accepts json too.
  whisperForm.append('response_format', 'json');

  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: whisperForm,
  });
  const whisperPayload = await whisperRes.json().catch(() => ({}));
  if (!whisperRes.ok) {
    return {
      ok: false,
      status: whisperRes.status,
      body: whisperPayload,
      detail: openaiWhisperErrorDetail(whisperRes.status, whisperPayload),
    };
  }
  const text = String((whisperPayload as { text?: unknown }).text ?? '').trim();
  return { ok: true, text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { audio: rawAudio, householdId, metricsRaw, householdRaw, transcriptOnly } =
      await readVoiceRequest(req);

    const auth = await requireActiveMember(authHeader, householdId);
    if (auth.error) {
      return auth.error;
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      if (transcriptOnly) {
        return jsonResponse(
          {
            transcript: '',
            answer: '',
            error: 'whisper_failed',
            detail: 'OPENAI_API_KEY missing',
            source: 'fallback',
          },
          503
        );
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
    let usedModel = getOpenAIInputTranscribeModel();

    const audio = asAudioFile(rawAudio);

    if (!audio) {
      whisperDetail = 'audio_not_file';
      if (transcriptOnly) {
        console.error(
          JSON.stringify({
            event: 'poppins_voice.whisper_failed',
            detail: whisperDetail,
            audioType: typeof rawAudio,
          })
        );
        return jsonResponse(
          {
            transcript: '',
            answer: '',
            error: 'whisper_failed',
            detail: whisperDetail,
            source: 'whisper',
          },
          400
        );
      }
    } else if (audio.size > 0 && audio.size < MIN_WHISPER_AUDIO_BYTES) {
      whisperDetail = `audio_too_small:${audio.size}`;
      if (transcriptOnly) {
        console.error(
          JSON.stringify({
            event: 'poppins_voice.whisper_failed',
            detail: whisperDetail,
            bytes: audio.size,
          })
        );
        return jsonResponse(
          {
            transcript: '',
            answer: '',
            error: 'whisper_failed',
            detail: whisperDetail,
            source: 'whisper',
          },
          400
        );
      }
    } else if (audio.size === 0) {
      whisperDetail = 'audio_empty';
      if (transcriptOnly) {
        return jsonResponse(
          {
            transcript: '',
            answer: '',
            error: 'whisper_failed',
            detail: whisperDetail,
            source: 'whisper',
          },
          400
        );
      }
    } else {
      // Listening only. Always pin English — a French-region phone must never drift the STT.
      const primaryModel = getOpenAIInputTranscribeModel();
      let result = await transcribeWithOpenAI(openaiKey, audio, primaryModel);
      usedModel = primaryModel;

      if (!result.ok && shouldRetryWhisperFallback(result.status)) {
        console.warn(
          JSON.stringify({
            event: 'poppins_voice.whisper_retry_fallback',
            primaryModel,
            fallbackModel: WHISPER_FALLBACK_MODEL,
            detail: result.detail,
            mime: audio.type,
            bytes: audio.size,
          })
        );
        const retry = await transcribeWithOpenAI(openaiKey, audio, WHISPER_FALLBACK_MODEL);
        if (retry.ok) {
          result = retry;
          usedModel = WHISPER_FALLBACK_MODEL;
        } else {
          // Keep the more specific primary failure when fallback also fails.
          whisperDetail = `${result.detail};fallback_${retry.detail}`;
          console.error(
            JSON.stringify({
              event: 'poppins_voice.whisper_failed',
              model: primaryModel,
              fallbackModel: WHISPER_FALLBACK_MODEL,
              httpStatus: result.status,
              body: result.body,
              fallbackDetail: retry.detail,
              mime: audio.type,
              bytes: audio.size,
            })
          );
          if (transcriptOnly) {
            return jsonResponse(
              {
                transcript: '',
                answer: '',
                error: 'whisper_failed',
                detail: whisperDetail,
                source: 'whisper',
              },
              502
            );
          }
        }
      } else if (!result.ok) {
        whisperDetail = result.detail;
        console.error(
          JSON.stringify({
            event: 'poppins_voice.whisper_failed',
            model: primaryModel,
            httpStatus: result.status,
            body: result.body,
            mime: audio.type,
            bytes: audio.size,
          })
        );
        if (transcriptOnly) {
          return jsonResponse(
            {
              transcript: '',
              answer: '',
              error: 'whisper_failed',
              detail: whisperDetail,
              source: 'whisper',
            },
            502
          );
        }
      }

      if (result.ok) {
        if (result.text) {
          transcript = result.text;
        } else if (transcriptOnly) {
          console.error(
            JSON.stringify({
              event: 'poppins_voice.whisper_failed',
              model: usedModel,
              detail: 'empty_text',
              mime: audio.type,
              bytes: audio.size,
            })
          );
          return jsonResponse(
            {
              transcript: '',
              answer: '',
              error: 'whisper_failed',
              detail: 'empty_text',
              source: 'whisper',
            },
            502
          );
        }
      }
    }

    if (transcriptOnly) {
      if (householdId) {
        await recordAiUsageEvent({
          householdId,
          clientKey: `voice-whisper-${householdId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          memberId: auth.user?.id,
          kind: 'voice',
          model: usedModel,
          inputTokens: 0,
          outputTokens: 0,
          surface: 'poppins-voice',
          mode: 'whisper',
        });
      }
      return jsonResponse({ transcript, answer: '', source: 'whisper', model: usedModel });
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

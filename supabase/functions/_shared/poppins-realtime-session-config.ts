/**
 * Shared Realtime session config for poppins-realtime-sdp (WebRTC) and ephemeral mint.
 */

import {
  getOpenAIInputTranscribeModel,
  getOpenAIRealtimeModel,
  resolveRealtimeReasoningEffort,
} from './openai-models.ts';
import {
  buildMajordomoSystemPrompt,
  getMajordomoProfile,
  poppinsToolsAsRealtimeTools,
} from './poppins-tools.ts';

const IDLE_RAILS = `
Voice cost rails (smart idle hangup — not a farewell ritual):
- Prefer ending via end_session when the request is clearly done and the user said thanks/bye or there is no follow-up.
- Soft check-in is owned by the client after ~45–60s of silence; reply briefly if they are still there.
- Never invent a long “anything else?” ceremony. Keep answers short while tools run.
- After tools, always continue speaking a short spoken summary — never stay silent in Thinking.
- Consequential / risky actions must stage confirmation; never silently delete, approve money/rewards, remove members, or wipe lists.
- Never expose deleteAccount, signOut, or auth routes.
`;

export type BuildRealtimeSessionInput = {
  profileId?: string | null;
  memberRole?: string | null;
  deskHint?: string;
  householdHint?: string;
  pageContext?: string;
  capabilityProfile?: string;
  softPromptMs?: number;
  idleHangupMs?: number;
};

export function buildPoppinsRealtimeInstructions(input: BuildRealtimeSessionInput): string {
  const profileId = input.profileId ?? 'poppins';
  const memberRole = input.memberRole ?? 'adult';
  const soft = input.softPromptMs ?? Number(Deno.env.get('POPPINS_VOICE_SOFT_PROMPT_MS') ?? 50000);
  const idle = input.idleHangupMs ?? Number(Deno.env.get('POPPINS_VOICE_IDLE_MS') ?? 90000);

  return (
    `${buildMajordomoSystemPrompt(profileId, memberRole)}\n` +
    'Speak calmly and briefly (1–3 short sentences). Use tools when helpful; propose consequential changes for confirmation.\n' +
    `Idle timing hints: soft check-in ~${soft}ms, hangup ~${idle}ms of silence (client-enforced).\n` +
    IDLE_RAILS +
    (input.capabilityProfile ? `\nCapability focus: ${input.capabilityProfile}.` : '') +
    (input.pageContext ? `\nPage context: ${input.pageContext}` : '') +
    (input.deskHint ?? '') +
    (input.householdHint ?? '')
  );
}

export function buildPoppinsRealtimeSessionConfig(input: BuildRealtimeSessionInput) {
  const profile = getMajordomoProfile(input.profileId ?? 'poppins');
  const model = getOpenAIRealtimeModel();
  const instructions = buildPoppinsRealtimeInstructions(input);
  // Patient profiles: slightly less eager VAD / interrupt.
  const patient = profile.id === 'companion' || profile.id === 'advisor';
  const reasoningEffort = resolveRealtimeReasoningEffort('low');

  const session: Record<string, unknown> = {
    type: 'realtime',
    model,
    instructions,
    tools: poppinsToolsAsRealtimeTools(),
    tool_choice: 'auto',
    audio: {
      input: {
        noise_reduction: { type: 'near_field' },
        transcription: {
          model: getOpenAIInputTranscribeModel(),
        },
        turn_detection: {
          type: 'semantic_vad',
          eagerness: patient ? 'low' : 'medium',
          create_response: true,
          interrupt_response: !patient,
        },
      },
      output: {
        voice: profile.voice,
      },
    },
  };

  if (reasoningEffort) {
    session.reasoning = { effort: reasoningEffort };
  }

  return { session, profile, model, instructions };
}

/** Soft premium / trial gate for live duplex voice. */
export function voiceAccessAllowed(flags?: {
  isPremium?: boolean;
  trialActive?: boolean;
  billingPending?: boolean;
}): { ok: boolean; reason?: string } {
  if (Deno.env.get('POPPINS_VOICE_GRANT_ALL') === '1') {
    return { ok: true };
  }
  if (flags?.billingPending) {
    // Soft-gate: allow during TestFlight billing pending.
    return { ok: true };
  }
  if (flags?.isPremium || flags?.trialActive) {
    return { ok: true };
  }
  // Default allow for staging TestFlight when flags omitted; client still needs auth membership.
  if (flags == null || (flags.isPremium == null && flags.trialActive == null)) {
    return { ok: true };
  }
  return { ok: false, reason: 'premium_or_trial_required' };
}

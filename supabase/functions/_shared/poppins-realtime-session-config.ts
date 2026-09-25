/**
 * Shared Realtime session config for poppins-realtime-sdp (WebRTC) and ephemeral mint.
 */

import {
  getOpenAIInputTranscribeModel,
  getOpenAIRealtimeModel,
  resolveRealtimeReasoningEffort,
} from './openai-models.ts';
import { REALTIME_POST_INSTRUCTIONS_TOKEN_LIMIT } from './openai-rates.ts';
import {
  buildMajordomoSystemPrompt,
  getMajordomoProfile,
  poppinsToolsAsRealtimeTools,
} from './poppins-tools.ts';

const IDLE_RAILS = `
Voice cost rails (smart idle hangup — not a farewell ritual):
- Prefer ending via end_session when the request is clearly done and the user said thanks/bye or there is no follow-up.
- Soft idle is client-enforced (~15s silence); do not invent a spoken “still there?” check-in.
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
  const soft = input.softPromptMs ?? Number(Deno.env.get('POPPINS_VOICE_SOFT_PROMPT_MS') ?? 15000);
  const idle = input.idleHangupMs ?? Number(Deno.env.get('POPPINS_VOICE_IDLE_MS') ?? 30000);

  return (
    `${buildMajordomoSystemPrompt(profileId, memberRole)}\n` +
    'Speak calmly and briefly (one short sentence per beat). Wait for a tap or HOLD before adding another idea.\n' +
    `Idle timing hints: soft idle ~${soft}ms, hangup ~${idle}ms of silence (client-enforced; no spoken check-in).\n` +
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
    // ESTIMATED ~2 audio turns — OpenAI has no turn-count truncation; see REALTIME_POST_INSTRUCTIONS_TOKEN_LIMIT.
    truncation: {
      type: 'retention_ratio',
      retention_ratio: 0.8,
      token_limits: {
        post_instructions: REALTIME_POST_INSTRUCTIONS_TOKEN_LIMIT,
      },
    },
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

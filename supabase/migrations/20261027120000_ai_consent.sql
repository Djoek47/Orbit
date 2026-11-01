-- App Review 5.1.2(i): before anything a person says or types reaches a third-party AI
-- (OpenAI), the app names the provider, says what is sent, and asks. The answer lives here.
--
-- ai_consent_at   when this person allowed Poppins to send their requests to OpenAI.
--                 Null = not allowed: every Poppins function refuses (or uses its plain
--                 fallback text) and never calls OpenAI for them.
-- The person sets or clears it from the app (own row, existing RLS). Withdrawing is allowed.

alter table public.profiles add column if not exists ai_consent_at timestamptz;

comment on column public.profiles.ai_consent_at is
  'When this person allowed Poppins to send their requests and household context to OpenAI. '
  'Null = not allowed; Poppins functions never call OpenAI for them.';

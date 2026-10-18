-- Household Poppins interaction prefs (Speak back, Direct, notifications).
-- AsyncStorage remains a device cache; this column is the household source of truth.

alter table public.households
  add column if not exists poppins_interaction_prefs jsonb not null default '{
    "speakBack": false,
    "actImmediately": false,
    "confirmTime": "normal",
    "undoWindowSec": 5,
    "showThinking": true,
    "writtenReplies": true,
    "notificationActions": true
  }'::jsonb;

comment on column public.households.poppins_interaction_prefs is
  'Household Poppins voice, Direct/Guided, and notification-action prefs.';

-- v2 §5.2: TaskDefinition + TaskOccurrence uniqueness + verification fields.
-- Mock mode stores these in memory; Supabase clients need columns for persistence.

alter table if exists public.tasks
  add column if not exists definition_id text,
  add column if not exists occurrence_date date,
  add column if not exists due_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists awarded_xp integer,
  add column if not exists completed_late boolean default false,
  add column if not exists verification text,
  add column if not exists proof_photo_urls jsonb default '[]'::jsonb,
  add column if not exists proof_rounds jsonb default '[]'::jsonb,
  add column if not exists verified_by text,
  add column if not exists verified_at timestamptz;

-- Backfill definition_id for repeating rows that lack one.
update public.tasks
set definition_id = coalesce(
  definition_id,
  'series:' || id::text
)
where repeat_rule is not null
  and repeat_rule <> 'none'
  and definition_id is null;

create unique index if not exists tasks_definition_occurrence_uidx
  on public.tasks (household_id, definition_id, occurrence_date)
  where definition_id is not null and occurrence_date is not null;

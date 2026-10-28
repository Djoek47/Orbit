-- First-class homework subject for Plan calendar + Tasks filtering.

alter table if exists public.tasks
  add column if not exists homework_subject text;

create index if not exists tasks_homework_subject_idx
  on public.tasks (household_id, homework_subject)
  where homework_subject is not null;

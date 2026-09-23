-- Optional room attribution on tasks + grocery notes (mock-first domains now live-ready).
alter table public.tasks
  add column if not exists room_id text;

alter table public.grocery_items
  add column if not exists note text;

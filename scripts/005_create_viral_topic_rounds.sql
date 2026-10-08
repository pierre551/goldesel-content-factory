-- Stores each generated round of 8 "Virale Themen". The latest row is shown
-- in the UI until a new round is deliberately generated.
create table if not exists public.viral_topic_rounds (
  id uuid primary key default gen_random_uuid(),
  topics jsonb not null,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists viral_topic_rounds_created_at_idx
  on public.viral_topic_rounds (created_at desc);

alter table public.viral_topic_rounds enable row level security;
-- No policies: only the server (service-role key) reads and writes this table.

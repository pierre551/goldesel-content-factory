-- Goldesel Reel — production storage
-- Dedicated table for the "FACTORY GOLDESEL REEL" Grok/Higgsfield routine
-- (production_type = 'goldesel_reel'). Reels don't fit the article/slide shape
-- of carousel_productions (they carry an uploaded source video plus a rendered
-- output video), so they get their own table and are merged into the SAME
-- production feed (Aktuelle Produktion / Verlauf) and dashboard counters at
-- read time — they are not a competing production system.

create extension if not exists "pgcrypto";

create table if not exists public.reel_productions (
  production_run_id  uuid        primary key,
  production_type    text        not null default 'goldesel_reel',
  original_filename  text        not null,
  title              text,
  -- Durable storage paths inside the private Factory media bucket. Signed URLs
  -- are minted on demand from these paths; the paths are the source of truth.
  input_path         text,
  output_path        text,
  -- input_video_url is the (long-lived) signed URL last handed to Grok so it
  -- can fetch the source video. output_video_url is the external Higgsfield URL
  -- kept for reference; playback/download always prefer the persisted copy.
  input_video_url    text,
  output_video_url   text,
  status             text        not null default 'queued',
  error              text,
  duration           numeric,
  file_size          bigint,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists reel_productions_status_idx
  on public.reel_productions (status);
create index if not exists reel_productions_created_idx
  on public.reel_productions (created_at desc);

-- RLS on: the app talks to this table only through the server-only
-- service-role client (lib/supabase/admin.ts), which bypasses RLS. Enabling RLS
-- with no public policies keeps anon/auth clients locked out.
alter table public.reel_productions enable row level security;

-- Goldesel News Carousel — production storage
-- Dedicated tables for the "FACTORY GOLDESEL CAROUSEL" GrokBot routine.
-- These feed the SAME dashboard surfaces (Aktuelle Produktion / Verlauf) as the
-- existing story productions; they are not a competing system. Carousels simply
-- don't fit the research_run/candidate/story shape (they need article_url,
-- source, content_type, slide_count and per-slide prompts), so they get their
-- own tables and are merged into the production feed at read time.

create extension if not exists "pgcrypto";

create table if not exists public.carousel_productions (
  production_run_id uuid primary key,
  article_id        text        not null,
  article_url       text        not null,
  title             text        not null,
  published_at      timestamptz,
  source            text        not null default 'goldesel_news',
  content_type      text        not null default 'instagram_carousel',
  slide_count       int         not null default 5,
  status            text        not null default 'processing',
  error             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists carousel_productions_article_idx
  on public.carousel_productions (article_id);
create index if not exists carousel_productions_status_idx
  on public.carousel_productions (status);
create index if not exists carousel_productions_created_idx
  on public.carousel_productions (created_at desc);

create table if not exists public.carousel_slides (
  id                uuid        primary key default gen_random_uuid(),
  production_run_id uuid        not null
                      references public.carousel_productions (production_run_id)
                      on delete cascade,
  slide_index       int         not null,
  image_url         text,
  prompt            text,
  status            text        not null default 'pending',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Idempotency: one row per (production, slide) so duplicate callbacks upsert
  -- in place instead of creating duplicate slides.
  unique (production_run_id, slide_index)
);

create index if not exists carousel_slides_run_idx
  on public.carousel_slides (production_run_id);

-- RLS on: the app talks to these tables only through the server-only
-- service-role client (lib/supabase/admin.ts), which bypasses RLS. Enabling
-- RLS with no public policies keeps anon/auth clients locked out.
alter table public.carousel_productions enable row level security;
alter table public.carousel_slides      enable row level security;

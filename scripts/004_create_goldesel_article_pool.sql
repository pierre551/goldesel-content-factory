-- Goldesel article pool (shared persisted source for Story + Carousel pages)
--
-- WHY THIS EXISTS
-- Goldesel News articles are currently parsed live from goldesel.de HTML on
-- every page load (see lib/goldesel-news.ts) and are NOT stored anywhere. The
-- Story Content → Goldesel News page requires the article list to SURVIVE page
-- reload, navigation and browser reopen, and a reload must NOT silently fetch
-- new articles. That is only possible with a persisted pool, so this table is
-- the single shared pool both the Story page and (optionally, later) the
-- Carousel page can read from. The pool is only ever replaced by an explicit
-- "Artikel aktualisieren" action or the scheduled sync — never by a page load.
--
-- This does NOT introduce a parallel production architecture: Goldesel Story
-- productions reuse the existing carousel_productions / carousel_slides tables
-- (content_type = 'story_goldesel_news', slide_count = 1), so no production schema
-- change is needed — only this read-only article pool.
--
-- SAFE TO RUN: additive only, idempotent. Does not touch carousel_productions,
-- carousel_slides, stories, news_candidates, factory_events, the carousel
-- webhook/callback flow, or any existing table/column.

create table if not exists public.goldesel_articles (
  id            text        primary key,          -- URL slug — canonical article id used across the app
  url           text        not null,
  title         text        not null,
  image         text,
  published_at  text,                              -- raw source datetime string (kept verbatim like the scraper)
  isin          text,
  ticker        text,                              -- company/ticker if available (nullable; never fabricated)
  teaser        text,                              -- short teaser if available (nullable; never fabricated)
  source        text        not null default 'goldesel_news',
  first_seen_at timestamptz not null default now(),
  synced_at     timestamptz not null default now()
);

-- Newest-first reads for the "latest ~20 articles" list.
create index if not exists goldesel_articles_first_seen_idx
  on public.goldesel_articles (first_seen_at desc);

-- Server-only service-role access (matches lib/supabase/admin.ts usage).
alter table public.goldesel_articles enable row level security;

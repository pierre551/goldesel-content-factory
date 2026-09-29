-- Goldesel News article enrichment (editorial scoring + key points)
--
-- Goldesel News articles are parsed live from goldesel.de HTML and are NOT
-- currently stored in Supabase, so there is no existing article table/column
-- to extend. This adds a small enrichment table keyed by the article id (the
-- URL slug used throughout the app) — it is NOT a duplicate article table, it
-- only holds scoring for articles that already exist in the live feed. The UI
-- reads these values when present and shows a neutral "–" / hidden state when
-- absent — it never fabricates scores or key points.
--
-- SAFE TO RUN: additive only, idempotent (create-if-not-exists + add-column-
-- if-not-exists, so it is safe whether or not an earlier version was applied).
-- Does not touch carousel_productions, carousel_slides, the carousel
-- webhook/callback flow, or any existing table.

create table if not exists public.goldesel_article_enrichment (
  article_id      text        primary key,
  relevance_score integer     check (relevance_score between 0 and 100),
  viral_score     integer     check (viral_score between 0 and 100),
  key_points      jsonb       not null default '[]'::jsonb,
  scored_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Ensure scored_at exists even if an earlier version of this table was applied.
alter table public.goldesel_article_enrichment
  add column if not exists scored_at timestamptz;

-- Server-only service-role access (matches lib/supabase/admin.ts usage).
alter table public.goldesel_article_enrichment enable row level security;

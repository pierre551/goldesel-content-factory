-- Goldesel News Carousel — Instagram caption support
-- GrokBot now returns one caption per completed carousel (whole carousel, not
-- per slide). Store it on the existing production row; no separate table.
-- Idempotent: safe to re-run.

alter table public.carousel_productions
  add column if not exists instagram_caption text;

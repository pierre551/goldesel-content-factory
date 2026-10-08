/**
 * Production masters are the existing Goldesel layout/production templates held
 * by the production service (GrokBot/Figma). Research categories (Virale Themen
 * prompts) are a separate concept and live in lib/viral-prompt-texts.ts.
 *
 * Bump `version` whenever the mapping or output contract changes so every job
 * records which contract it was produced with.
 */
export const PRODUCTION_MASTERS = {
  aktienduell: { id: 'goldesel_master_aktienduell', label: 'Aktienduell-Master', version: '2026-10-08.1' },
  topstory: { id: 'goldesel_master_topstory', label: 'Topstory-Master', version: '2026-10-08.1' },
  news_impact: { id: 'goldesel_master_news_impact', label: 'News-Impact-Master', version: '2026-10-08.1' },
  analysten_rating: {
    id: 'goldesel_master_analysten_rating',
    label: 'Analysten-Rating-Master',
    version: '2026-10-08.1',
  },
} as const

export type MasterKey = keyof typeof PRODUCTION_MASTERS

export type ContentFormat = 'aktienduell' | 'topstory' | 'artikel' | 'virale_themen' | 'analysten_ratings'

export const FORMAT_LABEL: Record<ContentFormat, string> = {
  aktienduell: 'Aktienduell',
  topstory: 'Topstory',
  artikel: 'Goldesel Artikel',
  virale_themen: 'Virale Themen',
  analysten_ratings: 'Analysten Ratings',
}

/**
 * Goldesel Artikel has no dedicated master; it uses the Topstory master as the
 * documented default WITHOUT being flagged as an editorial topstory.
 */
export const MASTER_BY_FORMAT: Record<ContentFormat, MasterKey> = {
  aktienduell: 'aktienduell',
  topstory: 'topstory',
  artikel: 'topstory',
  virale_themen: 'news_impact',
  analysten_ratings: 'analysten_rating',
}

export function masterFor(format: ContentFormat) {
  const key = MASTER_BY_FORMAT[format]
  return {
    key,
    ...PRODUCTION_MASTERS[key],
    editorial_topstory: format === 'topstory',
    default_mapping: format === 'artikel',
  }
}

export const BEITRAG_SLIDES = 4

export const OUTPUT_SPECS = {
  beitrag: {
    type: 'carousel',
    slides: BEITRAG_SLIDES,
    width: 1080,
    height: 1350,
    aspect_ratio: '4:5',
    rules: [
      'Genau vier Slides, jeweils 1080×1350.',
      'Passende Bilder direkt in die Slides einbauen; Originalbild des Inhalts bevorzugen.',
      'Bestehende Figma-Layouts des Masters unverändert verwenden.',
    ],
  },
  reel: {
    type: 'reel',
    width: 1080,
    height: 1920,
    aspect_ratio: '9:16',
    rules: [
      'Getrennte Hook-, Content- und Logo-Overlays.',
      'Gesamter Reel-Content auf einer einzigen Maske.',
      'Transparente PNGs ohne weiße Schattenränder.',
      'Weiße Unternehmenslogos in gleich großen Containern.',
    ],
  },
} as const

export type ProductionType = keyof typeof OUTPUT_SPECS

/**
 * There is no article/topic-based reel routine yet: the existing reel route
 * only post-processes an uploaded source video. Report exactly what is missing.
 */
export function reelSetupMessage() {
  const missing: string[] = []
  if (!process.env.FACTORY_GOLDESEL_REEL_WEBHOOK_URL || !process.env.FACTORY_GOLDESEL_REEL_WEBHOOK_KEY) {
    missing.push('FACTORY_GOLDESEL_REEL_WEBHOOK_URL/KEY')
  }
  missing.push('Reel-Routine im Produktionsdienst für Inhalte ohne Quellvideo (Hook-, Content-, Logo-Overlay, 1080×1920)')
  return `Einrichtung erforderlich: ${missing.join(' und ')}.`
}

import 'server-only'

/**
 * Server-side reader for Goldesel "Aktienduell" articles.
 *
 * SECURITY: the upstream response carries user/account data (author details,
 * permissions, visibility flags, full text, …). Only the whitelisted display
 * fields are copied into a fresh object; the raw payload is never returned,
 * logged, cached (`cache: 'no-store'`) or persisted.
 */

const SOURCE_URL =
  'https://goldesel.de/api/app/content/getblogposts?take=30&lastId=0&categoryId=94&contentType=1&search=vs'
const SITE_ORIGIN = 'https://goldesel.de'
const MAX_DUELS = 30

export interface GoldeselAktienduell {
  id: string
  url: string
  title: string
  image: string | null
  teaser: string | null
  publishedAt: string | null
}

export type AktienduellResult =
  | { ok: true; duels: GoldeselAktienduell[]; fetchedAt: string }
  | { ok: false; message: string }

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
}

function decodeEntities(s: string | null): string | null {
  if (!s) return s
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match
  })
}

function absoluteUrl(u: string): string | null {
  try {
    const url = new URL(u, SITE_ORIGIN)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function pickDuel(item: unknown): GoldeselAktienduell | null {
  if (!item || typeof item !== 'object') return null
  const src = item as Record<string, unknown>

  const title = decodeEntities(str(src.headline))
  const link = str(src.directLink)
  const url = link ? absoluteUrl(link) : null
  if (!title || !url) return null

  const id = new URL(url).pathname.replace(/\/$/, '').split('/').pop()
  if (!id) return null

  const img = str(src.previewImg) ?? str(src.thumbnail)
  return {
    id,
    url,
    title,
    image: img ? absoluteUrl(img) : null,
    teaser: decodeEntities(str(src.previewText)),
    publishedAt: str(src.publishDate),
  }
}

export async function fetchGoldeselAktienduelle(): Promise<AktienduellResult> {
  try {
    const res = await fetch(SOURCE_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; GoldeselContentFactory/1.0)',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error('goldesel aktienduell API HTTP', res.status)
      return { ok: false, message: `Goldesel-API antwortet mit Status ${res.status}.` }
    }
    const payload: unknown = await res.json()
    if (!Array.isArray(payload)) {
      console.error('goldesel aktienduell API: unexpected response shape')
      return { ok: false, message: 'Unerwartetes Antwortformat der Goldesel-API.' }
    }

    const seenIds = new Set<string>()
    const seenUrls = new Set<string>()
    const duels: GoldeselAktienduell[] = []
    for (const item of payload) {
      const duel = pickDuel(item)
      if (!duel || seenIds.has(duel.id) || seenUrls.has(duel.url)) continue
      seenIds.add(duel.id)
      seenUrls.add(duel.url)
      duels.push(duel)
    }
    duels.sort((a, b) => {
      const ta = a.publishedAt ? Date.parse(a.publishedAt) || 0 : 0
      const tb = b.publishedAt ? Date.parse(b.publishedAt) || 0 : 0
      return tb - ta
    })

    return {
      ok: true,
      duels: duels.slice(0, MAX_DUELS),
      fetchedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.error(
      'goldesel aktienduell API fetch error:',
      err instanceof Error ? err.name : 'unknown error',
    )
    return { ok: false, message: 'Die Goldesel-API ist gerade nicht erreichbar.' }
  }
}

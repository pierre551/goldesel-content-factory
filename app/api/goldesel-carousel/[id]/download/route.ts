import { zipSync } from 'fflate'
import { getCarousel } from '@/lib/carousel'

export const dynamic = 'force-dynamic'

/**
 * GET /api/goldesel-carousel/:id/download
 *   - no query      → ZIP of every rendered slide, deterministically ordered
 *                      and named (01-cover.png … 05-fazit.png).
 *   - ?slide=<n>     → the single rendered slide as a PNG download.
 *
 * Images are fetched server-side (no browser CORS limits) and streamed back as
 * an attachment, so the user never has to rely on five popup tabs. Slides that
 * have not rendered yet are simply skipped — a partial carousel still yields a
 * ZIP of whatever exists.
 */

// Editorial role per slide index (spec §20). Falls back to a generic name.
const SLIDE_ROLE: Record<number, string> = {
  1: 'cover',
  2: 'fakten',
  3: 'editorial',
  4: 'infografik',
  5: 'fazit',
}

function slideFileName(index: number): string {
  const role = SLIDE_ROLE[index] ?? 'slide'
  return `${String(index).padStart(2, '0')}-${role}.png`
}

function slugify(input: string, fallback: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || fallback
}

async function fetchImage(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  } catch {
    return null
  }
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const { searchParams } = new URL(request.url)
  const slideParam = searchParams.get('slide')

  const data = await getCarousel(id)
  if (!data) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { production, slides } = data
  const baseName = slugify(production.article_id || production.title, id)

  // Single-slide download.
  if (slideParam != null) {
    const index = Number(slideParam)
    const slide = slides.find((s) => s.slide_index === index)
    if (!slide?.image_url) {
      return new Response(JSON.stringify({ ok: false, error: 'slide_not_ready' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const bytes = await fetchImage(slide.image_url)
    if (!bytes) {
      return new Response(JSON.stringify({ ok: false, error: 'fetch_failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${baseName}-${slideFileName(index)}"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // Full ZIP of every rendered slide, in slide order.
  const rendered = [...slides]
    .filter((s) => s.image_url)
    .sort((a, b) => a.slide_index - b.slide_index)

  if (rendered.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: 'no_slides' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const entries: Record<string, Uint8Array> = {}
  await Promise.all(
    rendered.map(async (s) => {
      const bytes = await fetchImage(s.image_url as string)
      if (bytes) entries[slideFileName(s.slide_index)] = bytes
    }),
  )

  if (Object.keys(entries).length === 0) {
    return new Response(JSON.stringify({ ok: false, error: 'fetch_failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Store without recompression: PNGs are already compressed.
  const zipped = zipSync(entries, { level: 0 })

  return new Response(zipped as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${baseName}-carousel.zip"`,
      'Cache-Control': 'no-store',
    },
  })
}

// Runs a single enrichment step in-process on Vercel Functions. Bounded by the
// 300s function timeout (800s on Pro+Fluid). Use this for fast, free steps in
// small batches; for full catalogue runs use the GitHub Actions dispatch
// (/api/admin/enrich/dispatch).
//
// Adding a new step: extract the script's core into src/lib/enrich/<step>.ts
// exporting a function that takes { apply, limit, onProgress } and returns a
// summary, then add a `case` below.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { enrichIsbn } from '@/lib/enrich/isbn'
import { enrichCovers } from '@/lib/enrich/covers'
import { enrichDescriptions } from '@/lib/enrich/descriptions'
import { enrichAuthorPhotos } from '@/lib/enrich/author-photos'

// Up to 300s per Vercel default; Pro+Fluid raises this to 800s.
export const maxDuration = 300

const Body = z.object({
  step: z.enum(['isbn', 'covers', 'descriptions', 'author_photos']),
  apply: z.boolean().default(false),
  limit: z.number().int().positive().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const cs = await cookies()
  if (cs.get('admin_session')?.value !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.format() }, { status: 400 })
  }

  const { step, apply, limit } = parsed.data
  const startedAt = Date.now()
  const logLines: string[] = []
  const onProgress = (msg: string) => logLines.push(msg)

  try {
    switch (step) {
      case 'isbn': {
        const r = await enrichIsbn({ apply, limit, onProgress })
        return NextResponse.json({
          step, apply,
          durationMs: Date.now() - startedAt,
          summary: {
            totalCandidates: r.totalCandidates,
            processed: r.processed,
            foundOl: r.foundOl,
            foundOlTitle: r.foundOlTitle,
            foundGb: r.foundGb,
            totalFound: r.foundOl + r.foundOlTitle + r.foundGb,
            notFound: r.notFound,
            skippedDup: r.skippedDup,
            errors: r.errors,
          },
          samples: r.samples,
          log: logLines,
        })
      }
      case 'covers': {
        const r = await enrichCovers({ apply, limit, onProgress })
        return NextResponse.json({
          step, apply,
          durationMs: Date.now() - startedAt,
          summary: {
            totalCandidates: r.totalCandidates,
            alreadyTried: r.alreadyTried,
            processed: r.processed,
            found: r.found,
            rejectedPlaceholder: r.rejectedPlaceholder,
            stillFailed: r.stillFailed,
            errors: r.errors,
          },
          foundBySource: r.foundBySource,
          samples: r.samples,
          log: logLines,
        })
      }
      case 'descriptions': {
        const r = await enrichDescriptions({ apply, limit, onProgress })
        return NextResponse.json({
          step, apply,
          durationMs: Date.now() - startedAt,
          summary: {
            truncatedCandidates: r.truncatedCandidates,
            missingCandidates: r.missingCandidates,
            processedTruncated: r.processedTruncated,
            processedMissing: r.processedMissing,
            partAUpdated: r.partA.updated,
            partAFailed: r.partA.skipped,
            partBOl: r.partB.ol,
            partBGb: r.partB.gb,
            partBGpt: r.partB.gpt,
            partBSkipped: r.partB.skipped,
            errors: r.errors,
          },
          samples: r.samples,
          log: logLines,
        })
      }
      case 'author_photos': {
        const r = await enrichAuthorPhotos({ apply, limit, onProgress })
        return NextResponse.json({
          step, apply,
          durationMs: Date.now() - startedAt,
          summary: {
            totalCandidates: r.totalCandidates,
            processed: r.processed,
            accepted: r.accepted,
            skipped: r.skipped,
            viaWikidata: r.bySource.wikidata,
            viaOpenlibrary: r.bySource.openlibrary,
            viaSite: r.bySource.site,
            errors: r.errors,
          },
          // Truncate to avoid bloating the JSON payload to the browser.
          samples: r.results.slice(0, 10),
          log: logLines,
        })
      }
    }
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
      step,
      durationMs: Date.now() - startedAt,
      log: logLines,
    }, { status: 500 })
  }
}

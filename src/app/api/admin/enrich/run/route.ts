// Runs a single enrichment step in-process on Vercel Functions. Bounded by the
// 300s function timeout (800s on Pro+Fluid). Use this for fast, free steps like
// ISBN or covers in small batches; for full catalogue runs use the GitHub
// Actions dispatch (/api/admin/enrich/dispatch).
//
// Only steps that have been refactored into src/lib/enrich/<step>.ts are
// callable here. Adding a new step is a two-step:
//   1. Extract the script's core into src/lib/enrich/<step>.ts exporting a
//      function that takes { apply, limit, onProgress } and returns a summary.
//   2. Add a `case` below.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { enrichIsbn } from '@/lib/enrich/isbn'

// Up to 300s per Vercel default; Pro+Fluid raises this to 800s.
export const maxDuration = 300

const Body = z.object({
  step: z.enum(['isbn']),
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
        const result = await enrichIsbn({ apply, limit, onProgress })
        return NextResponse.json({
          step,
          apply,
          durationMs: Date.now() - startedAt,
          summary: {
            totalCandidates: result.totalCandidates,
            processed: result.processed,
            foundOl: result.foundOl,
            foundOlTitle: result.foundOlTitle,
            foundGb: result.foundGb,
            totalFound: result.foundOl + result.foundOlTitle + result.foundGb,
            notFound: result.notFound,
            errors: result.errors,
          },
          samples: result.samples,
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

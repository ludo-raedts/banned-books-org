// Dispatches the `.github/workflows/enrich.yml` workflow with user-selected
// flags. Used by /admin/scripts for full enrichment runs that exceed Vercel
// Function timeouts.
//
// Required env:
//   GITHUB_DISPATCH_TOKEN   PAT with `actions:write` scope on this repo
//   GITHUB_REPO             e.g. "ludo-raedts/banned-books-org" (owner/repo)

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { z } from 'zod'

const Body = z.object({
  steps: z.array(z.string()).min(1),
  freeOnly: z.boolean().default(false),
  gptLimit: z.number().int().positive().max(5000).default(150),
  dryRun: z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const token = process.env.GITHUB_DISPATCH_TOKEN
  const repo = process.env.GITHUB_REPO
  if (!token || !repo) {
    return NextResponse.json({
      error: 'Server missing GITHUB_DISPATCH_TOKEN or GITHUB_REPO env var.',
    }, { status: 500 })
  }

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.format() }, { status: 400 })
  }

  // 'all' overrides everything else — the workflow short-circuits to enrich-all.ts.
  const stepsArg = parsed.data.steps.includes('all') ? 'all' : parsed.data.steps.join(',')

  const ghRes = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/enrich.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          steps: stepsArg,
          free_only: String(parsed.data.freeOnly),
          gpt_limit: String(parsed.data.gptLimit),
          dry_run: String(parsed.data.dryRun),
        },
      }),
    },
  )

  if (!ghRes.ok) {
    const text = await ghRes.text().catch(() => '')
    return NextResponse.json({
      error: `GitHub dispatch failed: ${ghRes.status} ${ghRes.statusText}`,
      detail: text.slice(0, 500),
    }, { status: 502 })
  }

  // GitHub dispatch returns 204 No Content — no run-id available. Surface the
  // Actions tab URL so the operator can click through.
  return NextResponse.json({
    message: 'Dispatched. Track progress on GitHub.',
    actionsUrl: `https://github.com/${repo}/actions/workflows/enrich.yml`,
    config: {
      steps: stepsArg,
      freeOnly: parsed.data.freeOnly,
      gptLimit: parsed.data.gptLimit,
      dryRun: parsed.data.dryRun,
    },
  })
}

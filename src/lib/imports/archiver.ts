// Archive a source URL to Wayback Machine and/or archive.today.
//
// Service order comes from SOURCE_REGISTRY[sourceType].archive_strategy.
// First success wins; if all configured services fail the result is
// status='failed' with attempted_services populated for audit.
//
// Per-service timeout 60s. Service-specific quirks:
//   - Wayback: POST to /save/{url} and read the Location header (Wayback
//     returns 302 to the saved snapshot). Sometimes 523/520 under load.
//   - archive.today: POST x-www-form-urlencoded url={url} to /submit/.
//     Canonical archive URL is in the response's "refresh" header or in
//     a meta refresh in the body. We try header first, body as fallback.

import { getSourceConfig, type ArchiveService } from './source-registry'

const TIMEOUT_MS = 60_000

export type ArchiveStatus = 'archived' | 'failed' | 'skipped'

export type ArchiveResult = {
  status: ArchiveStatus
  archive_url: string | null
  archive_service: ArchiveService | null
  attempted_services: string[]
  error: string | null
}

export async function archiveUrl(
  url: string,
  sourceType: string,
): Promise<ArchiveResult> {
  const config = getSourceConfig(sourceType)
  const attempted: string[] = []
  const errors: string[] = []

  for (const service of config.archive_strategy) {
    attempted.push(service)
    try {
      const archived = service === 'wayback'
        ? await submitToWayback(url)
        : await submitToArchiveToday(url)
      if (archived) {
        return {
          status: 'archived',
          archive_url: archived,
          archive_service: service,
          attempted_services: attempted,
          error: null,
        }
      }
      errors.push(`${service}: no archive url returned`)
    } catch (err) {
      errors.push(`${service}: ${(err as Error).message}`)
    }
  }

  return {
    status: 'failed',
    archive_url: null,
    archive_service: null,
    attempted_services: attempted,
    error: errors.join('; '),
  }
}

async function submitToWayback(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const target = `https://web.archive.org/save/${url}`
    const response = await fetch(target, {
      method: 'POST',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'Banned-Books-Org-Importer/1.0' },
    })

    const location = response.headers.get('location') ?? response.headers.get('content-location')
    if (location) {
      return new URL(location, 'https://web.archive.org').toString()
    }

    if (response.status >= 200 && response.status < 300) {
      const match = (await response.text()).match(/https?:\/\/web\.archive\.org\/web\/\d+\/[^\s"'<>]+/)
      if (match) return match[0]
    }

    return null
  } finally {
    clearTimeout(timer)
  }
}

async function submitToArchiveToday(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch('https://archive.ph/submit/', {
      method: 'POST',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Banned-Books-Org-Importer/1.0',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ url }).toString(),
    })

    const refresh = response.headers.get('refresh')
    if (refresh) {
      const match = refresh.match(/url=(.+)$/i)
      if (match) return match[1].trim()
    }

    const location = response.headers.get('location')
    if (location) return new URL(location, 'https://archive.ph').toString()

    if (response.status >= 200 && response.status < 300) {
      const body = await response.text()
      const meta = body.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+url=([^"'>\s]+)/i)
      if (meta) return meta[1]
      const inline = body.match(/https?:\/\/archive\.(?:ph|today|is)\/[A-Za-z0-9]+/)
      if (inline) return inline[0]
    }

    return null
  } finally {
    clearTimeout(timer)
  }
}

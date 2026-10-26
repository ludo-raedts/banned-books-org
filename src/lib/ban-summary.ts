// Deterministic "Why it was banned" summary, built from the ban rows alone.
//
// Replaces GPT prose that only restated the bans table (flagged by
// scripts/flag-restatement-ban-descriptions.ts → description_ban_status =
// 'auto_rejected_low_quality'). For most school-ban books our sources record
// where, when and how a book was removed — not why. The old prose papered over
// that with "the official reason was categorized as 'Other'" and "there are no
// documented lawsuits…"; this summary says what the source records and
// attributes the gap to the source, never to the world.
//
// Pure function over data the book page already fetched — no query.

export type SummaryBan = {
  year_started: number | null
  year_ended?: number | null
  status?: string
  action_type: string
  country_code: string
  region: string | null
  institution: string | null
  actor?: string | null
  countries: { name_en: string } | null
  scopes: { label_en: string } | null
  ban_reason_links: { reasons: { slug: string } | null }[]
  ban_source_links: { ban_sources: { source_name: string; source_url: string } | null }[]
}

export type BanSummary = {
  /** One sentence per place, earliest first (max MAX_PLACES). */
  sentences: string[]
  /** "Further actions in N other places are listed below." or null. */
  more: string | null
  /** What the source does and does not record, or null. */
  sourceNote: string | null
}

const MAX_PLACES = 3
const ACTION_RANK: Record<string, number> = { banned: 3, restricted: 2, challenged: 1 }

// PEN America's "ban origin" field, as imported into bans.actor.
function actorClause(actor: string | null | undefined): string {
  const a = (actor ?? '').toLowerCase()
  if (a.startsWith('formal challenge')) return ' after a formal challenge'
  if (a.startsWith('informal challenge')) return ' after an informal challenge'
  if (a === 'administration') return ' by administrative decision'
  return ''
}

function formatYears(years: number[]): string {
  const ys = [...new Set(years)].sort((a, b) => a - b)
  if (ys.length === 0) return ''
  if (ys.length === 1) return ` in ${ys[0]}`
  if (ys.length === 2) return ` in ${ys[0]} and ${ys[1]}`
  return ` between ${ys[0]} and ${ys[ys.length - 1]}`
}

function isPen(b: SummaryBan): boolean {
  return b.ban_source_links.some(l => l.ban_sources?.source_name.startsWith('PEN America'))
}

function placeLabel(b: SummaryBan): string {
  const country = b.countries?.name_en ?? b.country_code
  // region 'Nation' is the DoDEA label, not a place (see project memory).
  const region = b.region && b.region !== 'Nation' ? b.region : null
  if (b.institution) {
    const inst = b.institution.replace(/^the /i, '')
    // "U.S. Naval Academy (Nimitz Library)" already carries parentheses — a
    // second "(Maryland)" reads badly; region is in the bans table anyway.
    const withRegion = region && !inst.includes(region) && !inst.includes('(') ? `${inst} (${region})` : inst
    return `the ${withRegion}`.replace(/^the (?=[A-Z][a-z]+ [A-Z][a-z]+ (?:of|for) )/, 'the ')
  }
  return region ? `${region}, ${country}` : country
}

export function buildBanRowSummary(title: string, bans: SummaryBan[]): BanSummary | null {
  if (bans.length === 0) return null

  // One group per place: institution when known, else region/country + scope.
  const groups = new Map<string, SummaryBan[]>()
  for (const b of bans) {
    const key = b.institution
      ? `i:${b.institution}|${b.region ?? ''}`
      : `p:${b.country_code}|${b.region ?? ''}|${b.scopes?.label_en ?? ''}`
    const g = groups.get(key)
    if (g) g.push(b)
    else groups.set(key, [b])
  }
  const ordered = [...groups.values()].sort((a, b) =>
    Math.min(...a.map(x => x.year_started ?? 9999)) - Math.min(...b.map(x => x.year_started ?? 9999)),
  )
  const shown = ordered.slice(0, MAX_PLACES)

  const sentences = shown.map(group => {
    const first = group[0]
    const action = group.reduce((best, b) =>
      (ACTION_RANK[b.action_type] ?? 0) > (ACTION_RANK[best] ?? 0) ? b.action_type : best, first.action_type)
    const years = formatYears(group.map(b => b.year_started).filter((y): y is number => y != null))
    const actor = actorClause(group.find(b => b.actor)?.actor)
    const place = placeLabel(first)
    // Every ban in the group reversed (status 'rescinded') → say so.
    const ended = group.map(b => b.year_ended).filter((y): y is number => y != null)
    const reversed = group.every(b => b.status === 'rescinded')
    const endYear = ended.length ? ` in ${Math.max(...ended)}` : ''

    if (first.institution) {
      const Place = place.charAt(0).toUpperCase() + place.slice(1)
      if (action === 'challenged') return `${title} was challenged at ${place}${years}.`
      const verb = action === 'restricted' ? 'restricted access to' : 'removed'
      const tail = reversed ? ` The decision was reversed${endYear}.` : ''
      return `${Place} ${verb} ${title}${years}${actor}.${tail}`
    }
    const scope = first.scopes?.label_en
    const scopePhrase = !scope || scope === 'Government / national'
      ? ''
      : ` (${scope.toLowerCase()})`
    const verb = action === 'restricted' ? 'restricted' : action === 'challenged' ? 'challenged' : 'banned'
    const tail = reversed ? ` The ban was lifted${endYear}.` : ''
    return `${title} was ${verb} in ${place}${scopePhrase}${years}${actor}.${tail}`
  })

  const rest = ordered.length - shown.length
  const more = rest > 0
    ? `Further actions in ${rest} other ${rest === 1 ? 'place are' : 'places are'} listed below.`
    : null

  // Source note — only when every shown ban lacks a substantive reason, so we
  // never contradict a reason that a source does state.
  const shownBans = shown.flat()
  const noStatedReason = shownBans.every(b =>
    b.ban_reason_links.every(l => !l.reasons || l.reasons.slug === 'other'))
  let sourceNote: string | null = null
  if (shownBans.every(isPen)) {
    sourceNote = "PEN America's Index of School Book Bans records where, when and how a book was removed — not the reason a district gave."
  } else if (noStatedReason) {
    sourceNote = 'Our sources for this ban do not record the reason given.'
  }

  return { sentences, more, sourceNote }
}

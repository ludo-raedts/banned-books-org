// The one-sentence lead under a news headline on the homepage. The reviewer
// (2026-11-11) wants a short, COMPLETE sentence, never one cut off by a line
// clamp: so the sentence is shortened by dropping what the card already shows
// (the source name follows below) and trailing clauses, and is then shown in
// full, even when it needs three lines.

const MAX_LEAD = 150
const MIN_LEAD = 50

// ", according to <source>[…]" — the source is printed under the lead already.
const ATTRIBUTION_TAIL = /,?\s+according to\b.*$/i

// A comma that starts a droppable trailing clause (", calling for …",
// ", an annual event …", ", which …") and not the next item of a list.
const TRAILING_CLAUSE = /^,\s+(?:\w+ing|which|who|whose|while|with|an?|the|amid|after|because|as)\b/i

export function firstSentence(summary: string): string {
  const flat = summary.replace(/\*/g, '').replace(/\s+/g, ' ').trim()
  const m = flat.match(/^.{20,}?[.!?](?=\s+[A-Z“"']|$)/)
  return (m ? m[0] : flat).trim()
}

export function newsLead(summary: string): string {
  let s = firstSentence(summary)
  const withoutSource = s.replace(ATTRIBUTION_TAIL, '').trim()
  if (withoutSource.length >= MIN_LEAD) s = withoutSource.endsWith('.') ? withoutSource : `${withoutSource}.`

  if (s.length > MAX_LEAD) {
    // Cut at the last droppable clause that still leaves a full sentence.
    for (let i = s.lastIndexOf(','); i >= MIN_LEAD; i = s.lastIndexOf(',', i - 1)) {
      if (i <= MAX_LEAD && TRAILING_CLAUSE.test(s.slice(i))) {
        s = `${s.slice(0, i)}.`
        break
      }
    }
  }
  return s
}

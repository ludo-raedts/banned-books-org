#!/usr/bin/env tsx
/**
 * Second pass over the rows import-index-1877.ts HELD (2026-11-09): recover what
 * can be recovered deterministically, write a patched stage-1 file plus the list
 * of seqs to import, and leave the rest held. No LLM, no network.
 *
 *  1. Ban year from the OCR text (rows held for "no ban year"):
 *     a. BRACE — the Index prints one decree for a run of works by the same
 *        author as a brace to the right: "Satire. Decr." / "— La tirannide.
 *        20. Ian." / "— Vita scritta da esso. 1823." stage0 read each line as
 *        its own entry, so only the last one got the year. A brace = a line
 *        ending in "Decr." followed (≤7 lines) only by sibling ("—") or
 *        continuation lines, a "<day>. <month>" and a line ending in the year,
 *        with no other "Decr." in between. Every row in the span gets the year.
 *     b. CONTINUATION — the entry's own date wrapped onto a following line that
 *        starts lowercase / with "Decr."/"S. Off."/a month (never a new entry).
 *     A first attempt that also took any year on the next 1–3 lines was ~40%
 *     wrong (OCR-mangled headwords look like continuations), so those are NOT
 *     used; the ~1,000 rows without a brace/continuation date stay held.
 *  2. Author for rows held as "one-word uncertain author name": a hand-reviewed
 *     map (NAMES) from the printed headword to the identified person. Pseudonyms
 *     resolve to the real author (Gualdi → Leti, Gery → Quesnel, "de Francheville"
 *     → Voltaire for Le siècle de Louis XIV). OCR-garbled Tridentine headwords,
 *     bare given names and unidentified pseudonyms stay held.
 *
 * Special cases that are not a new book (System of Nature #924, Vita di donna
 * Olimpia #32742) are handled in fix-index-1877-held-special.ts, not here.
 *
 *   npx tsx scripts/patch-index-1877-held.ts
 *   → data/index-1877/stage1-2026-11-10.json + held-recovery-2026-11-10-seqs.json
 *   then: import-index-1877.ts --date=2026-11-10 --only-seqs=data/index-1877/held-recovery-2026-11-10-seqs.json
 */
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = 'data/index-1877'
const IN = `${DIR}/stage1-2026-11-09.json`
const OUT = `${DIR}/stage1-2026-11-10.json`
const SEQS = `${DIR}/held-recovery-2026-11-10-seqs.json`
const TEXT = `${DIR}/index-1877-djvu.txt`

type Llm = { class: string; author: string | null; author_confidence: 'high' | 'low' | null; title: string | null; decree_year: number | null; language: string | null }
type Row = { seq: number; line: number; raw: string; year: number | string | null; year_basis: string | null; llm: Llm | null; [k: string]: unknown }

// Printed headword (+ given name) → identified author. seq = the HEAD entry;
// "—" sub-entries inherit it in the importer. Checked by hand against the raw text.
const NAMES: Record<number, { author: string; seqs: number[]; note: string }> = {
  104: { author: 'Christophorus Alethophilus', seqs: [104, 105], note: 'pseudonym as printed: "ALETHOPHILUS CHRIST."' },
  124: { author: 'Pons-Augustin Alletz', seqs: [124], note: 'Dictionnaire des conciles' },
  771: { author: 'Francesco Paolo Bozzelli', seqs: [771], note: "De l'union de la philosophie avec la morale (1825)" },
  1063: { author: 'Giovanni Battista Casti', seqs: [1063, 1064], note: 'Novelle; Gli animali parlanti' },
  1747: { author: 'Louis de Dieu', seqs: [1747, 1749], note: 'Dutch orientalist; Xavier\'s Persian Historia s. Petri' },
  1833: { author: 'Paulus Dorscius', seqs: [1833, 1834], note: 'as printed: "Dorscius Pau. 1. Cl."' },
  1887: { author: 'Charles-Marguerite Dupaty', seqs: [1887], note: 'OCR "Durary" = DUPATY, Lettres sur l\'Italie' },
  2360: { author: 'Voltaire', seqs: [2360], note: 'Le siècle de Louis XIV, first published under the name "M. de Francheville"' },
  2525: { author: 'Pasquier Quesnel', seqs: [2525], note: '"Gery" = Quesnel\'s pseudonym, Apologie historique des deux censures' },
  2606: { author: 'Oliver Goldsmith', seqs: [2606], note: 'OCR "GorpswirH" = GOLDSMITH, Compendio della storia d\'Inghilterra' },
  3344: { author: 'Pierre Lacour', seqs: [3344], note: 'Æloim, ou les Dieux de Moïse' },
  3737: { author: 'Philipp Lonicer', seqs: [3737, 3738], note: '"Lonicerus Ph.", Chronica turcica' },
  3922: { author: 'Mariano Maresca', seqs: [3922], note: 'as printed: "Maresca Mariano"' },
  4406: { author: 'Pierre Parisot', seqs: [4408], note: '"P. Norberto" = Père Norbert (Pierre Parisot), Mémoires historiques sur les missions des Indes' },
  4488: { author: 'Philipp Andreas Oldenburger', seqs: [4488, 4489], note: 'Thesaurus rerum publicarum' },
  4658: { author: 'Johannes Pappus', seqs: [4658, 4659], note: 'Lutheran theologian, "Pappus Joan. 1. Cl."' },
  4745: { author: 'António Pereira de Figueiredo', seqs: [4746], note: '"Pereira de Figueiredo", Analyse da profissão da fé' },
  4952: { author: 'Louis de Potter', seqs: [4952, 4953, 4954, 4955], note: 'OCR "Porter (de)" = de POTTER: conciles, Vie de Scipion de Ricci, L\'esprit de l\'église' },
  4963: { author: 'Dominique Dufour de Pradt', seqs: [4963, 4964, 4965], note: 'OCR "Prapr (de)" = de PRADT: Les quatre concordats, Congrès de Panama' },
  5094: { author: 'Lactantius Ragnonus', seqs: [5094], note: 'as printed: "RAGNONUS Lactant. 1. Cl."' },
  5344: { author: 'Hermannus Ryswick', seqs: [5344], note: 'as printed: "Riswick, seu Ryswick Hermas." (burned 1512)' },
  5454: { author: 'Jean Rousset de Missy', seqs: [5454], note: 'Histoire mémorable des guerres entre les maisons de France et d\'Autriche' },
  6070: { author: 'Eugène Sue', seqs: [6070], note: 'OCR "Que EuGÈNE" = SUE Eugène, opera omnia 1852' },
  6630: { author: 'François-Rodolphe de Weiss', seqs: [6630], note: 'Principes philosophiques, politiques et moraux (Italian translation)' },
  // Year-recovered rows whose LLM author was wrong (renamed in fix-index-1877-held-special.ts
  // where the wrong name already exists as an author):
  722: { author: 'Jean-Baptiste Bordas-Demoulin', seqs: [], note: '"Bonpas-DEwovLIN" = BORDAS-DEMOULIN (LLM: Charles de Bonald)' },
  2088: { author: 'Aegidius Estrix', seqs: [], note: '"Estrix Arci." = Gilles Estrix SJ (LLM: Archibald Pitcairne)' },
  4310: { author: 'Mateo de Moya', seqs: [], note: '"Moya (de) Marra" = Mateo de Moya SJ, Quaestiones selectae' },
  4856: { author: 'Pigault-Lebrun', seqs: [], note: '"PicauLr-LE-Brun" = PIGAULT-LEBRUN (LLM: Louis Picardet de La Brûlerie)' },
  5437: { author: 'Gabriele Rossetti', seqs: [], note: '"Rosserri Gabr." = Gabriele Rossetti (LLM: Giuseppe)' },
}

// Not separate works: "Eaedem cum notis / italice" are editions of the Satyrae above;
// "Et cetera eiusdem opera" is not a title; 3121 is the opusculum inside 3120.
const DROP = new Set([5776, 5777, 5690, 3121])
const TITLES: Record<number, string> = { 5541: 'De regimine christianorum principum' }

const DECR_END = /\b(?:[DP][ec][ec]r|Dccr|Decret)[.,]?\s*\S?\s*$/
const DECR = /\b(?:[DP][ec][ec]r|Dccr|Decret)\b/
const DECR_POS = /\b(?:[DP][ec][ec]r|Dccr|Decret)[.,]?/
const YEAR_END = /\b(1[5-8]\d\d)\.?\s*\S{0,3}\s*$/
const YEAR = /\b(1[5-8]\d\d)\b/
const DAY_MONTH = /\b\d{1,2}\.\s*(?:Ian|lan|Febr|Mart|Apr|Maii|Iun|lun|Iul|Tul|Aug|Sept|Oct|Nov|Dec)\b/
const CONT = /^(?:[a-zà-ÿ\d(.,;:]|(?:Decr|Deer|Dccr|Decret|S\.\s*Off|Ian|lan|Febr|Mart|Apr|Maii|Iun|lun|Iul|Tul|Aug|Sept|Oct|Nov|Dec)\b)/
const plausible = (y: unknown) => /^\d{4}$/.test(String(y ?? '')) && +String(y) >= 1500 && +String(y) <= 1877
const isNoise = (l: string) => l.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 3 && !YEAR.test(l)

function main() {
  const rows: Row[] = JSON.parse(readFileSync(IN, 'utf8'))
  const L = readFileSync(TEXT, 'utf8').split('\n')
  const usable = rows.filter(r => r.llm && (r.llm.class === 'book' || r.llm.class === 'blanket'))
  const noYear = usable.filter(r => !plausible(r.year))

  // 1a. brace spans over the whole text
  const lineYear = new Map<number, number>()
  for (let s = 0; s < L.length; s++) {
    const head = L[s].trim()
    if (!DECR_END.test(head) || YEAR_END.test(head)) continue
    let month = false
    for (let j = s + 1; j < Math.min(s + 8, L.length); j++) {
      const t = L[j].trim()
      if (!t) continue
      if (!(/^[—–]/.test(t) || /^[a-zà-ÿ\d]/.test(t)) || DECR.test(t)) break
      if (DAY_MONTH.test(t)) month = true
      const m = YEAR_END.exec(t)
      if (m) {
        if (month && plausible(m[1])) for (let k = s; k <= j; k++) lineYear.set(k, Number(m[1]))
        break
      }
    }
  }

  const years = new Map<number, { year: number; how: string }>()
  for (const r of noYear) {
    const first = r.raw.split('\n')[0].trim().slice(0, 20)
    const start = L.findIndex((l, j) => j >= r.line - 3 && j < r.line + 30 && l.trim().startsWith(first))
    if (start >= 0 && lineYear.has(start)) { years.set(r.seq, { year: lineYear.get(start)!, how: 'brace' }); continue }
    // 1b. own continuation
    const lastRaw = r.raw.split('\n').at(-1)!.trim().slice(-20)
    const end = L.findIndex((l, j) => j >= r.line - 1 && j < r.line + 40 && l.trim() !== '' && l.trim().endsWith(lastRaw))
    if (end < 0) continue
    const cont: string[] = []
    for (let j = end + 1; j < Math.min(end + 8, L.length) && cont.length < 3; j++) {
      const t = L[j].trim()
      if (!t || isNoise(t)) continue
      if (!CONT.test(t)) break
      cont.push(t)
      if (YEAR.test(t)) break
    }
    if (!cont.length) continue
    const text = [r.raw, ...cont].join(' ')
    const d = DECR_POS.exec(text)
    const y = d && YEAR.exec(text.slice(d.index))
    if (y && plausible(y[1])) years.set(r.seq, { year: Number(y[1]), how: 'continuation' })
  }

  // 2. names
  const byHead = new Map<number, string>()
  const nameSeqs = new Set<number>()
  for (const [head, n] of Object.entries(NAMES)) { byHead.set(Number(head), n.author); n.seqs.forEach(s => nameSeqs.add(s)) }

  const out = rows.map(r => {
    const y = years.get(r.seq)
    const name = byHead.get(r.seq)
    const title = TITLES[r.seq]
    if (!y && !name && !title) return r
    const p: Row = { ...r, llm: r.llm ? { ...r.llm } : r.llm }
    if (y) { p.year = y.year; p.year_basis = 'decree'; p.year_recovered = y.how }
    if (name && p.llm) { p.llm.author = name; p.llm.author_confidence = 'high'; p.author_reviewed = NAMES[r.seq].note }
    if (title && p.llm) p.llm.title = title
    return p
  })
  const seqs = [...new Set([...years.keys(), ...nameSeqs])].filter(s => !DROP.has(s)).sort((a, b) => a - b)
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  writeFileSync(SEQS, JSON.stringify(seqs))
  const how = [...years.values()].reduce((m, v) => m.set(v.how, (m.get(v.how) ?? 0) + 1), new Map<string, number>())
  console.log(`held without year: ${noYear.length}; recovered ${years.size} (${[...how].map(([k, v]) => `${k} ${v}`).join(', ')})`)
  console.log(`names: ${Object.keys(NAMES).length} authors over ${nameSeqs.size} rows`)
  console.log(`→ ${OUT}\n→ ${SEQS} (${seqs.length} seqs)`)
}
main()

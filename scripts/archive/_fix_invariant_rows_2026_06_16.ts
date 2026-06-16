// _fix_invariant_rows_2026_06_16.ts — one-off correction of the two invariant
// failures flagged by audit-integrity.ts on 2026-06-16. Read the header before re-running.
//
// Doctrine: this repo fixes DATA via guarded --apply scripts (schema-only changes go
// through supabase/migrations). Default dry-run; --apply writes. Idempotent: each fix is
// guarded so a second run is a no-op. Backs up the BEFORE state of every touched row to
// data/_fix-invariant-rows-backup-2026-06-16.json so the change is trivially reversible.
//
//   pnpm tsx --env-file=.env.local scripts/_fix_invariant_rows_2026_06_16.ts [--only=mojibake|author|all] [--apply]
//
// FIX 1 (mojibake invariant) — book 16888 "Con Sandino en Nicaragua":
//   description_book has 20 U+FFFD where Spanish accents were lost in a Latin-1→UTF-8
//   botch. One replacement char = exactly one dropped accented letter, so the text is
//   reconstructed deterministically from Spanish orthography. Title/slug untouched.
//
// FIX 2 (impossible-year invariant) — author 10286 "Jean Marcel":
//   Book 14977 (pub 1938, banned FR 1940, Liste Otto, Plon) is by "Jean Marcel" per BnF
//   (dates "19..?"). The OL/photo enrichment wrongly matched the bare name to a DIFFERENT
//   person — Jean Marcel Paquette, Québécois professor b.1941 — stamping birth_year=1941,
//   openlibrary_author_id=OL318044A and his photo onto the 1938 author. We null those three
//   wrong-person fields. Year and the book→author link are CORRECT and stay untouched.
//   ol_checked_at / photo_v2_checked_at stay set so the enrichers treat the row as done and
//   don't re-pull the wrong namesake.

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { adminClient } from '../src/lib/supabase'
import { isApply, flagValue } from './lib/cli'

const sb = adminClient()
const apply = isApply()
const only = (flagValue('only') ?? 'all').toLowerCase()
const doMojibake = only === 'all' || only === 'mojibake'
const doAuthor = only === 'all' || only === 'author'

const FFFD = '�'

const CORRECTED_DESC =
  'Esta obra sobre el General Augusto César Sandino, publicada el mismo año de su asesinato (1934) fue escrita por el periodista español, Ramón Belausteguigoitia. Aunque el subtítulo: "La hora de la paz" no se correspondió con la formación de una brutal dictadura que se inicia con el asesinato mismo de Sandino, lo hemos dejado respetando al autor que así subtituló su libro, en el cual se describe, desde las montañas de las Segovias, la lucha heroica contra los marines gringos y sus cipayos nacionales, en defensa de la soberanía de la patria. A continuación fragmento de su introducción:*****En viaje ya hacia Nicaragua, se iniciaban entretanto las negociaciones de paz. Todavía, sin embargo, cuando llegué al campamento, el aparato militar continuaba, y pude ver y tratar a Sandino en el mismo escenario de sus luchas, apreciando, en momentos en que muchos obstáculos se oponían a la paz y la Guardia Nacional atacaba a las columnas sandinistas, su espíritu elevado de patriota, decidido a no convertir la guerra de la libertad en una guerra civil.Estas líneas tienden a reflejar lo que ha sido la guerra nicaragüense y, sobre todo, a dar a conocer la personalidad de Sandino, el hombre que, sin temperamento de guerrero nato, enemigo de la guerra por la guerra y apreciando sinceramente al pueblo americano, ha levantado su bandera contra todo el poder del imperialismo yanqui.'

async function main() {
  const backup: Record<string, unknown> = { generatedAt: '2026-06-16', rows: [] as unknown[] }
  const rows = backup.rows as unknown[]

  // ---- FIX 1: mojibake ----
  if (doMojibake) {
    const { data: book, error } = await sb
      .from('books')
      .select('id, slug, description_book')
      .eq('id', 16888)
      .single()
    if (error) throw error
    const desc = book.description_book ?? ''
    const ffCount = [...desc].filter((c) => c === FFFD).length
    console.log(`\n[FIX 1 mojibake] book 16888 (${book.slug})`)
    if (ffCount === 0) {
      console.log('  already clean (no U+FFFD) — no-op')
    } else {
      if (CORRECTED_DESC.includes(FFFD)) throw new Error('corrected text still has U+FFFD — abort')
      console.log(`  U+FFFD in description: ${ffCount} → 0`)
      console.log(`  length ${desc.length} → ${CORRECTED_DESC.length}`)
      rows.push({ table: 'books', id: 16888, field: 'description_book', before: desc })
      if (apply) {
        const { error: upErr } = await sb
          .from('books')
          .update({ description_book: CORRECTED_DESC })
          .eq('id', 16888)
          .like('description_book', `%${FFFD}%`) // idempotency guard
        if (upErr) throw upErr
        console.log('  ✓ applied')
      }
    }
  }

  // ---- FIX 2: namesake / impossible year ----
  if (doAuthor) {
    const { data: au, error } = await sb
      .from('authors')
      .select('id, slug, display_name, birth_year, photo_url, openlibrary_author_id')
      .eq('id', 10286)
      .single()
    if (error) throw error
    console.log(`\n[FIX 2 namesake] author 10286 (${au.slug} "${au.display_name}")`)
    if (au.birth_year == null && au.photo_url == null && au.openlibrary_author_id == null) {
      console.log('  already scrubbed — no-op')
    } else {
      console.log(`  birth_year            : ${au.birth_year} → null`)
      console.log(`  photo_url             : ${au.photo_url ? 'set (Jean Marcel Paquette)' : 'null'} → null`)
      console.log(`  openlibrary_author_id : ${au.openlibrary_author_id} → null`)
      rows.push({
        table: 'authors',
        id: 10286,
        before: {
          birth_year: au.birth_year,
          photo_url: au.photo_url,
          openlibrary_author_id: au.openlibrary_author_id,
        },
      })
      if (apply) {
        const { error: upErr } = await sb
          .from('authors')
          .update({ birth_year: null, photo_url: null, openlibrary_author_id: null })
          .eq('id', 10286)
          .eq('birth_year', 1941) // idempotency guard — only the contaminated state
        if (upErr) throw upErr
        console.log('  ✓ applied')
      }
    }
  }

  if (apply && rows.length) {
    const path = resolve(__dirname, '../data/_fix-invariant-rows-backup-2026-06-16.json')
    writeFileSync(path, JSON.stringify(backup, null, 2))
    console.log(`\nbackup written: ${path}`)
  }
  console.log(apply ? '\nDONE (--apply).' : '\nDRY-RUN — re-run with --apply to write.')
}

main().then(() => process.exit(0))

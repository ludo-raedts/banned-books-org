// matchExistingBook is THE match-before-create gate every importer runs
// through; a silent regression here mints duplicate books by the thousand
// (the cross-language dupe class). These tests pin the four resolution tiers
// and their ordering against a fake DB:
//
//   1. exact slug on the edition title
//   2. exact slug on the English work title (cross-language bridge)
//   3. pg_trgm fuzzy on the edition title
//   4. pg_trgm fuzzy on the English title
//
// The Supabase client is mocked: exact tiers hit .from('books'), fuzzy tiers
// hit the find_book_candidates_by_title RPC. Fuzzy scoring itself lives in
// Postgres (pg_trgm) — here we only model which candidates the RPC returns,
// so what's under test is the tier order, thresholds passed through, and the
// no_match/exact/fuzzy contract.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { slugify } from '../slugify'

type FuzzyRow = { id: number; title: string; slug: string; score: number }

const db = {
  // slug -> id
  books: new Map<string, number>(),
  // query title -> candidate rows the pg_trgm RPC would surface
  fuzzy: new Map<string, FuzzyRow[]>(),
  rpcCalls: [] as Array<{ q: string; threshold: number }>,
}

vi.mock('../../supabase', () => ({
  adminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, slug: string) => ({
          maybeSingle: async () => {
            if (table !== 'books') throw new Error(`unexpected table ${table}`)
            const id = db.books.get(slug)
            return { data: id != null ? { id } : null, error: null }
          },
        }),
      }),
    }),
    rpc: async (fn: string, args: { q: string; threshold: number }) => {
      if (fn !== 'find_book_candidates_by_title') throw new Error(`unexpected rpc ${fn}`)
      db.rpcCalls.push(args)
      return { data: db.fuzzy.get(args.q) ?? [], error: null }
    },
  }),
}))

// Import AFTER the mock so verifier picks up the fake client.
const { matchExistingBook } = await import('../verifier')

function seedBook(id: number, title: string) {
  db.books.set(slugify(title), id)
}

beforeEach(() => {
  db.books.clear()
  db.fuzzy.clear()
  db.rpcCalls = []
})

describe('matchExistingBook — tier 1: exact slug', () => {
  it('finds an existing book by exact slug', async () => {
    seedBook(1, 'The Anarchist Cookbook')
    const m = await matchExistingBook({ title: 'The Anarchist Cookbook' })
    expect(m).toEqual({ id: 1, status: 'exact', confidence: 1 })
  })

  it('slug normalisation bridges punctuation/case variants', async () => {
    seedBook(2, "The Handmaid's Tale")
    const m = await matchExistingBook({ title: 'the handmaid’s tale' })
    expect(m?.id).toBe(2)
    expect(m?.status).toBe('exact')
  })

  it('does NOT exact-match a different compound spacing ("cook book" vs "cookbook")', async () => {
    // The spaceless dupe class (#16302/#558) is deliberately NOT collapsed at
    // ingest: slugs differ, so only fuzzy (threshold-gated) may bridge it.
    seedBook(3, 'The Anarchist Cookbook')
    const m = await matchExistingBook({ title: 'The Anarchist Cook Book' })
    expect(m).toBeNull()
  })
})

describe('matchExistingBook — tier 2: English-title slug (cross-language)', () => {
  it('matches a foreign edition to the English canonical via englishTitle', async () => {
    seedBook(4, 'The House on Mango Street')
    const m = await matchExistingBook({
      title: 'La Casa en Mango Street',
      englishTitle: 'The House on Mango Street',
    })
    expect(m).toEqual({ id: 4, status: 'exact', confidence: 1 })
  })

  it('skips the English tier when englishTitle slugs the same as the title', async () => {
    // An already-English book must not cost a second exact query; with no
    // seeded book and no fuzzy rows this falls through to no_match.
    const m = await matchExistingBook({ title: 'Beloved', englishTitle: 'Beloved' })
    expect(m).toBeNull()
    // Only the edition-title fuzzy ran — no English-title fuzzy duplicate.
    expect(db.rpcCalls.map(c => c.q)).toEqual(['Beloved'])
  })

  it('prefers the edition-slug hit over the English-slug hit when both exist', async () => {
    seedBook(5, 'Mon Combat')
    seedBook(6, 'Mein Kampf')
    const m = await matchExistingBook({ title: 'Mon Combat', englishTitle: 'Mein Kampf' })
    expect(m?.id).toBe(5)
  })
})

describe('matchExistingBook — tiers 3+4: fuzzy', () => {
  it('falls through to fuzzy on the edition title and reports confidence', async () => {
    db.fuzzy.set('The Adventures of Huckleberry Fin', [
      { id: 7, title: 'The Adventures of Huckleberry Finn', slug: 'the-adventures-of-huckleberry-finn', score: 0.93 },
    ])
    const m = await matchExistingBook({ title: 'The Adventures of Huckleberry Fin' })
    expect(m).toEqual({ id: 7, status: 'fuzzy', confidence: 0.93 })
  })

  it('takes the top-scored candidate when several match', async () => {
    db.fuzzy.set('Nineteen Eighty Four', [
      { id: 8, title: 'Nineteen Eighty-Four', slug: 'nineteen-eighty-four', score: 0.97 },
      { id: 9, title: 'Nineteen Eighty-Four: A Novel', slug: 'nineteen-eighty-four-a-novel', score: 0.9 },
    ])
    const m = await matchExistingBook({ title: 'Nineteen Eighty Four' })
    expect(m?.id).toBe(8)
  })

  it('fuzzy-falls-back to the English title when the edition title has no candidates', async () => {
    db.fuzzy.set('Doktor Schiwago', [])
    db.fuzzy.set('Doctor Zhivago', [
      { id: 10, title: 'Doctor Zhivago', slug: 'doctor-zhivago', score: 0.9 },
    ])
    const m = await matchExistingBook({ title: 'Doktor Schiwago', englishTitle: 'Doctor Zhivago' })
    expect(m).toEqual({ id: 10, status: 'fuzzy', confidence: 0.9 })
  })

  it('passes the default 0.85 threshold to the RPC, and a custom one when given', async () => {
    await matchExistingBook({ title: 'Some Title' })
    await matchExistingBook({ title: 'Some Title', threshold: 0.92 })
    expect(db.rpcCalls.map(c => c.threshold)).toEqual([0.85, 0.92])
  })

  it('returns null on no match anywhere', async () => {
    const m = await matchExistingBook({ title: 'Completely Unknown Work', englishTitle: 'Still Unknown' })
    expect(m).toBeNull()
    // Both fuzzy tiers were tried before giving up.
    expect(db.rpcCalls.map(c => c.q)).toEqual(['Completely Unknown Work', 'Still Unknown'])
  })
})

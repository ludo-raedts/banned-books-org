#!/usr/bin/env tsx
/**
 * Convert docs/zenodo/data-descriptor.md → docs/zenodo/data-descriptor.pdf
 * for the Zenodo deposit.
 *
 * Route: marked (markdown → tokens) + @react-pdf/renderer (tokens → PDF).
 * Both are already in the repo's node toolchain — no pandoc / LaTeX / headless
 * Chrome needed. Real bordered tables and a non-reflowing monospace block for
 * the join diagram are the two things naive converters break, so they get
 * explicit handling here.
 *
 * Fonts: body = Arial, code/diagram = Andale Mono (both macOS-bundled .ttf,
 * subset-embedded into the PDF at generation). Arial covers the arrows (→ ↔)
 * and ≈ that the descriptor uses; Andale Mono covers the box-drawing glyphs
 * (─ │ ┌ ┴ ┐). If a font file is absent (non-macOS), we fall back to the
 * built-in Helvetica/Courier and substitute the non-WinAnsi glyphs so the run
 * still succeeds — but box-drawing fidelity then degrades (warned at runtime).
 *
 * Usage: pnpm tsx scripts/zenodo-descriptor-to-pdf.tsx
 */

import React from 'react'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { marked, type Token, type Tokens } from 'marked'
import {
  Document, Page, View, Text, Link, Font, StyleSheet, renderToFile,
} from '@react-pdf/renderer'

const ROOT = process.cwd()
const SRC = join(ROOT, 'docs', 'zenodo', 'data-descriptor.md')
const OUT = join(ROOT, 'docs', 'zenodo', 'data-descriptor.pdf')

const OXBLOOD = '#7a1a1a'
const INK = '#1a1a1a'
const MUTED = '#5b5b5b'
const RULE = '#cfcfcf'
const CODE_BG = '#f4f2ee'

// ─── Fonts ────────────────────────────────────────────────────────────────
const MAC = '/System/Library/Fonts/Supplemental'
const FACE = {
  body: join(MAC, 'Arial.ttf'),
  bodyBold: join(MAC, 'Arial Bold.ttf'),
  bodyItalic: join(MAC, 'Arial Italic.ttf'),
  bodyBoldItalic: join(MAC, 'Arial Bold Italic.ttf'),
  mono: join(MAC, 'Andale Mono.ttf'),
}
const haveFonts = Object.values(FACE).every(existsSync)
let BODY = 'Helvetica'
let MONO = 'Courier'
if (haveFonts) {
  Font.register({
    family: 'Body',
    fonts: [
      { src: FACE.body },
      { src: FACE.bodyBold, fontWeight: 'bold' },
      { src: FACE.bodyItalic, fontStyle: 'italic' },
      { src: FACE.bodyBoldItalic, fontWeight: 'bold', fontStyle: 'italic' },
    ],
  })
  Font.register({ family: 'Mono', fonts: [{ src: FACE.mono }] })
  BODY = 'Body'
  MONO = 'Mono'
} else {
  console.warn('! Arial/Andale Mono not found — falling back to Helvetica/Courier and substituting non-WinAnsi glyphs (box-drawing fidelity will degrade).')
}
// No mid-word hyphenation in a formal document.
Font.registerHyphenationCallback((w) => [w])

/** When fonts are missing, swap the glyphs the built-in fonts can't draw. */
function glyphSafe(s: string): string {
  if (haveFonts) return s
  return s
    .replace(/→/g, '->').replace(/↔/g, '<->')
    .replace(/≈/g, '~').replace(/×/g, 'x')
    .replace(/─/g, '-').replace(/│/g, '|')
    .replace(/[┌┐└┘├┤┬┴┼]/g, '+')
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 54, paddingBottom: 54, paddingHorizontal: 50,
    fontFamily: BODY, fontSize: 9.5, color: INK, lineHeight: 1.45,
  },
  h1: { fontFamily: BODY, fontWeight: 'bold', fontSize: 20, color: INK, lineHeight: 1.15, marginBottom: 10 },
  h2: {
    fontFamily: BODY, fontWeight: 'bold', fontSize: 14, color: INK,
    marginTop: 16, marginBottom: 6, paddingBottom: 3,
    borderBottomWidth: 0.75, borderBottomColor: OXBLOOD,
  },
  h3: { fontFamily: BODY, fontWeight: 'bold', fontSize: 11, color: INK, marginTop: 10, marginBottom: 4 },
  para: { fontFamily: BODY, marginBottom: 7, color: INK },
  bold: { fontFamily: BODY, fontWeight: 'bold' },
  italic: { fontFamily: BODY, fontStyle: 'italic' },
  codeInline: { fontFamily: MONO, fontSize: 8.5, color: '#5a2d0c', fontStyle: 'normal', fontWeight: 'normal' },
  link: { fontFamily: BODY, color: OXBLOOD, textDecoration: 'none' },
  hr: { borderBottomWidth: 0.5, borderBottomColor: RULE, marginVertical: 10 },
  // lists
  listItem: { flexDirection: 'row', marginBottom: 3 },
  listMarker: { fontFamily: BODY, width: 16, color: OXBLOOD },
  listBody: { flex: 1 },
  // code block
  codeBlock: { backgroundColor: CODE_BG, borderWidth: 0.5, borderColor: RULE, borderRadius: 2, padding: 8, marginBottom: 8 },
  codeText: { fontFamily: MONO, fontSize: 7.5, color: INK, lineHeight: 1.3, fontStyle: 'normal', fontWeight: 'normal' },
  // blockquote
  quote: {
    borderLeftWidth: 2, borderLeftColor: OXBLOOD, paddingLeft: 8,
    marginBottom: 8, backgroundColor: '#faf8f5', paddingVertical: 4, paddingRight: 6,
  },
  quoteText: { fontFamily: BODY, color: '#3a3a3a', fontStyle: 'italic' },
  // table
  table: { borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: RULE, marginBottom: 9 },
  tr: { flexDirection: 'row' },
  th: {
    fontFamily: BODY, flex: 1, padding: 4, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: RULE,
    backgroundColor: '#efe9e2', fontWeight: 'bold', fontSize: 8.5,
  },
  td: { fontFamily: BODY, flex: 1, padding: 4, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: RULE, fontSize: 8.5 },
  footer: {
    fontFamily: BODY, position: 'absolute', bottom: 26, left: 50, right: 50, flexDirection: 'row',
    justifyContent: 'space-between', fontSize: 7.5, color: MUTED,
    paddingTop: 5, borderTopWidth: 0.5, borderTopColor: RULE,
  },
})

// ─── Inline rendering ────────────────────────────────────────────────────
type Run = { text: string; bold?: boolean; italic?: boolean; code?: boolean; href?: string }

function flattenInline(tokens: Token[] | undefined, ctx: { bold?: boolean; italic?: boolean; href?: string } = {}): Run[] {
  const out: Run[] = []
  for (const t of tokens ?? []) {
    const tok = t as any
    switch (tok.type) {
      case 'text':
      case 'escape':
        if (tok.tokens) out.push(...flattenInline(tok.tokens, ctx))
        else out.push({ text: tok.text, ...ctx })
        break
      case 'strong': out.push(...flattenInline(tok.tokens, { ...ctx, bold: true })); break
      case 'em': out.push(...flattenInline(tok.tokens, { ...ctx, italic: true })); break
      case 'codespan': out.push({ text: tok.text, code: true, ...ctx }); break
      case 'link': out.push(...flattenInline(tok.tokens, { ...ctx, href: tok.href })); break
      case 'br': out.push({ text: '\n', ...ctx }); break
      default: if (tok.text) out.push({ text: tok.text, ...ctx })
    }
  }
  return out
}

function renderRuns(tokens: Token[] | undefined, key: string): React.ReactNode {
  const runs = flattenInline(tokens)
  return runs.map((r, i) => {
    const style: any[] = []
    if (r.bold) style.push(styles.bold)
    if (r.italic) style.push(styles.italic)
    if (r.code) style.push(styles.codeInline)
    const text = glyphSafe(r.text)
    if (r.href) {
      return <Link key={`${key}-${i}`} src={r.href} style={[styles.link, ...style]}>{text}</Link>
    }
    return <Text key={`${key}-${i}`} style={style}>{text}</Text>
  })
}

// ─── Block rendering ───────────────────────────────────────────────────────
function renderToken(tok: Token, key: string): React.ReactNode {
  const t = tok as any
  switch (t.type) {
    case 'heading': {
      const style = t.depth === 1 ? styles.h1 : t.depth === 2 ? styles.h2 : styles.h3
      return <Text key={key} style={style}>{renderRuns(t.tokens, key)}</Text>
    }
    case 'paragraph':
      return <Text key={key} style={styles.para}>{renderRuns(t.tokens, key)}</Text>
    case 'hr':
      return <View key={key} style={styles.hr} />
    case 'space':
      return null
    case 'code':
      return (
        <View key={key} style={styles.codeBlock} wrap={false}>
          <Text style={styles.codeText}>{glyphSafe(t.text)}</Text>
        </View>
      )
    case 'blockquote': {
      const inner = (t.tokens as Token[]).map((bt, i) => renderToken(bt, `${key}-q${i}`))
      return <View key={key} style={styles.quote}>{decorateQuote(inner)}</View>
    }
    case 'list': {
      const items = (t.items as Tokens.ListItem[]).map((item, i) => {
        const marker = t.ordered ? `${(t.start || 1) + i}.` : '•'
        return (
          <View key={`${key}-i${i}`} style={styles.listItem} wrap={false}>
            <Text style={styles.listMarker}>{marker}</Text>
            <View style={styles.listBody}>
              {(item.tokens as Token[]).map((it, j) => renderToken(it, `${key}-i${i}-${j}`))}
            </View>
          </View>
        )
      })
      return <View key={key}>{items}</View>
    }
    case 'table':
      return renderTable(t as Tokens.Table, key)
    default:
      // 'text' block token (inside list items) carries inline tokens.
      if (t.tokens) return <Text key={key} style={styles.para}>{renderRuns(t.tokens, key)}</Text>
      if (t.text) return <Text key={key} style={styles.para}>{glyphSafe(t.text)}</Text>
      return null
  }
}

// Quote paragraphs should pick up the muted-italic look.
function decorateQuote(nodes: React.ReactNode[]): React.ReactNode[] {
  return nodes.map((n, i) => {
    if (React.isValidElement(n) && n.type === Text) {
      const el = n as React.ReactElement<any>
      return React.cloneElement(el, { key: `qd${i}`, style: [el.props.style, styles.quoteText, { marginBottom: 0 }] })
    }
    return n
  })
}

function renderTable(t: Tokens.Table, key: string): React.ReactNode {
  const header = (
    <View style={styles.tr} key={`${key}-h`}>
      {t.header.map((cell, i) => (
        <Text key={i} style={styles.th}>{renderRuns(cell.tokens, `${key}-h${i}`)}</Text>
      ))}
    </View>
  )
  const body = t.rows.map((row, r) => (
    <View style={styles.tr} key={`${key}-r${r}`} wrap={false}>
      {row.map((cell, c) => (
        <Text key={c} style={styles.td}>{renderRuns(cell.tokens, `${key}-r${r}c${c}`)}</Text>
      ))}
    </View>
  ))
  return <View key={key} style={styles.table}>{header}{body}</View>
}

// ─── Document ──────────────────────────────────────────────────────────────
function Descriptor({ tokens }: { tokens: Token[] }) {
  const generated = new Date().toISOString().slice(0, 10)
  return (
    <Document
      title="Banned Books — Open Censorship Core: Data Descriptor"
      author="banned-books.org"
      subject="Data descriptor for the open CC-BY-4.0 Banned Books censorship-core dataset (Zenodo deposit)."
    >
      <Page size="A4" style={styles.page} wrap>
        {tokens.map((tok, i) => renderToken(tok, `t${i}`))}
        <View style={styles.footer} fixed>
          <Text>Banned Books — Open Censorship Core · Data Descriptor</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

async function main() {
  if (!existsSync(SRC)) throw new Error(`Source not found: ${SRC}`)
  const md = readFileSync(SRC, 'utf8')
  const tokens = marked.lexer(md)
  const el = React.createElement(Descriptor, { tokens }) as React.ReactElement
  await renderToFile(el as any, OUT)
  console.log(`✓ Wrote ${OUT}`)
  console.log(`  fonts: ${haveFonts ? 'Arial (body) + Andale Mono (code) embedded' : 'FALLBACK Helvetica/Courier + glyph substitution'}`)
}

main().catch((e) => { console.error(e); process.exit(1) })

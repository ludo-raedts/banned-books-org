import { execSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import type { Metadata } from 'next'
import Link from 'next/link'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const metadata: Metadata = {
  title: 'Accessibility',
  description:
    'How accessible Banned Books is: the standard we aim for (WCAG 2.2 AA), what is built in, the limitations we know about, and how to report a barrier.',
  alternates: { canonical: '/accessibility' },
}

const SOURCE_PATH = join(process.cwd(), 'src/app/accessibility/page.tsx')

function getLastUpdated(): Date {
  try {
    const out = execSync(`git log -1 --format=%cI -- "${SOURCE_PATH}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (out) return new Date(out)
  } catch {}
  try {
    return statSync(SOURCE_PATH).mtime
  } catch {}
  return new Date()
}

const LAST_UPDATED = getLastUpdated().toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function AccessibilityPage() {
  return (
    <main>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <Eyebrow>Accessibility</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            A reference everyone can read.
          </h1>

          <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900">
            We aim to meet <strong>WCAG&nbsp;2.2 level&nbsp;AA</strong>. We are not there on every page yet — this
            statement is an honest account of what works, what we know is incomplete, and how to tell us when
            something blocks you.
          </p>

          <p className="mt-4 text-xs text-neutral-500">Last reviewed: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <SectionShell tone="cream">
        <article className="max-w-3xl mx-auto prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-oxblood/30 prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900">
          <h2>What is built in</h2>
          <ul>
            <li>A &ldquo;Skip to content&rdquo; link is the first thing a keyboard or screen-reader user reaches on every page.</li>
            <li>Pages are built from real headings, landmarks, and lists rather than styled containers, so assistive technology can navigate the structure.</li>
            <li>Charts such as the country-by-country ban timeline are paired with the same data as a plain text table, so nothing is locked inside a graphic.</li>
            <li>Links are written to make sense out of context (we avoid bare &ldquo;click here&rdquo;), and form controls carry labels.</li>
            <li>Fonts are self-hosted and the interface avoids motion-heavy effects and tracking-driven interruptions, which keeps pages calm and fast to read.</li>
          </ul>

          <h2>What we know is incomplete</h2>
          <p>
            We have not yet commissioned an independent WCAG&nbsp;2.2&nbsp;AA audit. Until we do, we will not claim
            full conformance. The areas we have not fully verified, and that are most likely to contain barriers:
          </p>
          <ul>
            <li>The search filters, sortable data tables, and timeline have not been tested end-to-end with a screen reader.</li>
            <li>Copy-to-clipboard and &ldquo;cite this&rdquo; buttons may not announce success to assistive technology.</li>
            <li>Colour contrast and visible focus styling have not been checked on every component, particularly in the navigation on small screens.</li>
            <li>Some book covers and historical images carry only basic alternative text.</li>
          </ul>

          <h2>Found a barrier? Tell us</h2>
          <p>
            If something on this site stops you from reading or using it, that is a bug we want to fix. Please describe
            the page, what you were trying to do, and the assistive technology or browser you use, via the{' '}
            <Link href="/about#get-in-touch">contact form on the About page</Link>. We treat access barriers as
            priority issues and will reply with a timeframe.
          </p>

          <h2>How we are improving</h2>
          <p>
            Accessibility is checked as part of building new features, not bolted on afterwards. The known limitations
            above are tracked as work to do, and a formal WCAG&nbsp;2.2&nbsp;AA audit of the interactive
            components — filters, tables, the timeline, copy buttons, and mobile navigation — is planned. We update the
            date above as items are resolved.
          </p>
        </article>
      </SectionShell>
    </main>
  )
}

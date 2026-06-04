import { execSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import type { Metadata } from 'next'
import Link from 'next/link'

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
    <main className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-14">

      {/* Header */}
      <div className="bg-brand-light border-l-4 border-brand pl-6 pr-4 py-6 rounded-r-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-brand/70 mb-3">Accessibility</p>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Accessibility statement</h1>
        <p className="text-gray-700 max-w-2xl leading-relaxed text-sm">
          Banned Books is a reference catalogue, and a reference is only useful if everyone can read it. We aim
          to meet <strong>WCAG&nbsp;2.2 level&nbsp;AA</strong>. We are not there on every page yet — this statement
          is an honest account of what works, what we know is incomplete, and how to tell us when something blocks you.
        </p>
        <p className="text-xs text-gray-500 mt-4">Last updated: {LAST_UPDATED}</p>
      </div>

      {/* 1. What is built in */}
      <section>
        <h2 className="text-xl font-semibold mb-4">What is built in</h2>
        <ul className="flex flex-col gap-3 text-sm text-gray-700 leading-relaxed">
          <li>• A &ldquo;Skip to content&rdquo; link is the first thing a keyboard or screen-reader user reaches on every page.</li>
          <li>• Pages are built from real headings, landmarks, and lists rather than styled <code>div</code>s, so assistive technology can navigate the structure.</li>
          <li>• Charts such as the country-by-country ban timeline are paired with the same data as a plain text table, so nothing is locked inside a graphic.</li>
          <li>• Links are written to make sense out of context (we avoid bare &ldquo;click here&rdquo;), and form controls carry labels.</li>
          <li>• Fonts are self-hosted and the interface avoids motion-heavy effects and tracking-driven interruptions, which keeps pages calm and fast to read.</li>
        </ul>
      </section>

      {/* 2. Known limitations */}
      <section>
        <h2 className="text-xl font-semibold mb-4">What we know is incomplete</h2>
        <p className="text-gray-700 leading-relaxed text-sm mb-4">
          We have not yet commissioned an independent WCAG&nbsp;2.2&nbsp;AA audit. Until we do, we will not claim full
          conformance. Areas we have not fully verified, and that are most likely to contain barriers:
        </p>
        <ul className="flex flex-col gap-3 text-sm text-gray-700 leading-relaxed">
          <li>• The search filters, sortable data tables, and timeline have not been tested end-to-end with a screen reader.</li>
          <li>• Copy-to-clipboard and &ldquo;cite this&rdquo; buttons may not announce success to assistive technology.</li>
          <li>• Colour contrast and visible focus styling have not been checked on every component, particularly in the navigation on small screens.</li>
          <li>• Some book covers and historical images carry only basic alternative text.</li>
        </ul>
      </section>

      {/* 3. Reporting */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Found a barrier? Tell us</h2>
        <p className="text-gray-700 leading-relaxed text-sm">
          If something on this site stops you from reading or using it, that is a bug we want to fix. Please describe
          the page, what you were trying to do, and the assistive technology or browser you use, via the{' '}
          <Link href="/about#get-in-touch" className="text-brand underline hover:no-underline">contact form on the About page</Link>.
          We treat access barriers as priority issues and will reply with a timeframe.
        </p>
      </section>

      {/* 4. Process */}
      <section>
        <h2 className="text-xl font-semibold mb-4">How we are improving</h2>
        <p className="text-gray-700 leading-relaxed text-sm">
          Accessibility is checked as part of building new features, not bolted on afterwards. The known limitations
          above are tracked as work to do, and a formal WCAG&nbsp;2.2&nbsp;AA audit of the interactive
          components — filters, tables, the timeline, copy buttons, and mobile navigation — is planned. We will update
          the date at the top of this page as items are resolved.
        </p>
      </section>

    </main>
  )
}

// Static editorial directory — no DB reads. The list lives in src/lib/allies.ts;
// a long revalidate keeps the rendered HTML cheap.
export const revalidate = 86400

import type { Metadata } from 'next'
import Link from 'next/link'
import SectionShell from '@/components/section/SectionShell'
import { ALLY_GROUPS, ALLY_COUNT } from '@/lib/allies'

export const metadata: Metadata = {
  title: 'Organisations defending the freedom to read',
  description:
    'A directory of anti-censorship and freedom-to-read organisations worldwide — PEN America, the American Library Association, Amnesty International, Index on Censorship and more — and how you can support the work they do.',
  alternates: { canonical: '/organizations' },
}

export default function OrganizationsPage() {
  return (
    <main>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <SectionShell eyebrow="Take action">
        <h1 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 max-w-3xl">
          Organisations defending the freedom to read
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-gray-700 leading-relaxed">
          This catalogue records censorship. It doesn’t fight it — these{' '}
          {ALLY_COUNT} organisations do. They track book bans, defend
          librarians and jailed writers, litigate for the First Amendment, and
          turn up at the school board meetings where most removals are decided.
        </p>
        <p className="mt-4 max-w-2xl text-gray-700 leading-relaxed">
          Banned Books is editorially independent and takes no funding from
          them. We simply stand with the work they do — and if a ban you read
          about here made you want to do something, most of these groups need
          donations, members, and volunteers. Several are also{' '}
          <Link href="/sources" className="text-oxblood hover:underline">
            among the sources
          </Link>{' '}
          behind the records in this catalogue.
        </p>
      </SectionShell>

      {/* ── Grouped directory ─────────────────────────────────────── */}
      {ALLY_GROUPS.map((group, i) => (
        <SectionShell
          key={group.heading}
          tone={i % 2 === 0 ? 'cream' : 'white'}
          eyebrow={group.heading}
        >
          <p className="max-w-2xl text-sm text-neutral-700 leading-relaxed mb-6">
            {group.blurb}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {group.allies.map((ally) => (
              <li key={ally.url}>
                <a
                  href={ally.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover-lift-card block h-full rounded-lg border border-neutral-200 bg-white p-5 transition-colors hover:border-oxblood/40"
                >
                  <span className="font-serif text-base font-semibold text-gray-900">
                    {ally.name}
                    <span aria-hidden="true" className="text-oxblood"> ↗</span>
                  </span>
                  <span className="mt-1.5 block text-sm text-neutral-700 leading-relaxed">
                    {ally.blurb}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </SectionShell>
      ))}

      {/* ── Footnote ──────────────────────────────────────────────── */}
      <SectionShell tone={ALLY_GROUPS.length % 2 === 0 ? 'cream' : 'white'}>
        <p className="max-w-2xl text-sm text-neutral-600 leading-relaxed">
          This is not an exhaustive list, and inclusion isn’t an endorsement of
          every position an organisation takes — only of the shared principle
          that people should be free to read. Know a group that belongs here?{' '}
          <Link href="/about#get-in-touch" className="text-oxblood hover:underline">
            Let us know
          </Link>
          . If you’d rather support this catalogue itself, see{' '}
          <Link href="/support" className="text-oxblood hover:underline">
            supporting the project
          </Link>
          .
        </p>
      </SectionShell>
    </main>
  )
}

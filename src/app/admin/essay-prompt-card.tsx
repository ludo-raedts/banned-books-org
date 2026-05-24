'use client'

import { useState } from 'react'
import { PenLine } from 'lucide-react'

const PROMPT = `I want to publish a new essay on banned-books.org.

This project has a standardised essay template. Use it — do not roll your own layout.

Files involved (you create or edit ALL of these for a new essay):
- src/lib/essays-data.ts — registry of all essays. Add a new entry here first.
- src/components/essay-layout.tsx — the visual template. Use it as the wrapper. (read-only)
- src/app/essays/<slug>/page.tsx — the rendered HTML page. Create this.
- src/lib/markdown-pages/<slug>.ts — frontmatter + raw markdown body. Create this.
- src/app/essays/<slug>.md/route.ts — serves the .md twin for LLM crawlers. Create this.

Model your new files on the most recent existing essay: src/app/essays/the-grey-zone/page.tsx,
src/lib/markdown-pages/the-grey-zone.ts, and src/app/essays/the-grey-zone.md/route.ts.

Steps for a new essay:

1. Add an entry to ESSAYS in src/lib/essays-data.ts:
   {
     slug: '<kebab-case-slug>',
     href: '/essays/<kebab-case-slug>',
     title: '<Essay title>',
     dek: '<2–3 sentence standfirst>',
     publishedAt: '<YYYY-MM-DD>',
     readingTimeMin: <approx words / 200, rounded up>,
     relatedBookSlugs: ['<book-slug>', ...], // 3–6 curated books
     draft: true, // flip to false (or remove) when content is final
   }

2. Create src/app/essays/<slug>/page.tsx. It must:
   - Import EssayLayout from '@/components/essay-layout'
   - Import buildCitationMeta from '@/lib/citation-meta'
   - Look up the essay via essayBySlug('<slug>')
   - Export Next.js metadata with:
       title: essay.title                              // root layout appends " | Banned Books" — do NOT hardcode it
       description: essay.dek
       openGraph: { title, description, type: 'article' }
       alternates: {
         canonical: essay.href,
         types: { 'text/markdown': \`\${essay.href}.md\` },
       }
       robots: essay.draft ? { index: false, follow: true } : undefined
       other: buildCitationMeta({ entityType: 'essay', title: essay.title,
                                  url: \`https://www.banned-books.org\${essay.href}\`,
                                  publicationYear: Number(essay.publishedAt.slice(0, 4)),
                                  onlineDate: essay.publishedAt })
   - Render JSON-LD as <script type="application/ld+json"> with @type Article
     (headline, description, datePublished, author/publisher = Organization "banned-books.org",
      mainEntityOfPage = full https URL)
   - Wrap the body in <EssayLayout essay={essay} hero={{ ... }}> ... </EssayLayout>
   - Place body content inside <article className={proseClasses}> using h2/h3/p/ul markup
   - Use <Link href="/books/<slug>"> for internal book mentions, <Link href="/countries/<code>"> for countries

3. Create the markdown twin so LLM crawlers can grab clean prose:
   a. src/lib/markdown-pages/<slug>.ts — export { frontmatter, body }. Frontmatter shape:
      { title, url: 'https://www.banned-books.org/essays/<slug>', description, published_at }.
      The body is the same prose as the page, but in markdown (no JSX, no <Link>).
      Use [text](https://www.banned-books.org/books/<slug>) for internal links.
   b. src/app/essays/<slug>.md/route.ts — boilerplate that imports { frontmatter, body }
      and returns markdownResponse(buildMarkdownDocument(frontmatter, body)). Copy from
      src/app/essays/the-grey-zone.md/route.ts and swap the import path.

4. The hero image is optional. If used, pass { src, alt, caption, eager } to EssayLayout.
   Caption may include attribution links.

5. Do NOT add a sidebar (Happening now / Trending). Essays are a reading flow.
   The "Books on this theme" block, citation block, and "More essays" footer are rendered
   automatically by EssayLayout.

6. The sitemap is automatic — it reads from publishedEssays() in essays-data.ts.
   No edits to sitemap-static-entries.ts. Just flip draft to false.

7. Verify on http://localhost:3000/essays/<slug> before pushing. Check:
   - Hero card renders with correct dek and reading time
   - Article body uses Tailwind typography (prose) styles
   - "Books on this theme" shows the curated covers (only if relatedBookSlugs is non-empty)
   - "More essays" shows the other published essays
   - The /essays index page lists the new essay (only after draft is false)
   - /essays/<slug>.md returns clean markdown with frontmatter
   - View source: <title> is "<Essay title> | Banned Books" (no doubled suffix)
   - View source: <link rel="alternate" type="text/markdown" ...> is present
   - View source: citation_title / citation_author / citation_publication_date meta tags present

The essay I want to publish:

Title: <paste title>
Dek: <paste 2–3 sentence standfirst>
Body: <paste full essay text — markdown or prose; you convert to JSX for the page and keep clean markdown for the .md twin>
Related books (book slugs from /books/...): <list>
Hero image (optional): <URL, alt, caption>
`

export default function EssayPromptCard({ cardCls }: { cardCls: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(PROMPT)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={cardCls}>
      <PenLine className="w-5 h-5 text-gray-400 dark:text-gray-500" />
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Author a new essay</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Copy this prompt into a fresh Claude Code session to add a new essay using the standard template.
        </p>
      </div>
      <div className="flex flex-col gap-1.5 text-sm mt-1">
        <button
          onClick={handleCopy}
          className="self-start px-3 py-1.5 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand/90 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy prompt'}
        </button>
        <details className="mt-2 group">
          <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors select-none">
            Show prompt
          </summary>
          <pre className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-[11px] leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono overflow-auto max-h-96">
            {PROMPT}
          </pre>
        </details>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Reference files:{' '}
          <code className="text-gray-600 dark:text-gray-400">src/components/essay-layout.tsx</code>{' '}·{' '}
          <code className="text-gray-600 dark:text-gray-400">src/lib/essays-data.ts</code>
        </p>
      </div>
    </div>
  )
}

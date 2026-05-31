'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminBackLink from '@/components/admin-back-link'
import type { ContentBlockRow, ContentBlockStatus } from '@/lib/content-blocks'

// Split-pane markdown editor with live preview. The preview HTML is the same
// thing the public page will render: server-rendered + sanitized at /save.
// We don't run the markdown pipeline in the browser — the client only shows a
// preview after each save (which is fast: a single fetch round-trip).

function StatusPill({ status }: { status: ContentBlockStatus }) {
  const styles: Record<ContentBlockStatus, string> = {
    placeholder: 'bg-gray-200 text-gray-700',
    draft:       'bg-amber-100 text-amber-800',
    published:   'bg-green-100 text-green-800',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide ${styles[status]}`}>
      {status}
    </span>
  )
}

export default function ContentBlockEditClient({ block }: { block: ContentBlockRow }) {
  const router = useRouter()
  const [markdown, setMarkdown] = useState(block.body_markdown ?? '')
  const [notes, setNotes] = useState(block.notes ?? '')
  const [previewHtml, setPreviewHtml] = useState(block.body_html ?? '')
  const [status, setStatus] = useState<ContentBlockStatus>(block.status)
  const [showBrief, setShowBrief] = useState(status === 'placeholder')
  const [saving, setSaving] = useState<null | 'save' | 'publish' | 'revert'>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(block.last_edited_at)

  const dirty = markdown !== (block.body_markdown ?? '') || notes !== (block.notes ?? '')

  const wordCount = useMemo(() => {
    const trimmed = markdown.trim()
    if (!trimmed) return 0
    return trimmed.split(/\s+/).length
  }, [markdown])

  async function call(action: 'save_draft' | 'publish' | 'revert_to_draft') {
    const flag = action === 'save_draft' ? 'save' : action === 'publish' ? 'publish' : 'revert'
    setSaving(flag)
    setError(null)
    try {
      const res = await fetch(`/api/admin/content-blocks/${block.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, body_markdown: markdown, notes }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setStatus(data.status)
      setPreviewHtml(data.body_html ?? '')
      setSavedAt(data.last_edited_at ?? new Date().toISOString())
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
    setSaving(null)
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {block.title}
            <StatusPill status={status} />
          </h1>
          <p className="text-xs text-gray-500 mt-1 font-mono">{block.slug}</p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div className="mb-1"><AdminBackLink href="/admin/content-blocks" label="Content blocks" /></div>
          <div>Last edited: {savedAt ? new Date(savedAt).toLocaleString('en-GB') : '—'}</div>
          {block.published_at && <div>Published: {new Date(block.published_at).toLocaleString('en-GB')}</div>}
          <div className="mt-1">{wordCount} words</div>
        </div>
      </div>

      <details
        open={showBrief}
        onToggle={e => setShowBrief((e.target as HTMLDetailsElement).open)}
        className="mb-4 border border-gray-200 rounded-lg bg-amber-50/40 px-4 py-3"
      >
        <summary className="cursor-pointer text-sm font-medium select-none">Editorial brief</summary>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{block.placeholder_brief}</p>
      </details>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Markdown</label>
          <textarea
            value={markdown}
            onChange={e => setMarkdown(e.target.value)}
            spellCheck={false}
            rows={22}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 resize-y leading-relaxed"
            placeholder={status === 'placeholder' ? 'Write the markdown for this block…' : ''}
          />
          <label className="block text-xs font-medium text-gray-500 mb-1.5 mt-3">Internal notes (not published)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 resize-y"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Preview (sanitized HTML — same as public)</label>
          <div className="w-full min-h-[27rem] border border-gray-200 rounded-lg px-4 py-3 bg-white prose prose-sm prose-gray max-w-none">
            {previewHtml ? (
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <p className="text-gray-400 italic">No preview yet — save a draft to render.</p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-red-600 border border-red-200 rounded-lg p-3 bg-red-50 text-sm">{error}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => call('save_draft')}
          disabled={!!saving || !dirty}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50 hover:opacity-90"
        >
          {saving === 'save' ? 'Saving…' : 'Save draft'}
        </button>
        <button
          onClick={() => call('publish')}
          disabled={!!saving || !markdown.trim()}
          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-green-700"
        >
          {saving === 'publish' ? 'Publishing…' : status === 'published' ? 'Re-publish' : 'Publish'}
        </button>
        {status === 'published' && (
          <button
            onClick={() => call('revert_to_draft')}
            disabled={!!saving}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50 hover:border-gray-400"
          >
            {saving === 'revert' ? 'Reverting…' : 'Revert to draft'}
          </button>
        )}
        {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
      </div>
    </main>
  )
}

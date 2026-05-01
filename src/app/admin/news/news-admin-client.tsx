'use client'

import { useState } from 'react'

type NewsItem = {
  id: number
  title: string
  source_name: string
  source_url: string
  published_at: string | null
  summary: string | null
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function NewsRow({ item, onDone }: { item: NewsItem; onDone: (id: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [summary, setSummary] = useState(item.summary ?? '')
  const [loading, setLoading] = useState<string | null>(null)

  async function call(action: string, extraSummary?: string) {
    setLoading(action)
    await fetch('/api/admin/news', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, action, summary: extraSummary }),
    })
    setLoading(null)
    onDone(item.id)
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3 bg-white dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <a
            href={item.source_url}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="font-semibold text-sm hover:underline leading-snug"
          >
            {item.title}
          </a>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {item.source_name} · {formatDate(item.published_at)}
          </p>
        </div>
      </div>

      {editing ? (
        <textarea
          value={summary}
          onChange={e => setSummary(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
        />
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{summary || <em className="text-gray-400">No summary</em>}</p>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => call('publish', editing ? summary : undefined)}
          disabled={!!loading}
          className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium disabled:opacity-50 hover:bg-green-700"
        >
          {loading === 'publish' ? 'Publishing…' : 'Publish'}
        </button>
        <button
          onClick={() => call('reject')}
          disabled={!!loading}
          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium disabled:opacity-50 hover:bg-red-700"
        >
          {loading === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
        {editing ? (
          <>
            <button
              onClick={() => { call('update_summary', summary); setEditing(false) }}
              disabled={!!loading}
              className="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-xs font-medium disabled:opacity-50"
            >
              Save edit
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs">
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs hover:border-gray-400"
          >
            Edit summary
          </button>
        )}
      </div>
    </div>
  )
}

export default function NewsAdminClient({ initialItems }: { initialItems: NewsItem[] }) {
  const [items, setItems] = useState<NewsItem[]>(initialItems)

  function onDone(id: number) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (items.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 text-sm py-8">No drafts — run the fetch-news script to populate.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map(item => (
        <NewsRow key={item.id} item={item} onDone={onDone} />
      ))}
    </div>
  )
}

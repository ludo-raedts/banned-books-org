'use client'

import { useState } from 'react'
import { useAdminUi } from '../../admin-ui'
import { useUnsavedChanges } from '../../use-unsaved-changes'
import type { AuthorEditData } from './page'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls = 'px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'
const textareaCls = `${inputCls} resize-y`

export default function AuthorEditClient({ author }: { author: AuthorEditData }) {
  const [displayName, setDisplayName] = useState(author.display_name)
  const [bio, setBio] = useState(author.bio ?? '')
  const [bioSourceUrl, setBioSourceUrl] = useState(author.bio_source_url ?? '')
  const [birthYear, setBirthYear] = useState(author.birth_year?.toString() ?? '')
  const [deathYear, setDeathYear] = useState(author.death_year?.toString() ?? '')
  const [birthCountry, setBirthCountry] = useState(author.birth_country ?? '')
  const [photoUrl, setPhotoUrl] = useState(author.photo_url ?? '')
  const [saving, setSaving] = useState(false)
  const ui = useAdminUi()

  const snapshot = JSON.stringify({ displayName, bio, bioSourceUrl, birthYear, deathYear, birthCountry, photoUrl })
  const [baseline, setBaseline] = useState(snapshot)
  const dirty = snapshot !== baseline
  useUnsavedChanges(dirty)

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        display_name: displayName,
        bio: bio || null,
        bio_source_url: bioSourceUrl.trim() || null,
        birth_year: birthYear ? parseInt(birthYear) : null,
        death_year: deathYear ? parseInt(deathYear) : null,
        birth_country: birthCountry || null,
        photo_url: photoUrl || null,
      }
      const res = await fetch(`/api/admin/authors/${author.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      setBaseline(snapshot)
      ui.toast('Saved', 'success')
    } catch (err) {
      ui.toast(err instanceof Error ? err.message : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Edit form */}
      <div className="border border-gray-200 rounded-xl p-6 flex flex-col gap-5">
        <Field label="Display name" hint="The author's full public name">
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputCls} />
        </Field>

        <Field label="Bio" hint="Short biography shown on the author page">
          <textarea rows={8} value={bio} onChange={e => setBio(e.target.value)} className={textareaCls} />
        </Field>

        <Field
          label="Bio source URL"
          hint="Where the bio text comes from — a Wikipedia/OpenLibrary URL shows “Source: Wikipedia” under the bio; blank shows “Source: editorial team”"
        >
          <input
            type="url"
            value={bioSourceUrl}
            onChange={e => setBioSourceUrl(e.target.value)}
            className={inputCls}
            placeholder="https://en.wikipedia.org/wiki/…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Birth year" hint="4-digit year">
            <input type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)} min={1000} max={2099} className={`${inputCls} w-full`} />
          </Field>
          <Field label="Death year" hint="Leave blank if living">
            <input type="number" value={deathYear} onChange={e => setDeathYear(e.target.value)} min={1000} max={2099} className={`${inputCls} w-full`} />
          </Field>
        </div>

        <Field label="Birth country" hint="Country of birth (plain text)">
          <input type="text" value={birthCountry} onChange={e => setBirthCountry(e.target.value)} className={inputCls} placeholder="e.g. United States" />
        </Field>

        <Field label="Photo URL" hint="Direct URL to an author portrait image">
          <input
            type="url"
            value={photoUrl}
            onChange={e => setPhotoUrl(e.target.value)}
            className={inputCls}
            placeholder="https://…"
          />
        </Field>

        {/* Photo preview */}
        {photoUrl && (
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt="Author photo preview"
              className="w-20 h-20 rounded-lg object-cover border border-gray-200"
            />
            <p className="text-xs text-gray-400 mt-1">Photo preview</p>
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {dirty && !saving && (
            <span className="text-sm text-amber-600">Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Read-only info */}
      <div className="border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Read-only info</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500">Slug</dt>
          <dd className="font-mono text-xs break-all">{author.slug}</dd>
          <dt className="text-gray-500">Bans</dt>
          <dd>{author.ban_count}</dd>
          <dt className="text-gray-500">Public page</dt>
          <dd>
            <a
              href={`/authors/${author.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-xs"
            >
              /authors/{author.slug} ↗
            </a>
          </dd>
        </dl>
      </div>
    </div>
  )
}

const GENRES: Record<string, { label: string; classes: string }> = {
  'children':          { label: 'Children',          classes: 'bg-sky-100 text-sky-700' },
  'young-adult':       { label: 'Young adult',        classes: 'bg-teal-100 text-teal-700' },
  'fantasy':           { label: 'Fantasy',            classes: 'bg-indigo-100 text-indigo-700' },
  'dystopian':         { label: 'Dystopian',          classes: 'bg-slate-100 text-slate-700' },
  'science-fiction':   { label: 'Sci-fi',             classes: 'bg-cyan-100 text-cyan-700' },
  'literary-fiction':  { label: 'Literary fiction',   classes: 'bg-violet-100 text-violet-700' },
  'historical-fiction':{ label: 'Historical fiction', classes: 'bg-amber-100 text-amber-800' },
  'coming-of-age':     { label: 'Coming of age',      classes: 'bg-lime-100 text-lime-700' },
  'memoir':            { label: 'Memoir',             classes: 'bg-stone-100 text-stone-700' },
  'non-fiction':       { label: 'Non-fiction',        classes: 'bg-zinc-100 text-zinc-700' },
  'satire':            { label: 'Satire',             classes: 'bg-yellow-100 text-yellow-700' },
  'political-fiction': { label: 'Political fiction',  classes: 'bg-blue-100 text-blue-700' },
  'romance':           { label: 'Romance',            classes: 'bg-rose-100 text-rose-700' },
  'thriller':          { label: 'Thriller',           classes: 'bg-orange-100 text-orange-700' },
  'magical-realism':   { label: 'Magical realism',    classes: 'bg-purple-100 text-purple-700' },
}

export function genreLabel(slug: string) {
  return GENRES[slug]?.label ?? slug
}

export default function GenreBadge({ slug }: { slug: string }) {
  const g = GENRES[slug] ?? { label: slug, classes: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${g.classes}`}>
      {g.label}
    </span>
  )
}

interface BookCoverPlaceholderProps {
  title: string
  author?: string
  slug: string
  className?: string
}

const colors = [
  { bg: '#1e3a5f', text: '#e8f0fa', accent: '#4a90d9' },
  { bg: '#6b1a1a', text: '#faeaea', accent: '#c0504d' },
  { bg: '#1a4a2e', text: '#e8f5ee', accent: '#4caf7d' },
  { bg: '#2d2a5e', text: '#eeedf8', accent: '#7b78c8' },
  { bg: '#4a3000', text: '#fdf3e0', accent: '#e6a817' },
  { bg: '#1a3d4f', text: '#e4f2f7', accent: '#3d9dbf' },
]

function titleFontSize(title: string): string {
  if (title.length < 20) return '1.1rem'
  if (title.length <= 40) return '0.85rem'
  return '0.72rem'
}

export default function BookCoverPlaceholder({ title, author, slug, className }: BookCoverPlaceholderProps) {
  const colorIndex = slug.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
  const { bg, text, accent } = colors[colorIndex]

  return (
    <div
      className={`w-full aspect-[2/3] rounded select-none overflow-hidden flex flex-col ${className ?? ''}`}
      style={{
        backgroundColor: bg,
        color: text,
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 3px,
          ${bg}08 3px,
          ${bg}08 4px
        )`,
      }}
    >
      {/* Top accent bar */}
      <div className="shrink-0 px-3 pt-3 pb-1">
        <div className="h-px w-8 rounded-full" style={{ backgroundColor: accent }} />
      </div>

      {/* Title */}
      <div className="flex-1 flex items-center px-3 py-2">
        <p
          className="font-bold leading-tight line-clamp-3 w-full"
          style={{ fontSize: titleFontSize(title) }}
        >
          {title}
        </p>
      </div>

      {/* Author */}
      <div className="shrink-0 px-3 pb-3 pt-1">
        <div className="h-px w-full mb-2 opacity-20" style={{ backgroundColor: text }} />
        <p className="text-xs leading-tight truncate opacity-80">
          {author ?? ''}
        </p>
      </div>
    </div>
  )
}

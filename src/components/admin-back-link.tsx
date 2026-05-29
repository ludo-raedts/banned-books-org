import Link from 'next/link'

export default function AdminBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors whitespace-nowrap"
    >
      ← {label}
    </Link>
  )
}

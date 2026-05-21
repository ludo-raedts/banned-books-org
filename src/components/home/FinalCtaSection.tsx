import Link from 'next/link'
import SectionShell from '@/components/section/SectionShell'

export default function FinalCtaSection({ totalBooks }: { totalBooks: number }) {
  return (
    <SectionShell tone="cream">
      <div className="text-center py-4 md:py-8">
        <p className="font-serif text-xl md:text-2xl font-medium tracking-tight max-w-md mx-auto leading-snug text-neutral-900">
          A documented ban cannot be denied.
        </p>
        <Link
          href="/search"
          className="mt-6 inline-block px-6 py-3 bg-oxblood text-cream text-sm font-medium rounded-sm tracking-wide hover:bg-brand transition-colors"
        >
          Browse all {totalBooks.toLocaleString('en')} books →
        </Link>
      </div>
    </SectionShell>
  )
}

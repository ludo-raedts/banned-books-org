'use client'

// Root error boundary for runtime errors thrown while rendering a route
// segment (e.g. a Supabase outage during a Server Component fetch). Renders
// inside the root layout with a branded recovery path instead of Next's bare
// error screen. Layout-level crashes are handled by global-error.tsx.
import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface to the server/console logs for diagnosis.
    console.error(error)
  }, [error])

  return (
    <main className="max-w-2xl mx-auto px-4 py-20 sm:py-28 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand">Something went wrong</p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-serif font-semibold text-gray-900">
        This page failed to load
      </h1>
      <p className="mt-4 text-gray-600">
        A temporary error occurred while loading this page. You can try again, or
        head back to the homepage.
      </p>
      <div className="mt-8 flex gap-3 justify-center">
        <button
          onClick={reset}
          className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-400 transition-colors"
        >
          Go home
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs text-gray-400">Reference: {error.digest}</p>
      )}
    </main>
  )
}

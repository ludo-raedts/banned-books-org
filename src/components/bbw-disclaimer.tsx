// Hardcoded positioning copy. These three strings are legal/positioning
// statements, not editorial — they belong in code, not in the content-blocks
// CMS. Changing them requires a code review.

export function BBWDisclaimer({ variant }: { variant: 'short' | 'full' }) {
  if (variant === 'short') {
    return (
      <p className="text-xs text-gray-500">
        Independent. Not affiliated with the BBW Coalition or ALA.
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 leading-relaxed">
      <p>
        banned-books.org is an independent platform documenting book censorship
        worldwide. We are not affiliated with the Banned Books Week Coalition,
        the American Library Association, or any organizing partner. We support
        Banned Books Week as an initiative, and this page is intended as a
        complementary knowledge resource — focused on international context and
        data. For official events, posters, and toolkits, see{' '}
        <a
          href="https://bannedbooksweek.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:underline"
        >
          bannedbooksweek.org
        </a>{' '}
        and{' '}
        <a
          href="https://www.ala.org/bbooks"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:underline"
        >
          ala.org/bbooks
        </a>.
      </p>
    </div>
  )
}

export function ALAAttribution() {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 leading-relaxed">
      <p>
        Compiled from the American Library Association&apos;s Office for
        Intellectual Freedom annual Most Challenged Books list. The list is
        published yearly during National Library Week. We are not affiliated
        with ALA.{' '}
        <a
          href="https://www.ala.org/bbooks/frequentlychallengedbooks/top10"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:underline"
        >
          Source
        </a>
        .
      </p>
    </div>
  )
}
